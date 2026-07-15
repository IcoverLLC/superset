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

from datetime import datetime

import sqlalchemy as sqla
from flask_appbuilder import Model
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship


class WelcomeDashboardRank(Model):
    """
    Snapshot table for welcome-page dashboard ranking.

    partition_key keeps uniqueness stable for both global and user-specific rows.
    """

    __tablename__ = "welcome_dashboard_rank"
    __table_args__ = (
        UniqueConstraint(
            "partition_key",
            "lookback_days",
            "rank",
            name="uq_welcome_dashboard_rank_partition_rank",
        ),
        UniqueConstraint(
            "partition_key",
            "lookback_days",
            "dashboard_id",
            name="uq_welcome_dashboard_rank_partition_dashboard",
        ),
        sqla.Index(
            "ix_welcome_dashboard_rank_partition_lookup",
            "partition_key",
            "lookback_days",
            "rank",
        ),
        sqla.Index(
            "ix_welcome_dashboard_rank_user_lookup",
            "user_id",
            "lookback_days",
        ),
    )

    id = Column(Integer, primary_key=True)
    partition_key = Column(String(64), nullable=False)
    user_id = Column(Integer, ForeignKey("ab_user.id", ondelete="CASCADE"))
    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    )
    rank = Column(Integer, nullable=False)
    view_count = Column(Integer, nullable=False, default=0)
    last_viewed_at = Column(DateTime)
    lookback_days = Column(Integer, nullable=False)
    window_start = Column(DateTime, nullable=False)
    window_end = Column(DateTime, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = relationship(User, foreign_keys=[user_id])
    dashboard = relationship("Dashboard", foreign_keys=[dashboard_id])
