#
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

from datetime import datetime, time, timedelta
from typing import Any

from flask import current_app
from sqlalchemy import func

from superset import db
from superset.extensions import cache_manager
from superset.models.core import Log

MOUNT_DASHBOARD_EVENT = '"event_name": "mount_dashboard"'


def get_welcome_top_lookback_window(lookback_days: int) -> tuple[datetime, datetime]:
    today = datetime.utcnow().date()
    period_end = datetime.combine(today, time.min)
    period_start = period_end - timedelta(days=lookback_days)
    return period_start, period_end


def get_welcome_top_cache_backend_name() -> str:
    return cache_manager.cache.__class__.__name__


def is_welcome_top_cache_enabled() -> bool:
    return get_welcome_top_cache_backend_name() != "NullCache"


def get_welcome_top_cache_timeout() -> int:
    return int(
        current_app.config.get("WELCOME_DASHBOARD_TOP_CACHE_TIMEOUT", 24 * 60 * 60)
    )


def get_welcome_activity_cache_timeout() -> int:
    return int(
        current_app.config.get(
            "WELCOME_DASHBOARD_ACTIVITY_CACHE_TIMEOUT",
            get_welcome_top_cache_timeout(),
        )
    )


def get_welcome_top_cache_key(
    user_id: int | None,
    lookback_days: int,
    period_start: datetime,
    period_end: datetime,
    top_limit: int,
) -> str:
    return (
        "welcome_dashboard_top_ids:"
        f"{user_id if user_id is not None else 'global'}:"
        f"{top_limit}:"
        f"{lookback_days}:"
        f"{period_start.date().isoformat()}:"
        f"{(period_end - timedelta(days=1)).date().isoformat()}"
    )


def get_welcome_activity_cache_key(
    user_id: int,
    lookback_days: int,
    period_start: datetime,
    period_end: datetime,
) -> str:
    return (
        "welcome_dashboard_has_recent_views:"
        f"{user_id}:"
        f"{lookback_days}:"
        f"{period_start.date().isoformat()}:"
        f"{(period_end - timedelta(days=1)).date().isoformat()}"
    )


def get_cached_user_has_recent_views(
    user_id: int,
    *,
    force_refresh: bool = False,
) -> tuple[bool, int, str]:
    lookback_days = current_app.config["WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS"]
    period_start, period_end = get_welcome_top_lookback_window(lookback_days)
    cache_key = get_welcome_activity_cache_key(
        user_id, lookback_days, period_start, period_end
    )
    cache_enabled = is_welcome_top_cache_enabled()

    if cache_enabled and not force_refresh:
        cached_value = cache_manager.cache.get(cache_key)
        if cached_value is not None:
            return bool(cached_value), lookback_days, "hit"

    has_recent_views = (
        db.session.query(Log.id)
        .filter(
            Log.action == "log",
            Log.user_id == user_id,
            Log.dashboard_id.isnot(None),
            Log.dttm >= period_start,
            Log.dttm < period_end,
            Log.json.contains(MOUNT_DASHBOARD_EVENT),
        )
        .limit(1)
        .first()
        is not None
    )

    if cache_enabled:
        cache_manager.cache.set(
            cache_key,
            has_recent_views,
            timeout=get_welcome_activity_cache_timeout(),
        )
        return has_recent_views, lookback_days, "refresh" if force_refresh else "miss"

    return has_recent_views, lookback_days, "disabled"


def get_cached_top_dashboard_ids(
    user_id: int | None = None,
    *,
    force_refresh: bool = False,
) -> tuple[list[int], int, str]:
    lookback_days = current_app.config["WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS"]
    top_limit = current_app.config["WELCOME_DASHBOARD_TOP_LIMIT"]
    period_start, period_end = get_welcome_top_lookback_window(lookback_days)
    cache_key = get_welcome_top_cache_key(
        user_id,
        lookback_days,
        period_start,
        period_end,
        top_limit,
    )
    cache_enabled = is_welcome_top_cache_enabled()

    if cache_enabled and not force_refresh:
        cached_ids = cache_manager.cache.get(cache_key)
        if cached_ids is not None:
            return list(cached_ids), lookback_days, "hit"

    log_query = db.session.query(
        Log.dashboard_id.label("dashboard_id"),
        func.count(Log.id).label("view_count"),
        func.max(Log.dttm).label("last_viewed_at"),
    ).filter(
        Log.action == "log",
        Log.dashboard_id.isnot(None),
        Log.dttm >= period_start,
        Log.dttm < period_end,
        Log.json.contains(MOUNT_DASHBOARD_EVENT),
    )
    if user_id is not None:
        log_query = log_query.filter(Log.user_id == user_id)

    top_dashboard_ids = [
        dashboard_id
        for dashboard_id, _view_count, _last_viewed_at in (
            log_query.group_by(Log.dashboard_id)
            .order_by(
                func.count(Log.id).desc(),
                func.max(Log.dttm).desc(),
            )
            .limit(top_limit)
            .all()
        )
        if dashboard_id is not None
    ]

    if cache_enabled:
        cache_manager.cache.set(
            cache_key,
            top_dashboard_ids,
            timeout=get_welcome_top_cache_timeout(),
        )
        return top_dashboard_ids, lookback_days, "refresh" if force_refresh else "miss"

    return top_dashboard_ids, lookback_days, "disabled"


def warm_global_top_dashboard_ids(*, force_refresh: bool = True) -> dict[str, Any]:
    top_dashboard_ids, lookback_days, cache_status = get_cached_top_dashboard_ids(
        force_refresh=force_refresh
    )
    return {
        "backend": get_welcome_top_cache_backend_name(),
        "enabled": is_welcome_top_cache_enabled(),
        "global": cache_status,
        "lookback_days": lookback_days,
        "top_limit": current_app.config["WELCOME_DASHBOARD_TOP_LIMIT"],
        "dashboard_ids": top_dashboard_ids,
        "resolved_count": len(top_dashboard_ids),
    }
