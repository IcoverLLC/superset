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

from __future__ import annotations

import logging
import threading
import time
import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from io import BytesIO
from typing import Any

from flask import current_app

from superset import db, thumbnail_cache
from superset.exceptions import ScreenshotImageNotAvailableException
from superset.models.dashboard import Dashboard
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.utils.core import timeout
from superset.utils.screenshots import DashboardScreenshot, ScreenshotCachePayload

logger = logging.getLogger(__name__)

WELCOME_THUMBNAIL_CACHE_KEY_PREFIX = "welcome_dashboard_thumbnail"
WELCOME_THUMBNAIL_REFRESH_LOCK_KEY = "welcome_dashboard_thumbnail_refresh_lock"

DEFAULT_CACHE_TIMEOUT = 604800
DEFAULT_DASHBOARD_TIMEOUT = 300
DEFAULT_LOCK_TIMEOUT = 21600
LOCK_RENEWAL_GRACE_SECONDS = 60


class WelcomeThumbnailConfigurationError(RuntimeError):
    pass


class WelcomeThumbnailLockError(RuntimeError):
    pass


class WelcomeThumbnailRefreshError(RuntimeError):
    def __init__(self, result: dict[str, Any]):
        self.result = result
        super().__init__(
            "Welcome dashboard thumbnail refresh failed: "
            f"updated={result['updated']} failed={result['failed']}"
        )


class _WelcomeRefreshLease:
    def __init__(self, lock: Any):
        self._lock = lock

    def renew(self) -> None:
        try:
            renewed = self._lock.reacquire()
        except Exception as ex:  # pylint: disable=broad-except
            raise WelcomeThumbnailLockError(
                "Welcome dashboard thumbnail refresh lock ownership was lost"
            ) from ex
        if not renewed:
            raise WelcomeThumbnailLockError(
                "Welcome dashboard thumbnail refresh lock could not be renewed"
            )


def get_welcome_thumbnail_cache_key(dashboard_id: int) -> str:
    return f"{WELCOME_THUMBNAIL_CACHE_KEY_PREFIX}:{dashboard_id}"


def get_welcome_thumbnail(dashboard_id: int) -> BytesIO | None:
    payload = DashboardScreenshot.get_from_cache_key(
        get_welcome_thumbnail_cache_key(dashboard_id)
    )
    if payload is None:
        return None
    try:
        image = payload.get_image()
    except ScreenshotImageNotAvailableException:
        return None
    if image.getbuffer().nbytes == 0:
        return None
    image.seek(0)
    return image


def _get_published_dashboards(
    dashboard_ids: Sequence[int] | None,
) -> list[Dashboard]:
    query = db.session.query(Dashboard).filter(Dashboard.published.is_(True))
    if dashboard_ids is not None:
        unique_ids = list(dict.fromkeys(dashboard_ids))
        if not unique_ids:
            return []
        query = query.filter(Dashboard.id.in_(unique_ids))
    return query.order_by(Dashboard.id).all()


def _get_dashboard_timeout() -> int:
    return max(
        1,
        int(
            current_app.config.get(
                "WELCOME_DASHBOARD_THUMBNAIL_TIMEOUT",
                DEFAULT_DASHBOARD_TIMEOUT,
            )
        ),
    )


def _validate_timeout_execution_context() -> None:
    if threading.current_thread() is not threading.main_thread():
        raise WelcomeThumbnailConfigurationError(
            "Welcome thumbnail timeout requires a process main thread; "
            "use a prefork or solo Celery worker pool"
        )


def _create_redis_lock(lock_timeout: int) -> Any:
    try:
        backend = thumbnail_cache.cache
        client = getattr(backend, "_write_client", None)
        get_prefix = getattr(backend, "_get_prefix", None)
        if client is None or not hasattr(client, "lock") or not callable(get_prefix):
            raise WelcomeThumbnailConfigurationError(
                "WELCOME dashboard thumbnail refresh requires a shared Redis "
                "THUMBNAIL_CACHE_CONFIG"
            )
        return client.lock(
            name=f"{get_prefix()}{WELCOME_THUMBNAIL_REFRESH_LOCK_KEY}",
            timeout=lock_timeout,
            blocking=False,
        )
    except WelcomeThumbnailConfigurationError:
        raise
    except Exception as ex:  # pylint: disable=broad-except
        raise WelcomeThumbnailLockError(
            "Failed to initialize welcome dashboard thumbnail refresh lock"
        ) from ex


@contextmanager
def _welcome_refresh_lock() -> Iterator[_WelcomeRefreshLease | None]:
    dashboard_timeout = _get_dashboard_timeout()
    lock_timeout = max(
        int(
            current_app.config.get(
                "WELCOME_DASHBOARD_THUMBNAIL_LOCK_TIMEOUT",
                DEFAULT_LOCK_TIMEOUT,
            )
        ),
        dashboard_timeout + LOCK_RENEWAL_GRACE_SECONDS,
    )
    lock = _create_redis_lock(lock_timeout)
    try:
        acquired = bool(lock.acquire(blocking=False))
    except Exception as ex:  # pylint: disable=broad-except
        raise WelcomeThumbnailLockError(
            "Failed to acquire welcome dashboard thumbnail refresh lock"
        ) from ex

    lease = _WelcomeRefreshLease(lock) if acquired else None

    try:
        yield lease
    finally:
        if acquired:
            try:
                lock.release()
            except Exception as ex:  # pylint: disable=broad-except
                raise WelcomeThumbnailLockError(
                    "Failed to release welcome dashboard thumbnail refresh lock"
                ) from ex


def _refresh_dashboard_thumbnail(
    dashboard: Dashboard,
    lease: _WelcomeRefreshLease,
) -> None:
    dashboard_timeout = _get_dashboard_timeout()
    cache_timeout = max(
        1,
        int(
            current_app.config.get(
                "WELCOME_DASHBOARD_THUMBNAIL_CACHE_TIMEOUT",
                DEFAULT_CACHE_TIMEOUT,
            )
        ),
    )
    temporary_key = (
        f"{get_welcome_thumbnail_cache_key(dashboard.id)}:refresh:{uuid.uuid4().hex}"
    )

    try:
        with timeout(
            seconds=dashboard_timeout,
            error_message=(
                "Welcome dashboard thumbnail generation timed out "
                f"for dashboard {dashboard.id}"
            ),
        ):
            cache_dashboard_thumbnail.run(
                current_user=None,
                dashboard_id=dashboard.id,
                force=True,
                cache_key=temporary_key,
            )

        temporary_payload = DashboardScreenshot.get_from_cache_key(temporary_key)
        if temporary_payload is None:
            raise RuntimeError("Screenshot generation did not create a cache payload")
        image = temporary_payload.get_image().getvalue()
        if not image:
            raise RuntimeError("Screenshot generation returned an empty image")

        # Renew immediately before publishing so a stale worker that lost the
        # lease cannot replace a newer batch's stable image.
        lease.renew()
        payload = ScreenshotCachePayload(image)
        cached = thumbnail_cache.set(
            get_welcome_thumbnail_cache_key(dashboard.id),
            payload.to_dict(),
            timeout=cache_timeout,
        )
        if cached is False:
            raise RuntimeError("Welcome dashboard thumbnail cache write failed")
    finally:
        try:
            thumbnail_cache.delete(temporary_key)
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Failed to delete temporary welcome thumbnail cache key %s",
                temporary_key,
                exc_info=True,
            )


def refresh_welcome_dashboard_thumbnails(
    dashboard_ids: Sequence[int] | None = None,
) -> dict[str, Any]:
    started_at = time.monotonic()
    dashboards = _get_published_dashboards(dashboard_ids)
    _validate_timeout_execution_context()
    with _welcome_refresh_lock() as lease:
        if lease is None:
            logger.info(
                "Skipping welcome dashboard thumbnail refresh: "
                "refresh lock is already held"
            )
            return {
                "status": "skipped_locked",
                "total": 0,
                "updated": 0,
                "failed": 0,
                "duration": time.monotonic() - started_at,
            }
        result = _run_refresh(dashboards, started_at, lease)
    if result["failed"]:
        raise WelcomeThumbnailRefreshError(result)
    return result


def _run_refresh(
    dashboards: Sequence[Dashboard],
    started_at: float,
    lease: _WelcomeRefreshLease,
) -> dict[str, Any]:
    logger.info(
        "Starting welcome dashboard thumbnail refresh: dashboards=%s",
        len(dashboards),
    )

    updated = 0
    failed = 0
    for dashboard in dashboards:
        dashboard_started_at = time.monotonic()
        try:
            lease.renew()
            _refresh_dashboard_thumbnail(dashboard, lease)
            updated += 1
            logger.info(
                "dashboard=%s status=updated duration=%.3f",
                dashboard.id,
                time.monotonic() - dashboard_started_at,
            )
        except WelcomeThumbnailLockError:
            raise
        except Exception as ex:  # pylint: disable=broad-except
            failed += 1
            logger.exception(
                "dashboard=%s status=failed duration=%.3f error=%s",
                dashboard.id,
                time.monotonic() - dashboard_started_at,
                ex,
            )

    duration = time.monotonic() - started_at
    logger.info(
        "Finished welcome dashboard thumbnail refresh: "
        "total=%s updated=%s failed=%s duration=%.3f",
        len(dashboards),
        updated,
        failed,
        duration,
    )
    return {
        "status": "completed",
        "total": len(dashboards),
        "updated": updated,
        "failed": failed,
        "duration": duration,
    }
