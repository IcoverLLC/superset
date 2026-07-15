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

from collections import defaultdict
from datetime import datetime, time, timedelta
from typing import Any

from flask import current_app
from sqlalchemy import func

from superset import db
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.models.welcome_dashboard_rank import WelcomeDashboardRank

MOUNT_DASHBOARD_EVENT = '"event_name": "mount_dashboard"'
GLOBAL_PARTITION_KEY = "global"
MOSCOW_OFFSET = timedelta(hours=3)


def get_welcome_top_lookback_window(lookback_days: int) -> tuple[datetime, datetime]:
    today = datetime.utcnow().date()
    period_end = datetime.combine(today, time.min)
    period_start = period_end - timedelta(days=lookback_days)
    return period_start, period_end


def get_welcome_top_storage_name() -> str:
    return "metadata_table"


def get_welcome_snapshot_limit() -> int:
    configured_limit = current_app.config.get("WELCOME_DASHBOARD_TOP_SNAPSHOT_LIMIT")
    top_limit = int(current_app.config["WELCOME_DASHBOARD_TOP_LIMIT"])
    if configured_limit is None:
        return max(50, top_limit * 5)
    return max(top_limit, int(configured_limit))


def get_welcome_rank_partition_key(user_id: int | None) -> str:
    return GLOBAL_PARTITION_KEY if user_id is None else f"user:{user_id}"


def _to_moscow_iso(dt: datetime) -> str:
    return (dt + MOSCOW_OFFSET).isoformat()


def _base_log_query(
    period_start: datetime,
    period_end: datetime,
) -> Any:
    return db.session.query(
        Log.dashboard_id.label("dashboard_id"),
        func.count(Log.id).label("view_count"),
        func.max(Log.dttm).label("last_viewed_at"),
    ).join(
        Dashboard,
        Dashboard.id == Log.dashboard_id,
    ).filter(
        Log.action == "log",
        Log.dashboard_id.isnot(None),
        Log.dttm >= period_start,
        Log.dttm < period_end,
        Log.json.contains(MOUNT_DASHBOARD_EVENT),
        Dashboard.published.is_(True),
    )


def _snapshot_row(
    *,
    partition_key: str,
    user_id: int | None,
    dashboard_id: int,
    rank: int,
    view_count: int,
    last_viewed_at: datetime | None,
    lookback_days: int,
    window_start: datetime,
    window_end: datetime,
) -> dict[str, Any]:
    return {
        "partition_key": partition_key,
        "user_id": user_id,
        "dashboard_id": dashboard_id,
        "rank": rank,
        "view_count": int(view_count),
        "last_viewed_at": last_viewed_at,
        "lookback_days": lookback_days,
        "window_start": window_start,
        "window_end": window_end,
        "updated_at": datetime.utcnow(),
    }


def _build_global_snapshot_rows(
    lookback_days: int,
    snapshot_limit: int,
    window_start: datetime,
    window_end: datetime,
) -> list[dict[str, Any]]:
    rows = (
        _base_log_query(window_start, window_end)
        .group_by(Log.dashboard_id)
        .order_by(
            func.count(Log.id).desc(),
            func.max(Log.dttm).desc(),
            Log.dashboard_id.asc(),
        )
        .limit(snapshot_limit)
        .all()
    )
    return [
        _snapshot_row(
            partition_key=GLOBAL_PARTITION_KEY,
            user_id=None,
            dashboard_id=dashboard_id,
            rank=index,
            view_count=view_count,
            last_viewed_at=last_viewed_at,
            lookback_days=lookback_days,
            window_start=window_start,
            window_end=window_end,
        )
        for index, (dashboard_id, view_count, last_viewed_at) in enumerate(rows, start=1)
        if dashboard_id is not None
    ]


def _build_user_snapshot_rows(
    user_id: int,
    lookback_days: int,
    snapshot_limit: int,
    window_start: datetime,
    window_end: datetime,
) -> list[dict[str, Any]]:
    rows = (
        _base_log_query(window_start, window_end)
        .add_columns(Log.user_id.label("user_id"))
        .filter(Log.user_id == user_id)
        .group_by(Log.user_id, Log.dashboard_id)
        .order_by(
            func.count(Log.id).desc(),
            func.max(Log.dttm).desc(),
            Log.dashboard_id.asc(),
        )
        .limit(snapshot_limit)
        .all()
    )
    partition_key = get_welcome_rank_partition_key(user_id)
    return [
        _snapshot_row(
            partition_key=partition_key,
            user_id=user_id,
            dashboard_id=dashboard_id,
            rank=index,
            view_count=view_count,
            last_viewed_at=last_viewed_at,
            lookback_days=lookback_days,
            window_start=window_start,
            window_end=window_end,
        )
        for index, (dashboard_id, view_count, last_viewed_at, _user_id) in enumerate(
            rows, start=1
        )
        if dashboard_id is not None
    ]


def _build_all_user_snapshot_rows(
    lookback_days: int,
    snapshot_limit: int,
    window_start: datetime,
    window_end: datetime,
) -> list[dict[str, Any]]:
    rows = (
        db.session.query(
            Log.user_id.label("user_id"),
            Log.dashboard_id.label("dashboard_id"),
            func.count(Log.id).label("view_count"),
            func.max(Log.dttm).label("last_viewed_at"),
        )
        .join(
            Dashboard,
            Dashboard.id == Log.dashboard_id,
        )
        .filter(
            Log.action == "log",
            Log.user_id.isnot(None),
            Log.dashboard_id.isnot(None),
            Log.dttm >= window_start,
            Log.dttm < window_end,
            Log.json.contains(MOUNT_DASHBOARD_EVENT),
            Dashboard.published.is_(True),
        )
        .group_by(Log.user_id, Log.dashboard_id)
        .order_by(
            Log.user_id.asc(),
            func.count(Log.id).desc(),
            func.max(Log.dttm).desc(),
            Log.dashboard_id.asc(),
        )
        .all()
    )

    per_user_rank: dict[int, int] = defaultdict(int)
    snapshot_rows: list[dict[str, Any]] = []
    for user_id, dashboard_id, view_count, last_viewed_at in rows:
        if user_id is None or dashboard_id is None:
            continue
        next_rank = per_user_rank[user_id] + 1
        if next_rank > snapshot_limit:
            continue
        per_user_rank[user_id] = next_rank
        snapshot_rows.append(
            _snapshot_row(
                partition_key=get_welcome_rank_partition_key(user_id),
                user_id=user_id,
                dashboard_id=dashboard_id,
                rank=next_rank,
                view_count=view_count,
                last_viewed_at=last_viewed_at,
                lookback_days=lookback_days,
                window_start=window_start,
                window_end=window_end,
            )
        )
    return snapshot_rows


def _replace_snapshot_partition(
    *,
    partition_key: str,
    lookback_days: int,
    rows: list[dict[str, Any]],
) -> None:
    try:
        (
            db.session.query(WelcomeDashboardRank)
            .filter(
                WelcomeDashboardRank.partition_key == partition_key,
                WelcomeDashboardRank.lookback_days == lookback_days,
            )
            .delete(synchronize_session=False)
        )
        if rows:
            db.session.bulk_insert_mappings(WelcomeDashboardRank, rows)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def _replace_all_snapshot_rows(
    *,
    lookback_days: int,
    rows: list[dict[str, Any]],
) -> None:
    try:
        (
            db.session.query(WelcomeDashboardRank)
            .filter(WelcomeDashboardRank.lookback_days == lookback_days)
            .delete(synchronize_session=False)
        )
        if rows:
            db.session.bulk_insert_mappings(WelcomeDashboardRank, rows)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def refresh_welcome_dashboard_rankings(
    *,
    user_id: int | None = None,
    include_users: bool = False,
) -> dict[str, Any]:
    lookback_days = int(current_app.config["WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS"])
    snapshot_limit = get_welcome_snapshot_limit()
    window_start, window_end = get_welcome_top_lookback_window(lookback_days)

    if include_users:
        global_rows = _build_global_snapshot_rows(
            lookback_days,
            snapshot_limit,
            window_start,
            window_end,
        )
        user_rows = _build_all_user_snapshot_rows(
            lookback_days,
            snapshot_limit,
            window_start,
            window_end,
        )
        all_rows = global_rows + user_rows
        _replace_all_snapshot_rows(lookback_days=lookback_days, rows=all_rows)
        return {
            "storage": get_welcome_top_storage_name(),
            "mode": "full_refresh",
            "lookback_days": lookback_days,
            "snapshot_limit": snapshot_limit,
            "global_count": len(global_rows),
            "user_count": len(user_rows),
            "updated_count": len(all_rows),
        }

    if user_id is None:
        rows = _build_global_snapshot_rows(
            lookback_days,
            snapshot_limit,
            window_start,
            window_end,
        )
        _replace_snapshot_partition(
            partition_key=GLOBAL_PARTITION_KEY,
            lookback_days=lookback_days,
            rows=rows,
        )
        return {
            "storage": get_welcome_top_storage_name(),
            "mode": "global_refresh",
            "lookback_days": lookback_days,
            "snapshot_limit": snapshot_limit,
            "dashboard_ids": [row["dashboard_id"] for row in rows],
            "updated_count": len(rows),
        }

    rows = _build_user_snapshot_rows(
        user_id,
        lookback_days,
        snapshot_limit,
        window_start,
        window_end,
    )
    _replace_snapshot_partition(
        partition_key=get_welcome_rank_partition_key(user_id),
        lookback_days=lookback_days,
        rows=rows,
    )
    return {
        "storage": get_welcome_top_storage_name(),
        "mode": "user_refresh",
        "lookback_days": lookback_days,
        "snapshot_limit": snapshot_limit,
        "user_id": user_id,
        "dashboard_ids": [row["dashboard_id"] for row in rows],
        "updated_count": len(rows),
    }


def get_welcome_snapshot_dashboard_ids(
    user_id: int | None = None,
) -> tuple[list[int], int, str]:
    lookback_days = int(current_app.config["WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS"])
    snapshot_limit = get_welcome_snapshot_limit()
    partition_key = get_welcome_rank_partition_key(user_id)

    rows = (
        db.session.query(WelcomeDashboardRank.dashboard_id)
        .filter(
            WelcomeDashboardRank.partition_key == partition_key,
            WelcomeDashboardRank.lookback_days == lookback_days,
        )
        .order_by(WelcomeDashboardRank.rank.asc())
        .limit(snapshot_limit)
        .all()
    )
    dashboard_ids = [dashboard_id for dashboard_id, in rows if dashboard_id is not None]
    return dashboard_ids, lookback_days, "snapshot" if dashboard_ids else "missing"


def get_welcome_snapshot_recently_viewed_at(
    dashboard_ids: list[int],
    user_id: int | None = None,
) -> dict[str, str]:
    if user_id is None or not dashboard_ids:
        return {}

    lookback_days = int(current_app.config["WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS"])
    partition_key = get_welcome_rank_partition_key(user_id)
    rows = (
        db.session.query(
            WelcomeDashboardRank.dashboard_id,
            WelcomeDashboardRank.last_viewed_at,
        )
        .filter(
            WelcomeDashboardRank.partition_key == partition_key,
            WelcomeDashboardRank.lookback_days == lookback_days,
            WelcomeDashboardRank.dashboard_id.in_(dashboard_ids),
        )
        .order_by(WelcomeDashboardRank.rank.asc())
        .all()
    )
    return {
        str(dashboard_id): _to_moscow_iso(last_viewed_at)
        for dashboard_id, last_viewed_at in rows
        if dashboard_id is not None and last_viewed_at is not None
    }
