/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  getItem,
  LocalStorageKeys,
  setItem,
} from 'src/utils/localStorageHelpers';
import { LayoutItem } from '../types';
import { ROW_TYPE } from './componentTypes';

type CollapsedRowsState = Record<string, Record<string, boolean>>;

const getDashboardKey = (dashboardId?: number | string) =>
  String(dashboardId ?? '');

export const isCollapsibleRow = (component?: LayoutItem) =>
  component?.type === ROW_TYPE && Boolean(component?.meta?.enableCollapse);

export const getCollapsedRowsForDashboard = (
  dashboardId?: number | string,
) => {
  const allCollapsedRows = getItem(
    LocalStorageKeys.DashboardCollapsedRows,
    {} as CollapsedRowsState,
  );

  return allCollapsedRows[getDashboardKey(dashboardId)] || {};
};

export const setCollapsedRowForDashboard = ({
  dashboardId,
  rowId,
  collapsed,
}: {
  dashboardId?: number | string;
  rowId: string;
  collapsed: boolean;
}) => {
  const dashboardKey = getDashboardKey(dashboardId);
  const allCollapsedRows = getItem(
    LocalStorageKeys.DashboardCollapsedRows,
    {} as CollapsedRowsState,
  );

  setItem(LocalStorageKeys.DashboardCollapsedRows, {
    ...allCollapsedRows,
    [dashboardKey]: {
      ...(allCollapsedRows[dashboardKey] || {}),
      [rowId]: collapsed,
    },
  });
};

export const getInitialCollapsedStateForRow = ({
  dashboardId,
  rowComponent,
}: {
  dashboardId?: number | string;
  rowComponent: LayoutItem;
}) => {
  if (!isCollapsibleRow(rowComponent)) {
    return false;
  }

  const storedCollapsedRows = getCollapsedRowsForDashboard(dashboardId);
  return (
    storedCollapsedRows[rowComponent.id] ??
    Boolean(rowComponent.meta?.collapsedByDefault)
  );
};
