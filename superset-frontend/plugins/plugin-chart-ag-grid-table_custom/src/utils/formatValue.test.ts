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
import { GenericDataType } from '@apache-superset/core/common';
import { getNumberFormatter } from '@superset-ui/core';
import { formatColumnValue, valueFormatter } from './formatValue';
import { DataColumnMeta, InputColumn } from '../types';

const largeInteger = BigInt('9223372036854775807');

test('formats bigint values without lossy number conversion', () => {
  const formatter = jest.fn(() => 'formatted');
  const columnMeta: DataColumnMeta = {
    key: 'metric',
    label: 'Metric',
    dataType: GenericDataType.Numeric,
    formatter,
    config: {},
  };
  const inputColumn: InputColumn = {
    ...columnMeta,
    isNumeric: true,
    isMetric: true,
    isPercentMetric: false,
    config: {},
  };

  expect(formatColumnValue(columnMeta, largeInteger)).toEqual([
    false,
    '9223372036854775807',
  ]);
  expect(
    valueFormatter(
      { value: largeInteger, node: { level: 0 } } as never,
      inputColumn,
    ),
  ).toBe('9223372036854775807');
  expect(formatter).not.toHaveBeenCalled();
});

test('keeps normal d3 number formatting unchanged', () => {
  const column: DataColumnMeta = {
    key: 'metric',
    label: 'Metric',
    dataType: GenericDataType.Numeric,
    formatter: getNumberFormatter(',.0f'),
    config: {},
  };

  expect(formatColumnValue(column, 1234)).toEqual([false, '1,234']);
  expect(formatColumnValue(column, largeInteger)).toEqual([
    false,
    '9223372036854775807',
  ]);
});
