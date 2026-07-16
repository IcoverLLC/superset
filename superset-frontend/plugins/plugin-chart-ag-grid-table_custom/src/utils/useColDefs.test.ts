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
import { createElement, type ComponentProps, type ReactNode } from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { GenericDataType } from '@apache-superset/core/common';
import { supersetTheme, ThemeProvider } from '@apache-superset/core/theme';
import { useColDefs } from './useColDefs';
import { InputColumn } from '../types';
import DateWithFormatter from './DateWithFormatter';

function ThemeWrapper({ children }: { children?: ReactNode }) {
  return createElement(
    ThemeProvider,
    { theme: supersetTheme } as ComponentProps<typeof ThemeProvider>,
    children,
  );
}

const numericColumn: InputColumn = {
  key: 'metric',
  label: 'Metric',
  dataType: GenericDataType.Numeric,
  isNumeric: true,
  isMetric: true,
  isPercentMetric: false,
  config: {},
};

test('ignores bigint values when calculating cell-bar ranges', () => {
  const { result } = renderHook(
    () =>
      useColDefs({
        columns: [numericColumn],
        data: [{ metric: 10 }, { metric: BigInt(20) }],
        serverPagination: false,
        isRawRecords: false,
        defaultAlignPN: true,
        showCellBars: true,
        colorPositiveNegative: false,
        totals: undefined,
        columnColorFormatters: [],
        allowRearrangeColumns: false,
        basicColorFormatters: [],
        isUsingTimeComparison: false,
        emitCrossFilters: false,
        alignPositiveNegative: false,
        slice_id: 1,
      }),
    { wrapper: ThemeWrapper },
  );

  expect(result.current[0].cellRendererParams.valueRange).toEqual([0, 10]);
  expect(result.current[0].filter).toBe('agTextColumnFilter');
  expect(result.current[0].cellDataType).toBe('text');
  const bigintFilterGetter = result.current[0].filterValueGetter;
  expect(typeof bigintFilterGetter).toBe('function');
  if (typeof bigintFilterGetter !== 'function') {
    throw new Error('Expected a bigint-safe filter value getter');
  }
  expect(
    bigintFilterGetter({
      data: { metric: BigInt('9223372036854775807') },
      column: { getColId: () => 'metric' },
      colDef: { context: {} },
    } as never),
  ).toBe('9223372036854775807');
});

test('handles bigint values independently of row order', () => {
  const { result } = renderHook(
    () =>
      useColDefs({
        columns: [numericColumn],
        data: [{ metric: BigInt(20) }, { metric: -10 }, { metric: 5 }],
        serverPagination: false,
        isRawRecords: false,
        defaultAlignPN: false,
        showCellBars: true,
        colorPositiveNegative: false,
        totals: undefined,
        columnColorFormatters: [],
        allowRearrangeColumns: false,
        basicColorFormatters: [],
        isUsingTimeComparison: false,
        emitCrossFilters: false,
        alignPositiveNegative: false,
        slice_id: 1,
      }),
    { wrapper: ThemeWrapper },
  );

  expect(result.current[0].cellRendererParams.valueRange).toEqual([-10, 5]);
});

test('renders boolean columns as disabled checkboxes', () => {
  const booleanColumn: InputColumn = {
    ...numericColumn,
    key: 'enabled',
    label: 'Enabled',
    dataType: GenericDataType.Boolean,
    isNumeric: false,
    isMetric: false,
  };
  const { result } = renderHook(
    () =>
      useColDefs({
        columns: [booleanColumn],
        data: [{ enabled: true }, { enabled: false }],
        serverPagination: false,
        isRawRecords: true,
        defaultAlignPN: false,
        showCellBars: false,
        colorPositiveNegative: false,
        totals: undefined,
        columnColorFormatters: [],
        allowRearrangeColumns: false,
        basicColorFormatters: [],
        isUsingTimeComparison: false,
        emitCrossFilters: false,
        alignPositiveNegative: false,
        slice_id: 1,
      }),
    { wrapper: ThemeWrapper },
  );

  expect(result.current[0].cellRenderer).toBe('agCheckboxCellRenderer');
  expect(result.current[0].cellRendererParams).toEqual({ disabled: true });
});

test('exposes null temporal values to the blank date filter', () => {
  const temporalColumn: InputColumn = {
    ...numericColumn,
    key: 'created_at',
    label: 'Created at',
    dataType: GenericDataType.Temporal,
    isNumeric: false,
    isMetric: false,
  };
  const { result } = renderHook(
    () =>
      useColDefs({
        columns: [temporalColumn],
        data: [{ created_at: new DateWithFormatter(null) }],
        serverPagination: false,
        isRawRecords: true,
        defaultAlignPN: false,
        showCellBars: false,
        colorPositiveNegative: false,
        totals: undefined,
        columnColorFormatters: [],
        allowRearrangeColumns: false,
        basicColorFormatters: [],
        isUsingTimeComparison: false,
        emitCrossFilters: false,
        alignPositiveNegative: false,
        slice_id: 1,
      }),
    { wrapper: ThemeWrapper },
  );
  const dateFilterGetter = result.current[0].filterValueGetter;

  expect(typeof dateFilterGetter).toBe('function');
  expect(
    typeof dateFilterGetter === 'function'
      ? dateFilterGetter({
          data: { created_at: new DateWithFormatter(null) },
          colDef: { field: 'created_at' },
        } as never)
      : undefined,
  ).toBeNull();
});
