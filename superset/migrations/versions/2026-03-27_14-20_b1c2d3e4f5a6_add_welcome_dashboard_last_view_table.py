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
"""Add welcome dashboard last-view table

Revision ID: b1c2d3e4f5a6
Revises: 8f4c1b1c2d3e
Create Date: 2026-03-27 14:20:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "b1c2d3e4f5a6"
down_revision = "8f4c1b1c2d3e"


def upgrade():
    op.create_table(
        "welcome_dashboard_last_view",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("last_viewed_at", sa.DateTime(), nullable=False),
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
            "user_id",
            "dashboard_id",
            name="uq_welcome_dashboard_last_view_user_dashboard",
        ),
    )
    op.create_index(
        "ix_welcome_dashboard_last_view_user_dashboard",
        "welcome_dashboard_last_view",
        ["user_id", "dashboard_id"],
        unique=False,
    )
    op.create_index(
        "ix_welcome_dashboard_last_view_user_last_viewed_at",
        "welcome_dashboard_last_view",
        ["user_id", "last_viewed_at"],
        unique=False,
    )


def downgrade():
    op.drop_index(
        "ix_welcome_dashboard_last_view_user_last_viewed_at",
        table_name="welcome_dashboard_last_view",
    )
    op.drop_index(
        "ix_welcome_dashboard_last_view_user_dashboard",
        table_name="welcome_dashboard_last_view",
    )
    op.drop_table("welcome_dashboard_last_view")
