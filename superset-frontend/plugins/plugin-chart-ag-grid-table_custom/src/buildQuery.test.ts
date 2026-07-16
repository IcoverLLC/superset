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
import { QueryMode, VizType } from '@superset-ui/core';
import buildQuery from './buildQuery';
import { TableChartFormData } from './types';

test('uses zero instead of NaN for an omitted server row limit', () => {
  const formData: TableChartFormData = {
    viz_type: VizType.Table,
    datasource: '11__table',
    query_mode: QueryMode.Aggregate,
    groupby: ['state'],
    metrics: ['count'],
    server_pagination: true,
    row_limit: undefined,
  };

  const rowCountQuery = buildQuery(formData, {
    ownState: { currentPage: 0, pageSize: 20 },
  }).queries[1];

  expect(rowCountQuery.is_rowcount).toBe(true);
  expect(rowCountQuery.row_limit).toBe(0);
  expect(Number.isNaN(rowCountQuery.row_limit)).toBe(false);
});

test('uses zero instead of NaN for an invalid server row limit', () => {
  const formData: TableChartFormData = {
    viz_type: VizType.Table,
    datasource: '11__table',
    query_mode: QueryMode.Aggregate,
    groupby: ['state'],
    metrics: ['count'],
    server_pagination: true,
    row_limit: 'invalid' as unknown as number,
  };

  const rowCountQuery = buildQuery(formData, {
    ownState: { currentPage: 0, pageSize: 20 },
  }).queries[1];

  expect(rowCountQuery.is_rowcount).toBe(true);
  expect(rowCountQuery.row_limit).toBe(0);
  expect(Number.isNaN(rowCountQuery.row_limit)).toBe(false);
});
