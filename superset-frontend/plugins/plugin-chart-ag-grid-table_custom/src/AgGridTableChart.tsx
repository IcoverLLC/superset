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
  DataRecord,
  DataRecordValue,
  BinaryQueryObjectFilterClause,
  ContextMenuFilters,
  getTimeFormatterForGranularity,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { isEqual } from 'lodash';
import type { CellContextMenuEvent } from 'ag-grid-community';

import {
  CellClickedEvent,
  IMenuActionParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import {
  AgGridTableChartTransformedProps,
  InputColumn,
  SearchOption,
  SortByItem,
} from './types';
import AgGridDataTable from './AgGridTable';
import { updateTableOwnState } from './utils/externalAPIs';
import TimeComparisonVisibility from './AgGridTable/components/TimeComparisonVisibility';
import { useColDefs } from './utils/useColDefs';
import { getCrossFilterDataMask } from './utils/getCrossFilterDataMask';
import { formatColumnValue } from './utils/formatValue';
import { StyledChartContainer } from './styles';

export default function TableChart<D extends DataRecord = DataRecord>(
  props: AgGridTableChartTransformedProps<D> & {},
) {
  const {
    height,
    columns,
    data,
    includeSearch,
    allowRearrangeColumns,
    pageSize,
    serverPagination,
    rowCount,
    setDataMask,
    serverPaginationData,
    slice_id,
    percentMetrics,
    hasServerPageLengthChanged,
    serverPageLength,
    emitCrossFilters,
    filters,
    timeGrain,
    isRawRecords,
    alignPositiveNegative,
    showCellBars,
    isUsingTimeComparison,
    colorPositiveNegative,
    totals,
    showTotals,
    columnColorFormatters,
    basicColorFormatters,
    width,
    onContextMenu,
  } = props;

  const [searchOptions, setSearchOptions] = useState<SearchOption[]>([]);
  const lastContextMenuTsRef = useRef<number>(0);

  useEffect(() => {
    const options = columns
      .filter(col => col?.dataType === GenericDataType.String)
      .map(column => ({
        value: column.key,
        label: column.label,
      }));

    if (!isEqual(options, searchOptions)) {
      setSearchOptions(options || []);
    }
  }, [columns]);

  const comparisonColumns = [
    { key: 'all', label: t('Display all') },
    { key: '#', label: '#' },
    { key: '△', label: '△' },
    { key: '%', label: '%' },
  ];

  const [selectedComparisonColumns, setSelectedComparisonColumns] = useState([
    comparisonColumns?.[0]?.key,
  ]);

  const filteredColumns = useMemo(() => {
    if (!isUsingTimeComparison) {
      return columns;
    }
    if (
      selectedComparisonColumns.length === 0 ||
      selectedComparisonColumns.includes('all')
    ) {
      return columns?.filter(col => col?.config?.visible !== false);
    }

    return columns
      .filter(
        col =>
          !col.originalLabel ||
          (col?.label || '').includes('Main') ||
          selectedComparisonColumns.includes(col.label),
      )
      .filter(col => col?.config?.visible !== false);
  }, [columns, selectedComparisonColumns]);

  const colDefs = useColDefs({
    columns: isUsingTimeComparison
      ? (filteredColumns as InputColumn[])
      : (columns as InputColumn[]),
    data,
    serverPagination,
    isRawRecords,
    defaultAlignPN: alignPositiveNegative,
    showCellBars,
    colorPositiveNegative,
    totals,
    columnColorFormatters,
    allowRearrangeColumns,
    basicColorFormatters,
    isUsingTimeComparison,
    emitCrossFilters,
    alignPositiveNegative,
    slice_id,
  });

  const gridHeight = height;

  const isActiveFilterValue = useCallback(
    function isActiveFilterValue(key: string, val: DataRecordValue) {
      return !!filters && filters[key]?.includes(val);
    },
    [filters],
  );

  const timestampFormatter = useCallback(
    value => getTimeFormatterForGranularity(timeGrain)(value),
    [timeGrain],
  );

  const toggleFilter = useCallback(
    (event: CellClickedEvent | IMenuActionParams) => {
      if (
        emitCrossFilters &&
        event.column &&
        !(
          event.column.getColDef().context?.isMetric ||
          event.column.getColDef().context?.isPercentMetric
        )
      ) {
        const altPressed = Boolean(
          'event' in event &&
          event.event &&
          typeof event.event === 'object' &&
          'altKey' in event.event &&
          event.event.altKey,
        );
        const crossFilterProps = {
          key: event.column.getColId(),
          value: event.value,
          filters,
          timeGrain,
          altPressed,
          isActiveFilterValue,
          timestampFormatter,
        };
        setDataMask(getCrossFilterDataMask(crossFilterProps).dataMask);
      }
    },
    [emitCrossFilters, setDataMask, filters, timeGrain],
  );

  const handleCellContextMenu = useCallback(
    (event: CellContextMenuEvent) => {
      const now = Date.now();
      if (now - lastContextMenuTsRef.current < 150) {
        return;
      }
      lastContextMenuTsRef.current = now;

      const mouseEvent = event.event as MouseEvent | null;
      if (mouseEvent) {
        mouseEvent.preventDefault();
        mouseEvent.stopPropagation();
      }

      const copyCellValue = (value: unknown) => {
        const textToCopy = value == null ? '' : String(value);

        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(textToCopy).catch(() => {
            // ignore clipboard errors so context menu continues to work
          });
          return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch {
          // ignore clipboard errors so context menu continues to work
        }
        document.body.removeChild(textarea);
      };

      if (!onContextMenu || !event.column) {
        return;
      }

      const colDef = event.column.getColDef();
      const colId = colDef.field ?? event.column.getColId();
      const isMetric =
        colDef.context?.isMetric || colDef.context?.isPercentMetric;
      const rowData = (event.data || {}) as DataRecord;
      const cellValue = event.value ?? rowData?.[colId];
      const columnMeta = columns.find(col => col.key === colId);
      const formattedCellValue =
        (event as { valueFormatted?: string }).valueFormatted ??
        (columnMeta
          ? formatColumnValue(columnMeta, cellValue as DataRecordValue)[1]
          : undefined) ??
        cellValue;
      copyCellValue(formattedCellValue);
      const drillToDetailFilters: BinaryQueryObjectFilterClause[] = columns
        .filter(col => !col.isMetric && !col.isPercentMetric)
        .map(col => {
          const rowValue = rowData?.[col.key];
          const formattedVal = formatColumnValue(
            col,
            rowValue as DataRecordValue,
          )[1];
          return {
            col: col.key,
            op: '==',
            val: rowValue as DataRecordValue,
            formattedVal,
          };
        });

      const crossFilter =
        !isMetric && colId
          ? getCrossFilterDataMask({
              key: colId,
              value: cellValue as DataRecordValue,
              filters,
              timeGrain,
              isActiveFilterValue,
              timestampFormatter,
            })
          : undefined;

      const drillBy =
        !isMetric && colId
          ? {
              filters: [
                {
                  col: colId,
                  op: '==',
                  val: cellValue as DataRecordValue,
                },
              ],
              groupbyFieldName: 'groupby',
            }
          : undefined;

      const clientX = mouseEvent?.clientX ?? 0;
      const clientY = mouseEvent?.clientY ?? 0;
      const payload = {
        drillToDetail: drillToDetailFilters,
        crossFilter,
        drillBy,
      } as unknown as ContextMenuFilters;
      requestAnimationFrame(() => onContextMenu?.(clientX, clientY, payload));
    },
    [
      onContextMenu,
      columns,
      filters,
      timeGrain,
      isActiveFilterValue,
      timestampFormatter,
    ],
  );

  const handleServerPaginationChange = useCallback(
    (pageNumber: number, pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: pageNumber,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      const modifiedOwnState = {
        ...serverPaginationData,
        currentPage: 0,
        pageSize,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask],
  );

  const handleChangeSearchCol = (searchCol: string) => {
    if (!isEqual(searchCol, serverPaginationData?.searchColumn)) {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn: searchCol,
        searchText: '',
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    }
  };

  const handleSearch = useCallback(
    (searchText: string) => {
      const modifiedOwnState = {
        ...(serverPaginationData || {}),
        searchColumn:
          serverPaginationData?.searchColumn || searchOptions[0]?.value,
        searchText,
        currentPage: 0, // Reset to first page when searching
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, searchOptions],
  );

  const handleSortByChange = useCallback(
    (sortBy: SortByItem[]) => {
      if (!serverPagination) return;
      const modifiedOwnState = {
        ...serverPaginationData,
        sortBy,
      };
      updateTableOwnState(setDataMask, modifiedOwnState);
    },
    [setDataMask, serverPagination],
  );

  const renderTimeComparisonVisibility = (): JSX.Element => (
    <TimeComparisonVisibility
      comparisonColumns={comparisonColumns}
      selectedComparisonColumns={selectedComparisonColumns}
      onSelectionChange={setSelectedComparisonColumns}
    />
  );

  return (
    <StyledChartContainer height={height}>
      <AgGridDataTable
        gridHeight={gridHeight}
        data={data || []}
        colDefsFromProps={colDefs}
        includeSearch={!!includeSearch}
        allowRearrangeColumns={!!allowRearrangeColumns}
        pagination={!!pageSize && !serverPagination}
        pageSize={pageSize || 0}
        serverPagination={serverPagination}
        rowCount={rowCount}
        onServerPaginationChange={handleServerPaginationChange}
        onServerPageSizeChange={handlePageSizeChange}
        serverPaginationData={serverPaginationData}
        searchOptions={searchOptions}
        onSearchColChange={handleChangeSearchCol}
        onSearchChange={handleSearch}
        onSortChange={handleSortByChange}
        id={slice_id}
        handleCrossFilter={toggleFilter}
        percentMetrics={percentMetrics}
        serverPageLength={serverPageLength}
        hasServerPageLengthChanged={hasServerPageLengthChanged}
        isActiveFilterValue={isActiveFilterValue}
        renderTimeComparisonDropdown={
          isUsingTimeComparison ? renderTimeComparisonVisibility : () => null
        }
        cleanedTotals={totals || {}}
        showTotals={showTotals}
        width={width}
        onCellContextMenu={handleCellContextMenu}
      />
    </StyledChartContainer>
  );
}
