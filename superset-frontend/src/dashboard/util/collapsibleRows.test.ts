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
  getInitialCollapsedStateForRow,
  setCollapsedRowForDashboard,
} from './collapsibleRows';
import { LocalStorageKeys, getItem } from '../../utils/localStorageHelpers';
import { ROW_TYPE } from './componentTypes';

const dashboardId = 42;

const createRow = (extraMeta: Record<string, boolean> = {}) =>
  ({
    id: 'ROW_ID',
    type: ROW_TYPE,
    children: [],
    meta: {
      background: 'BACKGROUND_TRANSPARENT',
      ...extraMeta,
    },
  }) as any;

describe('collapsibleRows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reads the default collapsed state from component meta', () => {
    expect(
      getInitialCollapsedStateForRow({
        dashboardId,
        rowComponent: createRow({
          enableCollapse: true,
          collapsedByDefault: true,
        }),
      }),
    ).toBe(true);
  });

  test('prefers the stored per-user collapse state over the default', () => {
    setCollapsedRowForDashboard({
      dashboardId,
      rowId: 'ROW_ID',
      collapsed: false,
    });

    expect(
      getInitialCollapsedStateForRow({
        dashboardId,
        rowComponent: createRow({
          enableCollapse: true,
          collapsedByDefault: true,
        }),
      }),
    ).toBe(false);
  });

  test('stores row collapse state per dashboard', () => {
    setCollapsedRowForDashboard({
      dashboardId,
      rowId: 'ROW_ID',
      collapsed: true,
    });

    expect(
      getItem(LocalStorageKeys.DashboardCollapsedRows, {} as any),
    ).toEqual({
      [dashboardId]: {
        ROW_ID: true,
      },
    });
  });
});
