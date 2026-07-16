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
import type { ResultsPaneProps } from '../types';
import { getColumnValueKeyMap } from './useResultsPane';

const metric = (aggregate: string) => ({
  expressionType: 'SIMPLE',
  column: { column_name: 'value' },
  aggregate,
  hasCustomLabel: true,
  label: 'Shared label',
});

const formData = (
  overrides: Record<string, unknown>,
): ResultsPaneProps['queryFormData'] =>
  overrides as ResultsPaneProps['queryFormData'];

test('keeps custom-label SQL mappings separate for each query result', () => {
  const queryFormData = formData({
    metrics: [metric('SUM')],
    metrics_b: [metric('AVG')],
    metrics_2: [metric('MAX')],
  });

  expect(getColumnValueKeyMap(queryFormData, 0)).toEqual({
    'Shared label': 'SUM(value)',
  });
  expect(getColumnValueKeyMap(queryFormData, 1)).toEqual({
    'Shared label': 'AVG(value)',
  });
  expect(getColumnValueKeyMap(queryFormData, 2)).toEqual({
    'Shared label': 'MAX(value)',
  });
});

test('uses the matching nested query instead of metrics from other results', () => {
  const queryFormData = formData({
    metrics: [metric('MIN')],
    queries: [{ metrics: [metric('SUM')] }, { metrics: [metric('COUNT')] }],
  });

  expect(getColumnValueKeyMap(queryFormData, 0)).toEqual({
    'Shared label': 'SUM(value)',
  });
  expect(getColumnValueKeyMap(queryFormData, 1)).toEqual({
    'Shared label': 'COUNT(value)',
  });
});
