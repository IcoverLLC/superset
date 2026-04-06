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
  useCallback,
  useMemo,
  useRef,
  memo,
  useState,
  ChangeEvent,
  useEffect,
} from 'react';

import { ThemedAgGridReact } from '@superset-ui/core/components';
import {
  AgGridReact,
  AllCommunityModule,
  ClientSideRowModelModule,
  type ColDef,
  ModuleRegistry,
  GridReadyEvent,
  GridState,
  IMenuActionParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import type {
  CellContextMenuEvent,
  ColumnState,
  GridApi,
  ColumnResizedEvent,
  ColumnMovedEvent,
  ColumnVisibleEvent,
  ColumnPinnedEvent,
  CellClickedEvent as AgCellClickedEvent,
} from 'ag-grid-community';
import type { FunctionComponent } from 'react';
import { JsonObject, DataRecordValue, DataRecord, t } from '@superset-ui/core';
import { SearchOutlined } from '@ant-design/icons';
import { debounce, isEqual } from 'lodash';
import Pagination from './components/Pagination';
import SearchSelectDropdown from './components/SearchSelectDropdown';
import { SearchOption, SortByItem } from '../types';
import getInitialSortState, { shouldSort } from '../utils/getInitialSortState';
import { PAGE_SIZE_OPTIONS } from '../consts';
import { Header as GridHeader } from '../gridHeader/Header';

export interface AgGridTableProps {
  gridTheme?: string;
  isDarkMode?: boolean;
  gridHeight?: number;
  updateInterval?: number;
  data?: any[];
  onGridReady?: (params: GridReadyEvent) => void;
  colDefsFromProps: any[];
  includeSearch: boolean;
  allowRearrangeColumns: boolean;
  pagination: boolean;
  pageSize: number;
  serverPagination?: boolean;
  rowCount?: number;
  onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
  serverPaginationData: JsonObject;
  onServerPageSizeChange: (pageSize: number) => void;
  searchOptions: SearchOption[];
  onSearchColChange: (searchCol: string) => void;
  onSearchChange: (searchText: string) => void;
  onSortChange: (sortBy: SortByItem[]) => void;
  id: number;
  percentMetrics: string[];
  serverPageLength: number;
  hasServerPageLengthChanged: boolean;
  handleCrossFilter: (event: AgCellClickedEvent | IMenuActionParams) => void;
  isActiveFilterValue: (key: string, val: DataRecordValue) => boolean;
  renderTimeComparisonDropdown: () => JSX.Element | null;
  cleanedTotals: DataRecord;
  showTotals: boolean;
  width: number;
  onCellContextMenu?: (event: CellContextMenuEvent) => void;
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const isSearchFocused = new Map<string, boolean>();
const TOTALS_WIDTH_BUFFER = 16;

const AgGridDataTable: FunctionComponent<AgGridTableProps> = memo(
  ({
    gridHeight,
    data = [],
    colDefsFromProps,
    includeSearch,
    allowRearrangeColumns,
    pagination,
    pageSize,
    serverPagination,
    rowCount,
    onServerPaginationChange,
    serverPaginationData,
    onServerPageSizeChange,
    searchOptions,
    onSearchColChange,
    onSearchChange,
    onSortChange,
    id,
    percentMetrics,
    serverPageLength,
    hasServerPageLengthChanged,
    handleCrossFilter,
    isActiveFilterValue,
    renderTimeComparisonDropdown,
    cleanedTotals,
    showTotals,
    width,
    onCellContextMenu,
  }) => {
    const gridRef = useRef<AgGridReact>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowData = useMemo(() => data, [data]);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasStoredColumnState = useRef(false);

    const searchId = `search-${id}`;
    const storageKey = useMemo(() => `aggrid_cols_state_custom:${id}`, [id]);
    const gridInitialState: GridState = {
      ...(serverPagination && {
        sort: {
          sortModel: getInitialSortState(serverPaginationData?.sortBy || []),
        },
      }),
    };

    const defaultColDef = useMemo<ColDef>(
      () => ({
        filter: true,
        sortable: true,
        resizable: true,
        minWidth: 100,
        wrapHeaderText: true,
        autoHeaderHeight: true,
      }),
      [],
    );

    const gridComponents = useMemo(
      () => ({
        agColumnHeader: GridHeader,
      }),
      [],
    );

    // Memoize container style
    const containerStyles = useMemo(
      () => ({
        height: gridHeight ?? '100%',
        width,
      }),
      [gridHeight, width],
    );

    const [quickFilterText, setQuickFilterText] = useState<string>();
    const [searchValue, setSearchValue] = useState(
      serverPaginationData?.searchText || '',
    );
    const rowBuffer = serverPagination
      ? Math.max(pageSize, PAGE_SIZE_OPTIONS[PAGE_SIZE_OPTIONS.length - 1])
      : undefined;

    const debouncedSearch = useMemo(
      () =>
        debounce((value: string) => {
          onSearchChange(value);
        }, 500),
      [onSearchChange],
    );

    useEffect(
      () =>
        // Cleanup debounced search
        () => {
          debouncedSearch.cancel();
        },
      [debouncedSearch],
    );

    useEffect(() => {
      if (
        serverPagination &&
        isSearchFocused.get(searchId) &&
        document.activeElement !== inputRef.current
      ) {
        inputRef.current?.focus();
      }
    }, [searchValue, serverPagination, searchId]);

    const handleSearchFocus = useCallback(() => {
      isSearchFocused.set(searchId, true);
    }, [searchId]);

    const handleSearchBlur = useCallback(() => {
      isSearchFocused.set(searchId, false);
    }, [searchId]);

    const onFilterTextBoxChanged = useCallback(
      ({ target: { value } }: ChangeEvent<HTMLInputElement>) => {
        if (serverPagination) {
          setSearchValue(value);
          debouncedSearch(value);
        } else {
          setQuickFilterText(value);
        }
      },
      [serverPagination, debouncedSearch, searchId],
    );

    const handleColSort = (colId: string, sortDir: string) => {
      const isSortable = shouldSort({
        colId,
        sortDir,
        percentMetrics,
        serverPagination: !!serverPagination,
        gridInitialState,
      });

      if (!isSortable) return;

      if (sortDir == null) {
        onSortChange([]);
        return;
      }

      onSortChange([
        {
          id: colId,
          key: colId,
          desc: sortDir === 'desc',
        },
      ]);
    };

    const handleColumnHeaderClick = useCallback(
      params => {
        const colId = params?.column?.colId;
        const sortDir = params?.column?.sort;
        handleColSort(colId, sortDir);
      },
      [serverPagination, gridInitialState, percentMetrics, onSortChange],
    );

    useEffect(() => {
      if (
        hasServerPageLengthChanged &&
        serverPaginationData?.pageSize &&
        !isEqual(serverPaginationData?.pageSize, serverPageLength)
      ) {
        // Explore editor handling
        // if user updates server page length from control panel &
        // if server page length & ownState pageSize are not equal
        // they must be resynced
        onServerPageSizeChange(serverPageLength);
      }
    }, [hasServerPageLengthChanged]);

    const sizeColumnsToContentWhenPossible = useCallback(
      (api: GridApi) => {
        const resize = () => {
          const displayedColumns = api.getAllDisplayedColumns();
          if (!displayedColumns.length) {
            return;
          }

          api.autoSizeColumns(displayedColumns.map(column => column.getColId()));
          const columnSizing = displayedColumns.map((column, index) => {
            const colId = column.getColId();
            const totalValue = cleanedTotals?.[colId];
            const hasTotalValue =
              index === 0 || (totalValue !== undefined && totalValue !== null);
            const totalsBuffer =
              showTotals && hasTotalValue ? TOTALS_WIDTH_BUFFER : 0;
            const minWidth =
              (column.getColDef().minWidth ??
                (typeof defaultColDef.minWidth === 'number'
                  ? defaultColDef.minWidth
                  : 100)) + totalsBuffer;
            const preferredWidth = Math.max(
              column.getActualWidth() + totalsBuffer,
              minWidth,
            );

            return {
              colId,
              minWidth,
              preferredWidth,
            };
          });

          const availableWidth = containerRef.current?.clientWidth ?? width;
          if (!availableWidth) {
            api.applyColumnState({
              state: columnSizing.map(({ colId, preferredWidth }) => ({
                colId,
                width: preferredWidth,
              })),
              applyOrder: false,
            });
            return;
          }

          const totalPreferredWidth = columnSizing.reduce(
            (sum, column) => sum + column.preferredWidth,
            0,
          );
          const totalMinWidth = columnSizing.reduce(
            (sum, column) => sum + column.minWidth,
            0,
          );

          if (totalPreferredWidth <= availableWidth) {
            api.applyColumnState({
              state: columnSizing.map(({ colId, preferredWidth }) => ({
                colId,
                width: preferredWidth,
              })),
              applyOrder: false,
            });
            return;
          }

          if (totalMinWidth >= availableWidth) {
            api.applyColumnState({
              state: columnSizing.map(({ colId, minWidth }) => ({
                colId,
                width: minWidth,
              })),
              applyOrder: false,
            });
            return;
          }

          const shrinkRatio =
            (availableWidth - totalMinWidth) /
            (totalPreferredWidth - totalMinWidth);

          api.applyColumnState({
            state: columnSizing.map(({ colId, minWidth, preferredWidth }) => ({
              colId,
              width: Math.floor(
                minWidth + (preferredWidth - minWidth) * shrinkRatio,
              ),
            })),
            applyOrder: false,
          });
        };

        if (
          typeof window !== 'undefined' &&
          typeof window.requestAnimationFrame === 'function'
        ) {
          window.requestAnimationFrame(resize);
          return;
        }

        resize();
      },
      [cleanedTotals, defaultColDef.minWidth, showTotals, width],
    );

    useEffect(() => {
      if (gridRef.current?.api && !hasStoredColumnState.current) {
        sizeColumnsToContentWhenPossible(gridRef.current.api);
      }
    }, [
      cleanedTotals,
      colDefsFromProps,
      rowData,
      showTotals,
      sizeColumnsToContentWhenPossible,
      width,
    ]);

    const applyStoredColumnState = useCallback(
      (api: GridApi) => {
        if (!storageKey) {
          return false;
        }
        try {
          const storedState = localStorage.getItem(storageKey);
          if (!storedState) {
            return false;
          }
          const parsedState = JSON.parse(storedState);
          if (!Array.isArray(parsedState)) {
            return false;
          }
          api.applyColumnState({
            state: parsedState as ColumnState[],
            applyOrder: true,
          });
          return true;
        } catch (error) {
          return false;
        }
      },
      [storageKey],
    );

    useEffect(() => {
      const api = gridRef.current?.api;
      if (!api || !hasStoredColumnState.current) {
        return;
      }

      applyStoredColumnState(api);
    }, [applyStoredColumnState, colDefsFromProps]);

    const persistColumnState = useCallback(
      (api: GridApi) => {
        if (!storageKey) {
          return;
        }
        try {
          const state = api.getColumnState();
          localStorage.setItem(storageKey, JSON.stringify(state));
          hasStoredColumnState.current = true;
        } catch (error) {
          // Ignore localStorage errors.
        }
      },
      [storageKey],
    );

    const onGridReady = (params: GridReadyEvent) => {
      const restoredState = applyStoredColumnState(params.api);
      hasStoredColumnState.current = restoredState;
      if (!restoredState) {
        sizeColumnsToContentWhenPossible(params.api);
      }
    };

    const handleColumnVisible = useCallback(
      (event: ColumnVisibleEvent) => {
        if (event.visible && event.column) {
          const colDef = event.column.getColDef();
          const minWidth =
            colDef.minWidth ??
            (typeof defaultColDef.minWidth === 'number'
              ? defaultColDef.minWidth
              : 100);

          event.api.applyColumnState({
            state: [{ colId: event.column.getColId(), width: minWidth }],
          });
        }

        persistColumnState(event.api);
      },
      [defaultColDef.minWidth, persistColumnState],
    );

    const handleColumnStateChange = useCallback(
      (event: ColumnPinnedEvent | ColumnMovedEvent) => {
        persistColumnState(event.api);
      },
      [persistColumnState],
    );

    const handleColumnResized = useCallback(
      (event: ColumnResizedEvent) => {
        if (event.finished) {
          persistColumnState(event.api);
        }
      },
      [persistColumnState],
    );

    return (
      <div
        className="table-layout-container"
        style={containerStyles}
        ref={containerRef}
      >
        <div className="dropdown-controls-container">
          {renderTimeComparisonDropdown && (
            <div className="time-comparison-dropdown">
              {renderTimeComparisonDropdown()}
            </div>
          )}
          {includeSearch && (
            <div className="search-container">
              {serverPagination && (
                <div className="search-by-text-container">
                  <span className="search-by-text"> Search by :</span>
                  <SearchSelectDropdown
                    onChange={onSearchColChange}
                    searchOptions={searchOptions}
                    value={serverPaginationData?.searchColumn || ''}
                  />
                </div>
              )}
              <div className="input-wrapper">
                <div className="input-container">
                  <SearchOutlined />
                  <input
                    ref={inputRef}
                    value={
                      serverPagination ? searchValue : quickFilterText || ''
                    }
                    type="text"
                    id={searchId}
                    name={searchId}
                    placeholder="Search"
                    onInput={onFilterTextBoxChanged}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="ag-grid-wrapper">
          <ThemedAgGridReact
            ref={gridRef}
            onGridReady={onGridReady}
            className="ag-container"
            rowData={rowData}
            rowHeight={30}
            columnDefs={colDefsFromProps}
            defaultColDef={defaultColDef}
            components={gridComponents}
            onColumnGroupOpened={params =>
              sizeColumnsToContentWhenPossible(params.api)
            }
            rowSelection={{
              mode: 'multiRow',
              checkboxes: false,
              headerCheckbox: false,
            }}
            animateRows
            rowBuffer={rowBuffer}
            onCellClicked={handleCrossFilter}
            onColumnVisible={handleColumnVisible}
            onColumnPinned={handleColumnStateChange}
            onColumnMoved={handleColumnStateChange}
            onColumnResized={handleColumnResized}
            onCellContextMenu={onCellContextMenu}
            initialState={gridInitialState}
            maintainColumnOrder
            suppressAggFuncInHeader
            enableCellTextSelection
            quickFilterText={serverPagination ? '' : quickFilterText}
            suppressMovableColumns={!allowRearrangeColumns}
            pagination={pagination}
            paginationPageSize={pageSize}
            paginationPageSizeSelector={PAGE_SIZE_OPTIONS}
            suppressRowVirtualisation={!!serverPagination}
            suppressDragLeaveHidesColumns
            pinnedBottomRowData={showTotals ? [cleanedTotals] : undefined}
            localeText={{
              // Pagination controls
              next: t('Next'),
              previous: t('Previous'),
              page: t('Page'),
              more: t('More'),
              to: t('to'),
              of: t('of'),
              first: t('First'),
              last: t('Last'),
              loadingOoo: t('Loading...'),
              // Set Filter
              selectAll: t('Select All'),
              searchOoo: t('Search...'),
              blanks: t('Пусто'),
              // Filter operations
              filterOoo: t('Filter'),
              applyFilter: t('Apply Filter'),
              blank: t('Пусто'),
              notBlank: t('Не пусто'),
              equals: t('Equals'),
              notEqual: t('Not Equal'),
              lessThan: t('Less Than'),
              greaterThan: t('Greater Than'),
              lessThanOrEqual: t('Less Than or Equal'),
              greaterThanOrEqual: t('Greater Than or Equal'),
              inRange: t('In Range'),
              contains: t('Contains'),
              notContains: t('Not Contains'),
              startsWith: t('Starts With'),
              endsWith: t('Ends With'),
              // Logical conditions
              andCondition: t('AND'),
              orCondition: t('OR'),
              // Panel and group labels
              group: t('Group'),
              columns: t('Columns'),
              filters: t('Filters'),
              valueColumns: t('Value Columns'),
              pivotMode: t('Pivot Mode'),
              groups: t('Groups'),
              values: t('Values'),
              pivots: t('Pivots'),
              toolPanelButton: t('Tool Panel'),
              // Enterprise menu items
              pinColumn: t('Pin Column'),
              valueAggregation: t('Value Aggregation'),
              autosizeThiscolumn: t('Autosize This Column'),
              autosizeAllColumns: t('Autosize All Columns'),
              groupBy: t('Group By'),
              ungroupBy: t('Ungroup By'),
              resetColumns: t('Reset Columns'),
              expandAll: t('Expand All'),
              collapseAll: t('Collapse All'),
              toolPanel: t('Tool Panel'),
              export: t('Export'),
              csvExport: t('CSV Export'),
              excelExport: t('Excel Export'),
              excelXmlExport: t('Excel XML Export'),
              // Aggregation functions
              sum: t('Sum'),
              min: t('Min'),
              max: t('Max'),
              none: t('None'),
              count: t('Count'),
              average: t('Average'),
              // Standard menu items
              copy: t('Copy'),
              copyWithHeaders: t('Copy with Headers'),
              paste: t('Paste'),
              // Column menu and sorting
              sortAscending: t('Sort Ascending'),
              sortDescending: t('Sort Descending'),
              sortUnSort: t('Clear Sort'),
            }}
            context={{
              onColumnHeaderClicked: handleColumnHeaderClick,
              initialSortState: getInitialSortState(
                serverPaginationData?.sortBy || [],
              ),
              isActiveFilterValue,
            }}
          />
        </div>
        {serverPagination && (
          <Pagination
            currentPage={serverPaginationData?.currentPage || 0}
            pageSize={
              hasServerPageLengthChanged
                ? serverPageLength
                : serverPaginationData?.pageSize || 10
            }
            totalRows={rowCount || 0}
            pageSizeOptions={[10, 20, 50, 100, 200]}
            onServerPaginationChange={onServerPaginationChange}
            onServerPageSizeChange={onServerPageSizeChange}
            sliceId={id}
          />
        )}
      </div>
    );
  },
);

AgGridDataTable.displayName = 'AgGridDataTable';

export default memo(AgGridDataTable);
