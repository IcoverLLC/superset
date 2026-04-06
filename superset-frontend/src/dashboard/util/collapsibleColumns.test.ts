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
  applyCollapsedWidthsForRow,
  getInitialCollapsedColumnsForRow,
} from './collapsibleColumns';
import { COLUMN_TYPE, ROW_TYPE } from './componentTypes';
import { LocalStorageKeys, setItem } from '../../utils/localStorageHelpers';

const dashboardId = 42;

const createColumn = (
  id: string,
  width: number,
  extraMeta: Record<string, boolean> = {},
) =>
  ({
    id,
    type: COLUMN_TYPE,
    children: [],
    meta: {
      width,
      background: 'BACKGROUND_TRANSPARENT',
      ...extraMeta,
    },
  }) as any;

describe('collapsibleColumns', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reads the default collapsed state from component meta', () => {
    const rowComponent = {
      id: 'ROW_ID',
      type: ROW_TYPE,
      children: ['COLUMN_A'],
      meta: {},
    } as any;
    const layout = {
      COLUMN_A: createColumn('COLUMN_A', 6, {
        enableCollapse: true,
        collapsedByDefault: true,
      }),
    } as any;

    expect(
      getInitialCollapsedColumnsForRow({
        dashboardId,
        rowComponent,
        layout,
      }),
    ).toEqual({ COLUMN_A: true });
  });

  test('prefers the stored per-user collapse state over the default', () => {
    const rowComponent = {
      id: 'ROW_ID',
      type: ROW_TYPE,
      children: ['COLUMN_A'],
      meta: {},
    } as any;
    const layout = {
      COLUMN_A: createColumn('COLUMN_A', 6, {
        enableCollapse: true,
        collapsedByDefault: false,
      }),
    } as any;

    setItem(LocalStorageKeys.DashboardCollapsedColumns, {
      [dashboardId]: { COLUMN_A: true },
    });

    expect(
      getInitialCollapsedColumnsForRow({
        dashboardId,
        rowComponent,
        layout,
      }),
    ).toEqual({ COLUMN_A: true });
  });

  test('redistributes freed width to the next visible column', () => {
    const rowComponent = {
      id: 'ROW_ID',
      type: ROW_TYPE,
      children: ['COLUMN_A', 'COLUMN_B'],
      meta: {},
    } as any;
    const layout = {
      COLUMN_A: createColumn('COLUMN_A', 6, { enableCollapse: true }),
      COLUMN_B: createColumn('COLUMN_B', 6, { enableCollapse: true }),
    } as any;

    expect(
      applyCollapsedWidthsForRow({
        rowComponent,
        layout,
        collapsedColumns: { COLUMN_A: true },
        editMode: false,
      }),
    ).toEqual({
      COLUMN_A: 1,
      COLUMN_B: 11,
    });
  });
});
