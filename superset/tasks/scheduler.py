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
from datetime import datetime, timezone
from typing import Any

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded
from celery.signals import task_failure
from flask import current_app

from superset import is_feature_enabled, security_manager
from superset.commands.exceptions import CommandException
from superset.commands.logs.prune import LogPruneCommand
from superset.commands.report.exceptions import ReportScheduleUnexpectedError
from superset.commands.report.execute import AsyncExecuteReportScheduleCommand
from superset.commands.report.log_prune import AsyncPruneReportScheduleLogCommand
from superset.commands.sql_lab.query import QueryPruneCommand
from superset.daos.report import ReportScheduleDAO
from superset.dashboards.welcome_top import (
    get_welcome_thumbnail_warmup_targets,
    refresh_welcome_dashboard_rankings,
)
from superset.extensions import celery_app
from superset.stats_logger import BaseStatsLogger
from superset.tasks.cron_util import cron_schedule_window
from superset.tasks.thumbnails import cache_dashboard_thumbnail
from superset.tasks.types import ExecutorType
from superset.utils.core import LoggerLevel, override_user
from superset.utils.log import get_logger_from_status
from superset.utils.screenshots import DashboardScreenshot, ScreenshotCachePayload
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)


def _uses_current_user_thumbnail_executor() -> bool:
    return any(
        executor == ExecutorType.CURRENT_USER
        for executor in current_app.config.get("THUMBNAIL_EXECUTORS", [])
    )


def _queue_dashboard_thumbnail_if_needed(
    dashboard_id: int,
    current_user: str | None = None,
) -> bool:
    # pylint: disable=import-outside-toplevel
    from superset.models.dashboard import Dashboard

    dashboard = Dashboard.get(dashboard_id)
    if not dashboard or not dashboard.published:
        return False

    user = None
    if current_user is not None:
        user = security_manager.find_user(current_user)
        if user is None:
            return False

    dashboard_url = get_url_path(
        "Superset.dashboard",
        dashboard_id_or_slug=dashboard.id,
    )
    with override_user(user):
        digest = dashboard.digest
        if digest is None:
            return False

        screenshot_obj = DashboardScreenshot(dashboard_url, digest)
        if not screenshot_obj.cache:
            return False
        cache_key = screenshot_obj.get_cache_key()
        cache_payload = (
            screenshot_obj.get_from_cache_key(cache_key) or ScreenshotCachePayload()
        )
        if not cache_payload.should_trigger_task():
            return False
        screenshot_obj.cache.set(cache_key, ScreenshotCachePayload().to_dict())

    cache_dashboard_thumbnail.delay(
        current_user=current_user,
        dashboard_id=dashboard.id,
        force=False,
        cache_key=cache_key,
    )
    return True


@task_failure.connect
def log_task_failure(  # pylint: disable=unused-argument
    sender: Task | None = None,
    task_id: str | None = None,
    exception: Exception | None = None,
    args: tuple[Any, ...] | None = None,
    kwargs: dict[str, Any] | None = None,
    traceback: Any = None,
    einfo: Any = None,
    **kw: Any,
) -> None:
    task_name = sender.name if sender else "Unknown"
    logger.exception("Celery task %s failed: %s", task_name, exception, exc_info=einfo)


@celery_app.task(
    name="reports.scheduler",
    bind=True,
    autoretry_for=(Exception,),
    retry_kwargs={
        "max_retries": 3,
        "countdown": 60,
    },  # Retry up to 3 times, wait 60s between
    retry_backoff=True,  # exponential backoff
)
def scheduler(self: Task) -> None:  # pylint: disable=unused-argument
    """
    Celery beat main scheduler for reports
    """
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.scheduler")

    if not is_feature_enabled("ALERT_REPORTS"):
        return
    active_schedules = ReportScheduleDAO.find_active()
    triggered_at = (
        datetime.fromisoformat(scheduler.request.expires)
        - current_app.config["CELERY_BEAT_SCHEDULER_EXPIRES"]
        if scheduler.request.expires
        else datetime.now(tz=timezone.utc)
    )
    for active_schedule in active_schedules:
        for schedule in cron_schedule_window(
            triggered_at, active_schedule.crontab, active_schedule.timezone
        ):
            logger.info("Scheduling alert %s eta: %s", active_schedule.name, schedule)
            async_options = {"eta": schedule}
            if (
                active_schedule.working_timeout is not None
                and current_app.config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"]
            ):
                async_options["time_limit"] = (
                    active_schedule.working_timeout
                    + current_app.config["ALERT_REPORTS_WORKING_TIME_OUT_LAG"]
                )
                async_options["soft_time_limit"] = (
                    active_schedule.working_timeout
                    + current_app.config["ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG"]
                )
            execute.apply_async((active_schedule.id,), **async_options)


@celery_app.task(name="reports.execute", bind=True)
def execute(self: Task, report_schedule_id: int) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.execute")

    task_id = None
    try:
        task_id = execute.request.id
        scheduled_dttm = execute.request.eta
        logger.info(
            "Executing alert/report, task id: %s, scheduled_dttm: %s",
            task_id,
            scheduled_dttm,
        )
        AsyncExecuteReportScheduleCommand(
            task_id,
            report_schedule_id,
            scheduled_dttm,
        ).run()
    except ReportScheduleUnexpectedError:
        logger.exception(
            "An unexpected error occurred while executing the report: %s", task_id
        )
        self.update_state(state="FAILURE")
    except CommandException as ex:
        logger_func, level = get_logger_from_status(ex.status)
        logger_func(
            f"A downstream {level} occurred "
            f"while generating a report: {task_id}. {ex.message}",
            exc_info=True,
        )
        if level == LoggerLevel.EXCEPTION:
            self.update_state(state="FAILURE")


@celery_app.task(name="reports.prune_log")
def prune_log() -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("reports.prune_log")

    try:
        AsyncPruneReportScheduleLogCommand().run()
    except SoftTimeLimitExceeded as ex:
        logger.warning("A timeout occurred while pruning report schedule logs: %s", ex)
    except CommandException:
        logger.exception("An exception occurred while pruning report schedule logs")


@celery_app.task(name="prune_query", bind=True)
def prune_query(
    self: Task, retention_period_days: int | None = None, **kwargs: Any
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_query")

    # TODO: Deprecated: Remove support for passing retention period via options in 6.0
    if retention_period_days is None:
        retention_period_days = prune_query.request.properties.get(
            "retention_period_days"
        )
        logger.warning(
            "Your `prune_query` beat schedule uses `options` to pass the retention "
            "period, please use `kwargs` instead."
        )

    try:
        QueryPruneCommand(retention_period_days).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning queries: %s", ex)


@celery_app.task(name="prune_logs", bind=True)
def prune_logs(
    self: Task, retention_period_days: int | None = None, **kwargs: Any
) -> None:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("prune_logs")

    # TODO: Deprecated: Remove support for passing retention period via options in 6.0
    if retention_period_days is None:
        retention_period_days = prune_logs.request.properties.get(
            "retention_period_days"
        )
        logger.warning(
            "Your `prune_logs` beat schedule uses `options` to pass the retention "
            "period, please use `kwargs` instead."
        )

    try:
        LogPruneCommand(retention_period_days).run()
    except CommandException as ex:
        logger.exception("An error occurred while pruning logs: %s", ex)


@celery_app.task(name="welcome_dashboard_top.refresh_snapshots")
def refresh_welcome_dashboard_snapshots(
    include_users: bool = True,
) -> dict[str, Any]:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("welcome_dashboard_top.refresh_snapshots")

    result = refresh_welcome_dashboard_rankings(include_users=include_users)
    logger.info("Refreshed welcome dashboard snapshots: %s", result)
    return result


@celery_app.task(name="welcome_dashboard_top.warmup_thumbnails")
def warmup_welcome_dashboard_thumbnails() -> dict[str, Any]:
    stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
    stats_logger.incr("welcome_dashboard_top.warmup_thumbnails")

    if not current_app.config.get("WELCOME_DASHBOARD_THUMBNAIL_WARMUP_ENABLED", False):
        result = {"status": "disabled"}
        logger.info("Skipped welcome dashboard thumbnail warm-up: %s", result)
        return result

    if not is_feature_enabled("THUMBNAILS"):
        result = {"status": "feature_flag_disabled"}
        logger.info("Skipped welcome dashboard thumbnail warm-up: %s", result)
        return result

    warmup_targets = get_welcome_thumbnail_warmup_targets()
    scheduled_count = 0
    skipped_count = 0
    error_count = 0

    if _uses_current_user_thumbnail_executor():
        users = warmup_targets["users"]
        for user_target in users:
            username = user_target["username"]
            for dashboard_id in user_target["dashboard_ids"]:
                try:
                    if _queue_dashboard_thumbnail_if_needed(
                        dashboard_id=dashboard_id,
                        current_user=username,
                    ):
                        scheduled_count += 1
                    else:
                        skipped_count += 1
                except Exception:  # pylint: disable=broad-except
                    error_count += 1
                    logger.exception(
                        "Failed to warm thumbnail for dashboard %s and user %s",
                        dashboard_id,
                        username,
                    )

        result = {
            "status": "completed",
            "mode": "current_user",
            "lookback_days": warmup_targets["lookback_days"],
            "warmup_limit": warmup_targets["warmup_limit"],
            "user_limit": warmup_targets["user_limit"],
            "user_count": len(users),
            "scheduled_count": scheduled_count,
            "skipped_count": skipped_count,
            "error_count": error_count,
        }
        logger.info("Warm-up welcome dashboard thumbnails: %s", result)
        return result

    dashboard_ids = warmup_targets["global_dashboard_ids"]
    for dashboard_id in dashboard_ids:
        try:
            if _queue_dashboard_thumbnail_if_needed(dashboard_id=dashboard_id):
                scheduled_count += 1
            else:
                skipped_count += 1
        except Exception:  # pylint: disable=broad-except
            error_count += 1
            logger.exception(
                "Failed to warm global thumbnail for dashboard %s",
                dashboard_id,
            )

    result = {
        "status": "completed",
        "mode": "shared",
        "lookback_days": warmup_targets["lookback_days"],
        "warmup_limit": warmup_targets["warmup_limit"],
        "dashboard_count": len(dashboard_ids),
        "scheduled_count": scheduled_count,
        "skipped_count": skipped_count,
        "error_count": error_count,
    }
    logger.info("Warm-up welcome dashboard thumbnails: %s", result)
    return result
