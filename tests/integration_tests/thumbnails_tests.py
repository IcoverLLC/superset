# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# from superset import db
# from superset.models.dashboard import Dashboard

import urllib.request
from io import BytesIO
from unittest import skipUnless
from unittest.mock import ANY, call, MagicMock, patch

import pytest
from flask_testing import LiveServerTestCase
from sqlalchemy.sql import func

from superset import db, is_feature_enabled, security_manager
from superset.extensions import machine_auth_provider_factory
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tasks.types import ExecutorType, FixedExecutor
from superset.utils import json
from superset.utils.screenshots import (
    ChartScreenshot,
    DashboardScreenshot,
    ScreenshotCachePayload,
)
from superset.utils.urls import get_url_path
from superset.utils.webdriver import (
    PlaywrightTimeout,
    WebDriverPlaywright,
    WebDriverSelenium,
)
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME, ALPHA_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.test_app import app

CHART_URL = "/api/v1/chart/"
DASHBOARD_URL = "/api/v1/dashboard/"


class TestThumbnailsSeleniumLive(LiveServerTestCase):
    def create_app(self):
        return app

    def url_open_auth(self, username: str, url: str):
        user = security_manager.find_user(username=username)
        cookies = machine_auth_provider_factory.instance.get_auth_cookies(user)
        opener = urllib.request.build_opener()
        opener.addheaders.append(("Cookie", f"session={cookies['session']}"))
        return opener.open(f"{self.get_server_url()}/{url}")

    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_screenshot(self):
        """
        Thumbnails: Simple get async dashboard screenshot
        """
        with patch("superset.dashboards.api.DashboardRestApi.get") as mock_get:  # noqa: F841
            rv = self.client.get(DASHBOARD_URL)
            resp = json.loads(rv.data.decode("utf-8"))
            thumbnail_url = resp["result"][0]["thumbnail_url"]

            response = self.url_open_auth(
                ADMIN_USERNAME,
                thumbnail_url,
            )
            assert response.getcode() == 202


class TestWebDriverScreenshotErrorDetector(SupersetTestCase):
    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.WebDriverSelenium.find_unexpected_errors")
    def test_not_call_find_unexpected_errors_if_feature_disabled(
        self, mock_find_unexpected_errors, mock_firefox, mock_webdriver_wait
    ):
        webdriver_proxy = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.dashboard", dashboard_id_or_slug=1)
        webdriver_proxy.get_screenshot(url, "grid-container", user=user)

        assert not mock_find_unexpected_errors.called

    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.WebDriverSelenium.find_unexpected_errors")
    def test_call_find_unexpected_errors_if_feature_enabled(
        self, mock_find_unexpected_errors, mock_firefox, mock_webdriver_wait
    ):
        app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"] = True
        webdriver_proxy = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.dashboard", dashboard_id_or_slug=1)
        webdriver_proxy.get_screenshot(url, "grid-container", user=user)

        assert mock_find_unexpected_errors.called

        app.config["SCREENSHOT_REPLACE_UNEXPECTED_ERRORS"] = False

    def test_find_unexpected_errors_no_alert(self):
        webdriver = MagicMock()

        webdriver.find_elements.return_value = []

        unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver=webdriver)
        assert len(unexpected_errors) == 0

        assert "alert" in webdriver.find_elements.call_args_list[0][0][1]

    @patch("superset.utils.webdriver.WebDriverWait")
    def test_find_unexpected_errors(self, mock_webdriver_wait):
        webdriver = MagicMock()
        alert_div = MagicMock()

        webdriver.find_elements.return_value = [alert_div]
        alert_div.find_elements.return_value = MagicMock()

        unexpected_errors = WebDriverSelenium.find_unexpected_errors(driver=webdriver)
        assert len(unexpected_errors) == 1

        # attempt to find alerts
        assert "alert" in webdriver.find_elements.call_args_list[0][0][1]
        # attempt to click on "See more" buttons
        assert "button" in alert_div.find_element.call_args_list[0][0][1]
        # Wait for error modal to show up and to hide
        assert 2 == len(mock_webdriver_wait.call_args_list)
        # replace the text in alert div, eg, "unexpected errors"
        assert alert_div == webdriver.execute_script.call_args_list[0][0][1]


class TestWebDriverSelenium(SupersetTestCase):
    @patch.object(WebDriverSelenium, "destroy")
    @patch.object(WebDriverSelenium, "auth")
    def test_screenshot_cleans_up_when_navigation_fails(
        self,
        mock_auth,
        mock_destroy,
    ):
        driver = MagicMock()
        driver.get.side_effect = RuntimeError("navigation failed")
        mock_auth.return_value = driver
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)

        with pytest.raises(RuntimeError, match="navigation failed"):
            webdriver.get_screenshot(
                "http://example.invalid",
                "standalone",
                user=user,
            )

        mock_destroy.assert_called_once_with(
            driver,
            app.config["SCREENSHOT_SELENIUM_RETRIES"],
        )

    @patch.object(WebDriverSelenium, "destroy")
    @patch.object(WebDriverSelenium, "auth")
    def test_screenshot_cleans_up_when_navigation_is_interrupted(
        self,
        mock_auth,
        mock_destroy,
    ):
        driver = MagicMock()
        driver.get.side_effect = KeyboardInterrupt
        mock_auth.return_value = driver
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)

        with pytest.raises(KeyboardInterrupt):
            webdriver.get_screenshot(
                "http://example.invalid",
                "standalone",
                user=user,
            )

        mock_destroy.assert_called_once_with(
            driver,
            app.config["SCREENSHOT_SELENIUM_RETRIES"],
        )

    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.sleep")
    def test_screenshot_selenium_headstart(
        self, mock_sleep, mock_webdriver, mock_webdriver_wait
    ):
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.slice", slice_id=1, standalone="true")
        app.config["SCREENSHOT_SELENIUM_HEADSTART"] = 5
        webdriver.get_screenshot(url, "chart-container", user=user)
        assert mock_sleep.call_args_list[0] == call(5)

    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    def test_screenshot_selenium_locate_wait(self, mock_webdriver, mock_webdriver_wait):
        app.config["SCREENSHOT_LOCATE_WAIT"] = 15
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.slice", slice_id=1, standalone="true")
        webdriver.get_screenshot(url, "chart-container", user=user)
        assert mock_webdriver_wait.call_args_list[0] == call(ANY, 15)

    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    def test_screenshot_selenium_load_wait(self, mock_webdriver, mock_webdriver_wait):
        app.config["SCREENSHOT_LOAD_WAIT"] = 15
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.slice", slice_id=1, standalone="true")
        webdriver.get_screenshot(url, "chart-container", user=user)
        assert mock_webdriver_wait.call_args_list[2] == call(ANY, 15)

    @patch("superset.utils.webdriver.WebDriverWait")
    @patch("superset.utils.webdriver.firefox")
    @patch("superset.utils.webdriver.sleep")
    def test_screenshot_selenium_animation_wait(
        self, mock_sleep, mock_webdriver, mock_webdriver_wait
    ):
        webdriver = WebDriverSelenium("firefox")
        user = security_manager.get_user_by_username(ADMIN_USERNAME)
        url = get_url_path("Superset.slice", slice_id=1, standalone="true")
        app.config["SCREENSHOT_SELENIUM_ANIMATION_WAIT"] = 4
        webdriver.get_screenshot(url, "chart-container", user=user)
        assert mock_sleep.call_args_list[1] == call(4)


class TestWebDriverPlaywright(SupersetTestCase):
    def test_wait_for_dashboard_to_draw_falls_back_to_grid_container(self):
        page = MagicMock()
        chart_locator = MagicMock()
        chart_container = MagicMock()
        chart_locator.nth.return_value = chart_container
        chart_container.wait_for.side_effect = PlaywrightTimeout("timed out")

        grid_locator = MagicMock()
        grid_container = MagicMock()
        grid_locator.nth.return_value = grid_container

        page.locator.side_effect = lambda selector: {
            ".chart-container": chart_locator,
            ".grid-container": grid_locator,
        }[selector]

        WebDriverPlaywright._wait_for_dashboard_to_draw(page, "http://example", 12)

        chart_container.wait_for.assert_called_once_with(
            state="visible",
            timeout=12000,
        )
        grid_container.wait_for.assert_called_once_with(
            state="visible",
            timeout=12000,
        )

    def test_wait_for_dashboard_to_stabilize_uses_quiet_window(self):
        page = MagicMock()

        WebDriverPlaywright._wait_for_dashboard_to_stabilize(
            page,
            "http://example",
            15,
        )

        args, kwargs = page.wait_for_function.call_args
        assert "MutationObserver" in args[0]
        assert "window.__supersetPlaywrightScreenshotState" in args[0]
        assert kwargs["arg"] == 2000
        assert kwargs["timeout"] == 15000
        assert kwargs["polling"] == 200


class TestThumbnails(SupersetTestCase):
    mock_image = b"bytes mock image"
    digest_return_value = "foo_bar"
    digest_hash = "5c7d96a3dd7a87850a2ef34087565a6e"

    def _get_id_and_thumbnail_url(self, url: str) -> tuple[int, str]:
        rv = self.client.get(url)
        resp = json.loads(rv.data.decode("utf-8"))
        obj = resp["result"][0]
        return obj["id"], obj["thumbnail_url"]

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @patch("superset.dashboards.api.cache_dashboard_thumbnail.delay")
    @patch("superset.dashboards.api.get_welcome_thumbnail")
    def test_welcome_thumbnail_cache_hit_does_not_enqueue(
        self,
        mock_get_welcome_thumbnail,
        mock_delay,
    ):
        self.login(ADMIN_USERNAME)
        dashboard = db.session.query(Dashboard).filter_by(slug="births").one()
        dashboard.published = True
        db.session.commit()
        mock_get_welcome_thumbnail.return_value = BytesIO(self.mock_image)

        rv = self.client.get(
            f"{DASHBOARD_URL}{dashboard.id}/welcome-thumbnail/"
        )

        assert rv.status_code == 200
        assert rv.data == self.mock_image
        assert rv.mimetype == "image/png"
        assert rv.headers["ETag"]
        assert "private" in rv.headers["Cache-Control"]
        conditional_rv = self.client.get(
            f"{DASHBOARD_URL}{dashboard.id}/welcome-thumbnail/",
            headers={"If-None-Match": rv.headers["ETag"]},
        )
        assert conditional_rv.status_code == 304
        mock_delay.assert_not_called()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @patch("superset.dashboards.api.cache_dashboard_thumbnail.delay")
    @patch("superset.dashboards.api.get_welcome_thumbnail", return_value=None)
    def test_welcome_thumbnail_cache_miss_does_not_enqueue(
        self,
        mock_get_welcome_thumbnail,
        mock_delay,
    ):
        self.login(ADMIN_USERNAME)
        dashboard = db.session.query(Dashboard).filter_by(slug="births").one()
        dashboard.published = True
        db.session.commit()

        rv = self.client.get(
            f"{DASHBOARD_URL}{dashboard.id}/welcome-thumbnail/"
        )

        assert rv.status_code == 404
        mock_get_welcome_thumbnail.assert_called_once_with(dashboard.id)
        mock_delay.assert_not_called()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @patch("superset.dashboards.api.get_welcome_thumbnail")
    def test_welcome_thumbnail_rejects_unpublished_dashboard(
        self,
        mock_get_welcome_thumbnail,
    ):
        self.login(ADMIN_USERNAME)
        dashboard = db.session.query(Dashboard).filter_by(slug="births").one()
        dashboard.published = False
        db.session.commit()

        rv = self.client.get(
            f"{DASHBOARD_URL}{dashboard.id}/welcome-thumbnail/"
        )

        assert rv.status_code == 404
        mock_get_welcome_thumbnail.assert_not_called()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=False)
    def test_dashboard_thumbnail_disabled(self):
        """
        Thumbnails: Dashboard thumbnail disabled
        """
        self.login(ADMIN_USERNAME)
        _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
        rv = self.client.get(thumbnail_url)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=False)
    def test_chart_thumbnail_disabled(self):
        """
        Thumbnails: Chart thumbnail disabled
        """
        self.login(ADMIN_USERNAME)
        _, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
        rv = self.client.get(thumbnail_url)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_dashboard_screenshot_as_fixed_user(self):
        """
        Thumbnails: Simple get async dashboard screenshot as selenium user
        """
        self.login(ALPHA_USERNAME)
        with (
            patch.dict(
                "flask.current_app.config",
                {
                    "THUMBNAIL_EXECUTORS": [FixedExecutor(ADMIN_USERNAME)],
                },
            ),
            patch(
                "superset.thumbnails.digest._adjust_string_for_executor"
            ) as mock_adjust_string,
        ):
            mock_adjust_string.return_value = self.digest_return_value
            _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
            assert self.digest_hash in thumbnail_url
            assert mock_adjust_string.call_args[0][1] == ExecutorType.FIXED_USER
            assert mock_adjust_string.call_args[0][2] == ADMIN_USERNAME

            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 202

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_dashboard_screenshot_as_current_user(self):
        """
        Thumbnails: Simple get async dashboard screenshot as current user
        """
        username = "alpha"
        self.login(username)
        with (
            patch.dict(
                "flask.current_app.config",
                {
                    "THUMBNAIL_EXECUTORS": [ExecutorType.CURRENT_USER],
                },
            ),
            patch(
                "superset.thumbnails.digest._adjust_string_for_executor"
            ) as mock_adjust_string,
        ):
            mock_adjust_string.return_value = self.digest_return_value
            _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
            assert self.digest_hash in thumbnail_url
            assert mock_adjust_string.call_args[0][1] == ExecutorType.CURRENT_USER
            assert mock_adjust_string.call_args[0][2] == username

            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 202

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_dashboard_notfound(self):
        """
        Thumbnails: Simple get async dashboard not found
        """
        max_id = db.session.query(func.max(Dashboard.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/dashboard/{max_id + 1}/thumbnail/1234/"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @skipUnless((is_feature_enabled("THUMBNAILS")), "Thumbnails feature")
    def test_get_async_dashboard_created(self):
        """
        Thumbnails: Simple get async dashboard not allowed
        """
        self.login(ADMIN_USERNAME)
        _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
        rv = self.client.get(thumbnail_url)
        assert rv.status_code == 202

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_chart_screenshot_as_fixed_user(self):
        """
        Thumbnails: Simple get async chart screenshot as selenium user
        """
        self.login(ADMIN_USERNAME)
        with (
            patch.dict(
                "flask.current_app.config",
                {
                    "THUMBNAIL_EXECUTORS": [FixedExecutor(ADMIN_USERNAME)],
                },
            ),
            patch(
                "superset.thumbnails.digest._adjust_string_for_executor"
            ) as mock_adjust_string,
        ):
            mock_adjust_string.return_value = self.digest_return_value
            _, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
            assert self.digest_hash in thumbnail_url
            assert mock_adjust_string.call_args[0][1] == ExecutorType.FIXED_USER
            assert mock_adjust_string.call_args[0][2] == ADMIN_USERNAME

            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 202

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_chart_screenshot_as_current_user(self):
        """
        Thumbnails: Simple get async chart screenshot as current user
        """
        username = "alpha"
        self.login(username)
        with (
            patch.dict(
                "flask.current_app.config",
                {
                    "THUMBNAIL_EXECUTORS": [ExecutorType.CURRENT_USER],
                },
            ),
            patch(
                "superset.thumbnails.digest._adjust_string_for_executor"
            ) as mock_adjust_string,
        ):
            mock_adjust_string.return_value = self.digest_return_value
            _, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
            assert self.digest_hash in thumbnail_url
            assert mock_adjust_string.call_args[0][1] == ExecutorType.CURRENT_USER
            assert mock_adjust_string.call_args[0][2] == username

            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 202

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    @patch("superset.charts.api.cache_chart_thumbnail.delay")
    def test_chart_thumbnail_returns_404_when_chart_thumbnails_disabled(
        self, mock_delay
    ):
        self.login(ADMIN_USERNAME)
        with patch.dict(
            "flask.current_app.config",
            {"DISABLE_CHART_THUMBNAILS": True},
        ):
            _, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
            rv = self.client.get(thumbnail_url)

        assert rv.status_code == 404
        mock_delay.assert_not_called()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    @patch("superset.charts.api.cache_chart_thumbnail.delay")
    def test_chart_cache_screenshot_returns_404_when_chart_thumbnails_disabled(
        self, mock_delay
    ):
        self.login(ADMIN_USERNAME)
        with patch.dict(
            "flask.current_app.config",
            {"DISABLE_CHART_THUMBNAILS": True},
        ):
            chart_id, _ = self._get_id_and_thumbnail_url(CHART_URL)
            rv = self.client.get(
                f"{CHART_URL}{chart_id}/cache_screenshot/",
                query_string={"q": "(force:!f)"},
            )

        assert rv.status_code == 404
        mock_delay.assert_not_called()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    @patch("superset.dashboards.api.cache_dashboard_thumbnail.delay")
    @patch.object(
        DashboardScreenshot,
        "get_from_cache_key",
        return_value=ScreenshotCachePayload(),
    )
    def test_dashboard_thumbnail_still_triggers_async_when_chart_thumbnails_disabled(
        self, mock_get_from_cache_key, mock_delay
    ):
        self.login(ADMIN_USERNAME)
        with patch.dict(
            "flask.current_app.config",
            {"DISABLE_CHART_THUMBNAILS": True},
        ):
            _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
            rv = self.client.get(thumbnail_url)

        assert rv.status_code == 202
        mock_get_from_cache_key.assert_called()
        mock_delay.assert_called_once()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_async_chart_notfound(self):
        """
        Thumbnails: Simple get async chart not found
        """
        max_id = db.session.query(func.max(Slice.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{max_id + 1}/thumbnail/1234/"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_cached_chart_wrong_digest(self):
        """
        Thumbnails: Simple get chart with wrong digest
        """
        with patch.object(
            ChartScreenshot,
            "get_from_cache",
            return_value=ScreenshotCachePayload(self.mock_image),
        ):
            self.login(ADMIN_USERNAME)
            id_, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
            rv = self.client.get(f"api/v1/chart/{id_}/thumbnail/1234/")
            assert rv.status_code == 302
            assert rv.headers["Location"] == thumbnail_url

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_cached_dashboard_screenshot(self):
        """
        Thumbnails: Simple get cached dashboard screenshot
        """
        with patch.object(
            DashboardScreenshot,
            "get_from_cache_key",
            return_value=ScreenshotCachePayload(self.mock_image),
        ):
            self.login(ADMIN_USERNAME)
            _, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 200
            assert rv.data == self.mock_image

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_cached_chart_screenshot(self):
        """
        Thumbnails: Simple get cached chart screenshot
        """
        with patch.object(
            ChartScreenshot,
            "get_from_cache_key",
            return_value=ScreenshotCachePayload(self.mock_image),
        ):
            self.login(ADMIN_USERNAME)
            id_, thumbnail_url = self._get_id_and_thumbnail_url(CHART_URL)
            rv = self.client.get(thumbnail_url)
            assert rv.status_code == 200
            assert rv.data == self.mock_image

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @with_feature_flags(THUMBNAILS=True)
    def test_get_cached_dashboard_wrong_digest(self):
        """
        Thumbnails: Simple get dashboard with wrong digest
        """
        with patch.object(
            DashboardScreenshot,
            "get_from_cache",
            return_value=ScreenshotCachePayload(self.mock_image),
        ):
            self.login(ADMIN_USERNAME)
            id_, thumbnail_url = self._get_id_and_thumbnail_url(DASHBOARD_URL)
            rv = self.client.get(f"api/v1/dashboard/{id_}/thumbnail/1234/")
            assert rv.status_code == 302
            assert rv.headers["Location"] == thumbnail_url
