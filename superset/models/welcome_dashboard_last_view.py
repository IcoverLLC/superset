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
from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship


class WelcomeDashboardLastView(Model):
    """Latest dashboard view timestamp per user/dashboard pair."""

    __tablename__ = "welcome_dashboard_last_view"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "dashboard_id",
            name="uq_welcome_dashboard_last_view_user_dashboard",
        ),
        sqla.Index(
            "ix_welcome_dashboard_last_view_user_dashboard",
            "user_id",
            "dashboard_id",
        ),
        sqla.Index(
            "ix_welcome_dashboard_last_view_user_last_viewed_at",
            "user_id",
            "last_viewed_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer,
        ForeignKey("ab_user.id", ondelete="CASCADE"),
        nullable=False,
    )
    dashboard_id = Column(
        Integer,
        ForeignKey("dashboards.id", ondelete="CASCADE"),
        nullable=False,
    )
    last_viewed_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    user = relationship(User, foreign_keys=[user_id])
    dashboard = relationship("Dashboard", foreign_keys=[dashboard_id])
