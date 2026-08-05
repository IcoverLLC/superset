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

from contextlib import nullcontext
from unittest.mock import call, MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.dashboards import welcome_thumbnails
from superset.exceptions import ScreenshotImageNotAvailableException
from superset.utils.screenshots import ScreenshotCachePayload


def test_welcome_thumbnail_cache_hit_and_miss(mocker: MockerFixture) -> None:
    get_payload = mocker.patch.object(
        welcome_thumbnails.DashboardScreenshot,
        "get_from_cache_key",
        side_effect=[ScreenshotCachePayload(b"image"), None],
    )

    image = welcome_thumbnails.get_welcome_thumbnail(11)

    assert image is not None
    assert image.read() == b"image"
    assert welcome_thumbnails.get_welcome_thumbnail(12) is None
    assert get_payload.call_args_list == [
        call("welcome_dashboard_thumbnail:11"),
        call("welcome_dashboard_thumbnail:12"),
    ]


def test_dashboard_selection_filters_published_and_requested_ids(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    query = MagicMock()
    query.filter.return_value = query
    query.order_by.return_value = query
    dashboards = [MagicMock(id=2)]
    query.all.return_value = dashboards
    mocker.patch.object(
        welcome_thumbnails.db.session,
        "query",
        return_value=query,
    )

    result = welcome_thumbnails._get_published_dashboards([2, 2, 7])

    assert result == dashboards
    assert "published IS true" in str(query.filter.call_args_list[0].args[0])
    assert "id IN" in str(query.filter.call_args_list[1].args[0])


def test_refresh_is_sequential_and_continues_after_failure(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    dashboards = [MagicMock(id=1), MagicMock(id=2), MagicMock(id=3)]
    mocker.patch.object(
        welcome_thumbnails,
        "_get_published_dashboards",
        return_value=dashboards,
    )
    refresh_one = mocker.patch.object(
        welcome_thumbnails,
        "_refresh_dashboard_thumbnail",
        side_effect=[None, RuntimeError("failed"), None],
    )
    lease = MagicMock()
    mocker.patch.object(
        welcome_thumbnails,
        "_welcome_refresh_lock",
        return_value=nullcontext(lease),
    )

    with pytest.raises(welcome_thumbnails.WelcomeThumbnailRefreshError) as error:
        welcome_thumbnails.refresh_welcome_dashboard_thumbnails([1, 2, 3])

    assert refresh_one.call_args_list == [
        call(dashboards[0], lease),
        call(dashboards[1], lease),
        call(dashboards[2], lease),
    ]
    result = error.value.result
    assert result["total"] == 3
    assert result["updated"] == 2
    assert result["failed"] == 1
    assert lease.renew.call_count == 3


def test_full_refresh_skips_when_lock_is_held(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(
        welcome_thumbnails,
        "_welcome_refresh_lock",
        return_value=nullcontext(None),
    )
    mocker.patch.object(
        welcome_thumbnails,
        "_get_published_dashboards",
        return_value=[MagicMock(id=1)],
    )
    run_refresh = mocker.patch.object(welcome_thumbnails, "_run_refresh")

    result = welcome_thumbnails.refresh_welcome_dashboard_thumbnails()

    assert result["status"] == "skipped_locked"
    run_refresh.assert_not_called()


def test_refresh_failure_does_not_replace_stable_cache(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    dashboard = MagicMock(id=7)
    lease = MagicMock()
    mocker.patch.object(
        welcome_thumbnails.uuid,
        "uuid4",
        return_value=MagicMock(hex="fixed"),
    )
    mocker.patch.object(
        welcome_thumbnails.DashboardScreenshot,
        "get_from_cache_key",
        return_value=ScreenshotCachePayload(),
    )
    compute = mocker.patch.object(
        welcome_thumbnails.cache_dashboard_thumbnail,
        "run",
    )
    cache_set = mocker.patch.object(welcome_thumbnails.thumbnail_cache, "set")
    cache_delete = mocker.patch.object(welcome_thumbnails.thumbnail_cache, "delete")

    with pytest.raises(ScreenshotImageNotAvailableException):
        welcome_thumbnails._refresh_dashboard_thumbnail(dashboard, lease)

    compute.assert_called_once_with(
        current_user=None,
        dashboard_id=7,
        force=True,
        cache_key="welcome_dashboard_thumbnail:7:refresh:fixed",
    )
    cache_set.assert_not_called()
    cache_delete.assert_called_once_with(
        "welcome_dashboard_thumbnail:7:refresh:fixed"
    )
    lease.renew.assert_not_called()


def test_success_replaces_stable_cache_with_configured_ttl(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    dashboard = MagicMock(id=9)
    lease = MagicMock()
    mocker.patch.dict(
        welcome_thumbnails.current_app.config,
        {
            "WELCOME_DASHBOARD_THUMBNAIL_TIMEOUT": 42,
            "WELCOME_DASHBOARD_THUMBNAIL_CACHE_TIMEOUT": 123,
        },
    )
    mocker.patch.object(
        welcome_thumbnails.DashboardScreenshot,
        "get_from_cache_key",
        return_value=ScreenshotCachePayload(b"new-image"),
    )
    compute = mocker.patch.object(
        welcome_thumbnails.cache_dashboard_thumbnail,
        "run",
    )
    cache_set = mocker.patch.object(
        welcome_thumbnails.thumbnail_cache,
        "set",
        return_value=True,
    )
    mocker.patch.object(welcome_thumbnails.thumbnail_cache, "delete")

    welcome_thumbnails._refresh_dashboard_thumbnail(dashboard, lease)

    compute.assert_called_once_with(
        current_user=None,
        dashboard_id=9,
        force=True,
        cache_key=compute.call_args.kwargs["cache_key"],
    )
    assert compute.call_args.kwargs["cache_key"].startswith(
        "welcome_dashboard_thumbnail:9:refresh:"
    )
    args, kwargs = cache_set.call_args
    assert args[0] == "welcome_dashboard_thumbnail:9"
    assert (
        ScreenshotCachePayload.from_dict(args[1]).get_image().read() == b"new-image"
    )
    assert kwargs["timeout"] == 123
    lease.renew.assert_called_once_with()


def test_refresh_lock_uses_native_redis_lease_and_releases_it(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    lock = MagicMock()
    lock.acquire.return_value = True
    lock.reacquire.return_value = True
    create_lock = mocker.patch.object(
        welcome_thumbnails,
        "_create_redis_lock",
        return_value=lock,
    )

    with welcome_thumbnails._welcome_refresh_lock() as lease:
        assert lease is not None
        lease.renew()

    assert create_lock.call_args.args[0] >= (
        welcome_thumbnails.DEFAULT_DASHBOARD_TIMEOUT
        + welcome_thumbnails.LOCK_RENEWAL_GRACE_SECONDS
    )
    lock.acquire.assert_called_once_with(blocking=False)
    lock.reacquire.assert_called_once_with()
    lock.release.assert_called_once_with()


def test_native_redis_lock_uses_cache_prefix(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    lock = MagicMock()
    backend = MagicMock()
    backend._get_prefix.return_value = "superset:"
    backend._write_client.lock.return_value = lock
    cache = MagicMock(cache=backend)
    mocker.patch.object(welcome_thumbnails, "thumbnail_cache", cache)

    result = welcome_thumbnails._create_redis_lock(600)

    assert result is lock
    backend._write_client.lock.assert_called_once_with(
        name="superset:welcome_dashboard_thumbnail_refresh_lock",
        timeout=600,
        blocking=False,
    )


def test_held_native_redis_lock_is_not_released(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    lock = MagicMock()
    lock.acquire.return_value = False
    mocker.patch.object(
        welcome_thumbnails,
        "_create_redis_lock",
        return_value=lock,
    )

    with welcome_thumbnails._welcome_refresh_lock() as lease:
        assert lease is None

    lock.release.assert_not_called()


def test_celery_task_name_and_delegation(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    from superset.tasks import scheduler

    result = {
        "status": "completed",
        "total": 1,
        "updated": 1,
        "failed": 0,
        "duration": 1.0,
    }
    refresh = mocker.patch.object(
        scheduler,
        "refresh_welcome_dashboard_thumbnails",
        return_value=result,
    )

    assert scheduler.refresh_welcome_dashboard_thumbnails_task.name == (
        "welcome_dashboard_top.refresh_thumbnails"
    )
    assert scheduler.refresh_welcome_dashboard_thumbnails_task.run() == result
    refresh.assert_called_once_with()
