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
  type ColDef,
  type ColumnState,
} from '@superset-ui/core/components/ThemedAgGridReact';
import reconcileColumnState, { getLeafColumnIds } from './reconcileColumnState';

test('flattens grouped columns in their visual order', () => {
  const colDefs = [
    { field: 'dimension' },
    {
      headerName: 'Metrics',
      children: [{ field: 'sales' }, { field: 'quantity' }],
    },
  ] as ColDef[];

  expect(getLeafColumnIds(colDefs)).toEqual(['dimension', 'sales', 'quantity']);
});

test('does not apply stale order after dynamic columns change', () => {
  const savedState: ColumnState[] = [
    { colId: 'old_dimension' },
    { colId: 'sales' },
    { colId: 'quantity' },
  ];
  const currentColDefs: ColDef[] = [
    { field: 'new_dimension' },
    { field: 'sales' },
    { field: 'quantity' },
  ];

  expect(reconcileColumnState(savedState, currentColDefs)).toEqual({
    applyOrder: false,
    columnState: [{ colId: 'sales' }, { colId: 'quantity' }],
  });
});

test('preserves saved order when the column set is unchanged', () => {
  const savedState: ColumnState[] = [
    { colId: 'sales' },
    { colId: 'dimension' },
  ];

  expect(
    reconcileColumnState(savedState, [
      { field: 'dimension' },
      { field: 'sales' },
    ]),
  ).toEqual({ applyOrder: true, columnState: savedState });
});
