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
import { DashboardLayout, LayoutItem } from '../types';
import { COLUMN_TYPE } from './componentTypes';
import { GRID_MIN_COLUMN_COUNT } from './constants';

type CollapsedColumnsState = Record<string, Record<string, boolean>>;
export type DashboardCollapsedColumns = Record<string, boolean>;

const getDashboardKey = (dashboardId?: number | string) =>
  String(dashboardId ?? '');

const getDefaultWidth = (component?: LayoutItem) =>
  component?.meta?.width || GRID_MIN_COLUMN_COUNT;

export const isCollapsibleColumn = (component?: LayoutItem) =>
  component?.type === COLUMN_TYPE && Boolean(component?.meta?.enableCollapse);

export const getCollapsedColumnsForDashboard = (
  dashboardId?: number | string,
): DashboardCollapsedColumns => {
  const allCollapsedColumns = getItem(
    LocalStorageKeys.DashboardCollapsedColumns,
    {} as CollapsedColumnsState,
  );

  return allCollapsedColumns[getDashboardKey(dashboardId)] || {};
};

export const setCollapsedColumnForDashboard = ({
  dashboardId,
  columnId,
  collapsed,
}: {
  dashboardId?: number | string;
  columnId: string;
  collapsed: boolean;
}) => {
  const dashboardKey = getDashboardKey(dashboardId);
  const allCollapsedColumns = getItem(
    LocalStorageKeys.DashboardCollapsedColumns,
    {} as CollapsedColumnsState,
  );

  setItem(LocalStorageKeys.DashboardCollapsedColumns, {
    ...allCollapsedColumns,
    [dashboardKey]: {
      ...(allCollapsedColumns[dashboardKey] || {}),
      [columnId]: collapsed,
    },
  });
};

export const getInitialCollapsedColumnsForRow = ({
  dashboardId,
  rowComponent,
  layout,
}: {
  dashboardId?: number | string;
  rowComponent: LayoutItem;
  layout: DashboardLayout;
}) => {
  const storedCollapsedColumns = getCollapsedColumnsForDashboard(dashboardId);

  return (rowComponent.children || []).reduce((acc, childId) => {
    const child = layout[childId];
    if (!isCollapsibleColumn(child)) {
      return acc;
    }

    acc[childId] =
      storedCollapsedColumns[childId] ?? Boolean(child.meta?.collapsedByDefault);
    return acc;
  }, {} as DashboardCollapsedColumns);
};

const findRecipientColumnId = ({
  rowChildren,
  layout,
  collapsedColumnIds,
  currentIndex,
}: {
  rowChildren: string[];
  layout: DashboardLayout;
  collapsedColumnIds: Set<string>;
  currentIndex: number;
}) => {
  for (let index = currentIndex + 1; index < rowChildren.length; index += 1) {
    const candidate = layout[rowChildren[index]];
    if (
      candidate?.type === COLUMN_TYPE &&
      !collapsedColumnIds.has(candidate.id)
    ) {
      return candidate.id;
    }
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const candidate = layout[rowChildren[index]];
    if (
      candidate?.type === COLUMN_TYPE &&
      !collapsedColumnIds.has(candidate.id)
    ) {
      return candidate.id;
    }
  }

  return null;
};

const findFirstVisibleChildId = ({
  rowChildren,
  layout,
  collapsedColumnIds,
}: {
  rowChildren: string[];
  layout: DashboardLayout;
  collapsedColumnIds: Set<string>;
}) =>
  rowChildren.find(childId => {
    const child = layout[childId];
    return child && !collapsedColumnIds.has(childId);
  });

export const getEffectiveWidthsForRow = ({
  rowComponent,
  layout,
  collapsedColumns = {},
  editMode,
  availableColumnCount,
  fillExpandedSpace = false,
}: {
  rowComponent: LayoutItem;
  layout: DashboardLayout;
  collapsedColumns?: DashboardCollapsedColumns;
  editMode: boolean;
  availableColumnCount?: number;
  fillExpandedSpace?: boolean;
}) => {
  const widths = (rowComponent.children || []).reduce((acc, childId) => {
    const child = layout[childId];
    if (child) {
      acc[childId] = getDefaultWidth(child);
    }
    return acc;
  }, {} as Record<string, number>);

  if (editMode) {
    return widths;
  }

  const collapsedColumnIds = new Set(
    Object.entries(collapsedColumns)
      .filter(([, collapsed]) => collapsed)
      .map(([columnId]) => columnId),
  );

  (rowComponent.children || []).forEach((childId, currentIndex) => {
    const child = layout[childId];
    if (!child || !collapsedColumnIds.has(childId)) {
      return;
    }

    const currentWidth = getDefaultWidth(child);
    const collapsedWidth = GRID_MIN_COLUMN_COUNT;
    widths[childId] = collapsedWidth;

    const freedWidth = Math.max(0, currentWidth - collapsedWidth);
    if (freedWidth === 0) {
      return;
    }

    const recipientColumnId = findRecipientColumnId({
      rowChildren: rowComponent.children || [],
      layout,
      collapsedColumnIds,
      currentIndex,
    });

    if (recipientColumnId) {
      widths[recipientColumnId] =
        (widths[recipientColumnId] || GRID_MIN_COLUMN_COUNT) + freedWidth;
    }
  });

  const occupiedWidth = Object.values(widths).reduce(
    (sum, width) => sum + width,
    0,
  );
  const remainingWidth = Math.max(0, (availableColumnCount || 0) - occupiedWidth);

  if (fillExpandedSpace && remainingWidth > 0) {
    const recipientChildId = findFirstVisibleChildId({
      rowChildren: rowComponent.children || [],
      layout,
      collapsedColumnIds,
    });

    if (recipientChildId) {
      widths[recipientChildId] =
        (widths[recipientChildId] || GRID_MIN_COLUMN_COUNT) + remainingWidth;
    }
  }

  return widths;
};

export const applyCollapsedWidthsForRow = ({
  rowComponent,
  layout,
  collapsedColumns,
  editMode,
}: {
  rowComponent: LayoutItem;
  layout: DashboardLayout;
  collapsedColumns: DashboardCollapsedColumns;
  editMode: boolean;
}) =>
  getEffectiveWidthsForRow({
    rowComponent,
    layout,
    collapsedColumns,
    editMode,
  });
