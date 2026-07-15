/* eslint-disable camelcase */
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
  ColDef,
  ValueFormatterParams,
  ValueGetterParams,
  CellClassParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import { useCallback, useMemo } from 'react';
import { DataRecord } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { useTheme } from '@apache-superset/core/theme';
import { ColorFormatters } from '@superset-ui/chart-controls';
import { extent as d3Extent, max as d3Max } from 'd3-array';
import {
  BasicColorFormatterType,
  CellRendererProps,
  InputColumn,
} from '../types';
import getCellClass from './getCellClass';
import filterValueGetter from './filterValueGetter';
import dateFilterComparator from './dateFilterComparator';
import { getAggFunc } from './getAggFunc';
import { TextCellRenderer } from '../renderers/TextCellRenderer';
import { NumericCellRenderer } from '../renderers/NumericCellRenderer';
import CustomHeader from '../AgGridTable/components/CustomHeader';
import { valueFormatter, valueGetter } from './formatValue';
import getCellStyle from './getCellStyle';
import { useIsDark } from './useTableTheme';
import { getAdaptiveHeaderStyle } from './headerColors';
import parseNumericFilterValue, {
  NUMERIC_FILTER_ALLOWED_CHAR_PATTERN,
} from './parseNumericFilterValue';

interface InputData {
  [key: string]: any;
}

type UseColDefsProps = {
  columns: InputColumn[];
  data: InputData[];
  serverPagination: boolean;
  isRawRecords: boolean;
  defaultAlignPN: boolean;
  showCellBars: boolean;
  colorPositiveNegative: boolean;
  totals: DataRecord | undefined;
  columnColorFormatters: ColorFormatters;
  allowRearrangeColumns?: boolean;
  basicColorFormatters?: { [Key: string]: BasicColorFormatterType }[];
  isUsingTimeComparison?: boolean;
  emitCrossFilters?: boolean;
  alignPositiveNegative: boolean;
  slice_id: number;
};

type ValueRange = [number, number];

function getValueRange(
  key: string,
  alignPositiveNegative: boolean,
  data: InputData[],
) {
  if (typeof data?.[0]?.[key] === 'number') {
    const nums = data.map(row => row[key]) as number[];
    return (
      alignPositiveNegative ? [0, d3Max(nums.map(Math.abs))] : d3Extent(nums)
    ) as ValueRange;
  }
  return null;
}

const getCellDataType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'number';
    case GenericDataType.Temporal:
      return 'date';
    case GenericDataType.Boolean:
      return 'boolean';
    default:
      return 'text';
  }
};

const getFilterType = (col: InputColumn) => {
  switch (col.dataType) {
    case GenericDataType.Numeric:
      return 'agNumberColumnFilter';
    case GenericDataType.String:
      return 'agTextColumnFilter';
    case GenericDataType.Temporal:
      return 'agDateColumnFilter';
    default:
      return true;
  }
};

function getHeaderLabel(col: InputColumn) {
  let headerLabel: string | undefined;

  const hasOriginalLabel = !!col?.originalLabel;
  const isMain = col?.key?.includes('Main');
  const hasDisplayTypeIcon = col?.config?.displayTypeIcon !== false;
  const hasCustomColumnName = !!col?.config?.customColumnName;

  if (hasOriginalLabel && hasCustomColumnName) {
    if ('displayTypeIcon' in col.config) {
      headerLabel =
        hasDisplayTypeIcon && !isMain
          ? `${col.label} ${col.config.customColumnName}`
          : col.config.customColumnName;
    } else {
      headerLabel = col.config.customColumnName;
    }
  } else if (hasOriginalLabel && isMain) {
    headerLabel = col.originalLabel;
  } else if (hasOriginalLabel && !hasDisplayTypeIcon) {
    headerLabel = '';
  } else {
    headerLabel = col?.label;
  }
  return headerLabel || '';
}

export const useColDefs = ({
  columns,
  data,
  serverPagination,
  isRawRecords,
  defaultAlignPN,
  showCellBars,
  colorPositiveNegative,
  // Keep the existing hook API stable; totals is intentionally unused here.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  totals: _totals,
  columnColorFormatters,
  allowRearrangeColumns,
  basicColorFormatters,
  isUsingTimeComparison,
  emitCrossFilters,
  alignPositiveNegative,
  slice_id,
}: UseColDefsProps) => {
  const theme = useTheme();
  const isDarkTheme = useIsDark();

  const getCommonColProps = useCallback(
    (col: InputColumn): ColDef => {
      const {
        config,
        isMetric,
        isPercentMetric,
        isNumeric,
        key: originalKey,
        dataType,
        originalLabel,
      } = col;

      const alignPN =
        config.alignPositiveNegative === undefined
          ? defaultAlignPN
          : config.alignPositiveNegative;

      const hasColumnColorFormatters =
        isNumeric &&
        Array.isArray(columnColorFormatters) &&
        columnColorFormatters.length > 0;

      const hasBasicColorFormatters =
        isUsingTimeComparison &&
        Array.isArray(basicColorFormatters) &&
        basicColorFormatters.length > 0;

      const isMain = originalKey?.includes('Main');
      const colId = isMain
        ? originalKey.replace('Main', '').trim()
        : originalKey;
      const isTextColumn =
        dataType === GenericDataType.String ||
        dataType === GenericDataType.Temporal;

      const headerBgColor = config?.headerBgColor?.trim();
      const isValidHeaderBgColor =
        !!headerBgColor &&
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('background-color', headerBgColor);
      const headerStyle =
        isValidHeaderBgColor && theme?.colorBgContainer
          ? getAdaptiveHeaderStyle({
              backgroundColor: headerBgColor,
              isDarkTheme,
              themeBackgroundColor: theme.colorBgContainer,
            })
          : undefined;

      const valueRange =
        !hasBasicColorFormatters &&
        !hasColumnColorFormatters &&
        showCellBars &&
        (config.showCellBars ?? true) &&
        (isMetric || isRawRecords || isPercentMetric) &&
        getValueRange(originalKey, alignPN || alignPositiveNegative, data);

      const filter = getFilterType(col);

      const colDef: ColDef = {
        field: colId,
        headerName: getHeaderLabel(col),
        valueFormatter: (p: ValueFormatterParams) => valueFormatter(p, col),
        valueGetter: (p: ValueGetterParams) => valueGetter(p, col),
        cellStyle: (p: CellClassParams) =>
          getCellStyle({
            ...p,
            hasColumnColorFormatters,
            columnColorFormatters,
            hasBasicColorFormatters,
            basicColorFormatters,
            col,
            isDarkTheme,
            themeBackgroundColor: theme.colorBgContainer,
          }),
        cellClass: (p: CellClassParams) =>
          getCellClass({
            ...p,
            col,
            emitCrossFilters,
          }),
        minWidth: config?.columnWidth ?? 100,
        filter,
        ...(dataType === GenericDataType.Temporal && {
          filterParams: {
            comparator: dateFilterComparator,
          },
        }),
        ...(dataType === GenericDataType.Numeric && {
          filterValueGetter,
          filterParams: {
            allowedCharPattern: NUMERIC_FILTER_ALLOWED_CHAR_PATTERN,
            numberParser: parseNumericFilterValue,
          },
        }),
        cellDataType: getCellDataType(col),
        defaultAggFunc: getAggFunc(col),
        initialAggFunc: getAggFunc(col),
        ...(config?.hideByDefault && {
          hide: true,
        }),
        pinned:
          config?.pinnedByDefault === 'none'
            ? null
            : (config?.pinnedByDefault ?? null),
        ...(!(isMetric || isPercentMetric) && {
          allowedAggFuncs: [
            'sum',
            'min',
            'max',
            'count',
            'avg',
            'first',
            'last',
          ],
        }),
        cellRenderer: (p: CellRendererProps) => {
          if (p.node?.rowPinned === 'bottom' && config?.hideSummary) {
            return '';
          }
          return isTextColumn ? TextCellRenderer(p) : NumericCellRenderer(p);
        },
        cellRendererParams: {
          allowRenderHtml: true,
          columns,
          hasBasicColorFormatters,
          col,
          basicColorFormatters,
          valueRange,
          alignPositiveNegative: alignPN || alignPositiveNegative,
          colorPositiveNegative,
        },
        context: {
          isMetric,
          isPercentMetric,
          isNumeric,
          hideSummary: config?.hideSummary,
          isMain,
          ...(originalLabel && {
            timeComparisonKey: originalLabel,
          }),
        },
        lockPinned: !allowRearrangeColumns,
        sortable: !serverPagination || !isPercentMetric,
        ...(serverPagination && {
          headerComponent: CustomHeader,
          comparator: () => 0,
          headerComponentParams: {
            slice_id,
          },
        }),
        ...(!isMain &&
          originalLabel && {
            columnGroupShow: 'open' as const,
          }),
        // Keep auto-height enabled so hovered truncated cells can expand to multiple lines
        // and show full text instead of staying clipped to a fixed row height.
        wrapText: true,
        autoHeight: true,
      };

      if (headerStyle) {
        colDef.headerStyle = {
          ...(colDef.headerStyle || {}),
          ...headerStyle,
        };
      }

      return colDef;
    },
    [
      columns,
      data,
      defaultAlignPN,
      columnColorFormatters,
      basicColorFormatters,
      showCellBars,
      colorPositiveNegative,
      isUsingTimeComparison,
      isRawRecords,
      emitCrossFilters,
      allowRearrangeColumns,
      serverPagination,
      alignPositiveNegative,
      isDarkTheme,
      slice_id,
      theme,
    ],
  );

  const colDefs = useMemo(() => {
    const groupIndexMap = new Map<string, number>();

    return columns.reduce<ColDef[]>((acc, col) => {
      const colDef = getCommonColProps(col);

      if (col?.originalLabel) {
        if (groupIndexMap.has(col.originalLabel)) {
          const groupIdx = groupIndexMap.get(col.originalLabel)!;
          (acc[groupIdx] as { children: ColDef[] }).children.push(colDef);
        } else {
          const group = {
            headerName: col.originalLabel,
            marryChildren: true,
            openByDefault: true,
            children: [colDef],
          };
          groupIndexMap.set(col.originalLabel, acc.length);
          acc.push(group);
        }
      } else {
        acc.push(colDef);
      }

      return acc;
    }, []);
  }, [columns, getCommonColProps]);

  return colDefs;
};
