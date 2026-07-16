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

const basicFormData: TableChartFormData = {
  viz_type: VizType.Table,
  datasource: '11__table',
  query_mode: QueryMode.Aggregate,
  groupby: ['state'],
  metrics: ['count'],
  server_pagination: true,
};

describe('server pagination row limit', () => {
  test('caps the first page by the configured row limit', () => {
    const query = buildQuery(
      {
        ...basicFormData,
        row_limit: 10,
        server_page_length: 20,
      },
      { ownState: { currentPage: 0, pageSize: 20 } },
    ).queries[0];

    expect(query).toMatchObject({ row_limit: 10, row_offset: 0 });
  });

  test('caps the last page by the remaining configured rows', () => {
    const query = buildQuery(
      {
        ...basicFormData,
        row_limit: 120,
        server_page_length: 50,
      },
      { ownState: { currentPage: 2, pageSize: 50 } },
    ).queries[0];

    expect(query).toMatchObject({ row_limit: 20, row_offset: 100 });
  });

  test('clamps pages beyond the configured row limit', () => {
    const query = buildQuery(
      {
        ...basicFormData,
        row_limit: 120,
        server_page_length: 50,
      },
      { ownState: { currentPage: 5, pageSize: 50 } },
    ).queries[0];

    expect(query).toMatchObject({ row_limit: 20, row_offset: 100 });
    expect(query.row_limit).not.toBe(0);
  });
});

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
