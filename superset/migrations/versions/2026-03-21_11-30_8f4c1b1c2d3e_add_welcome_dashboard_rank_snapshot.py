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
"""Add welcome dashboard rank snapshot table

Revision ID: 8f4c1b1c2d3e
Revises: 4b2a8c9d3e1f
Create Date: 2026-03-21 11:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8f4c1b1c2d3e"
down_revision = "4b2a8c9d3e1f"


def upgrade():
    op.create_table(
        "welcome_dashboard_rank",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("partition_key", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("view_count", sa.Integer(), nullable=False),
        sa.Column("last_viewed_at", sa.DateTime(), nullable=True),
        sa.Column("lookback_days", sa.Integer(), nullable=False),
        sa.Column("window_start", sa.DateTime(), nullable=False),
        sa.Column("window_end", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["dashboard_id"],
            ["dashboards.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["ab_user.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "partition_key",
            "lookback_days",
            "rank",
            name="uq_welcome_dashboard_rank_partition_rank",
        ),
        sa.UniqueConstraint(
            "partition_key",
            "lookback_days",
            "dashboard_id",
            name="uq_welcome_dashboard_rank_partition_dashboard",
        ),
    )
    op.create_index(
        "ix_welcome_dashboard_rank_partition_lookup",
        "welcome_dashboard_rank",
        ["partition_key", "lookback_days", "rank"],
        unique=False,
    )
    op.create_index(
        "ix_welcome_dashboard_rank_user_lookup",
        "welcome_dashboard_rank",
        ["user_id", "lookback_days"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_welcome_dashboard_rank_user_lookup",
        table_name="welcome_dashboard_rank",
    )
    op.drop_index(
        "ix_welcome_dashboard_rank_partition_lookup",
        table_name="welcome_dashboard_rank",
    )
    op.drop_table("welcome_dashboard_rank")
