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

import click
from flask.cli import with_appcontext

from superset.dashboards.welcome_thumbnails import (
    refresh_welcome_dashboard_thumbnails,
    WelcomeThumbnailConfigurationError,
    WelcomeThumbnailLockError,
    WelcomeThumbnailRefreshError,
)


@click.command("refresh-welcome-thumbnails")
@click.option(
    "--dashboard-id",
    type=int,
    multiple=True,
    help="Refresh only the specified published dashboard. May be repeated.",
)
@with_appcontext
def refresh_welcome_thumbnails(dashboard_id: tuple[int, ...]) -> None:
    """Refresh cached thumbnails used by the welcome dashboard catalogue."""
    try:
        result = refresh_welcome_dashboard_thumbnails(
            list(dashboard_id) if dashboard_id else None
        )
    except WelcomeThumbnailRefreshError as ex:
        result = ex.result
        raise click.ClickException(
            "Refresh completed with errors: "
            f"total={result['total']} updated={result['updated']} "
            f"failed={result['failed']} duration={result['duration']:.3f}s"
        ) from ex
    except (WelcomeThumbnailConfigurationError, WelcomeThumbnailLockError) as ex:
        raise click.ClickException(str(ex)) from ex
    if result["status"] == "skipped_locked":
        click.secho(
            "Skipped: another welcome thumbnail refresh is running.",
            fg="yellow",
        )
        return
    click.secho(
        "Finished: "
        f"total={result['total']} updated={result['updated']} "
        f"failed={result['failed']} duration={result['duration']:.3f}s",
        fg="green" if result["failed"] == 0 else "yellow",
    )
