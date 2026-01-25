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
  CellClickedEvent,
  IMenuActionParams,
} from '@superset-ui/core/components/ThemedAgGridReact';
import type { ColumnApi, ColumnState, GridApi } from 'ag-grid-community';
import { type FunctionComponent } from 'react';
import { JsonObject, DataRecordValue, DataRecord, t } from '@superset-ui/core';
import { SearchOutlined } from '@ant-design/icons';
import { debounce, isEqual } from 'lodash';
import Pagination from './components/Pagination';
import SearchSelectDropdown from './components/SearchSelectDropdown';
import { SearchOption, SortByItem, TableChartFormData } from '../types';
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
  handleCrossFilter: (event: CellClickedEvent | IMenuActionParams) => void;
  isActiveFilterValue: (key: string, val: DataRecordValue) => boolean;
  renderTimeComparisonDropdown: () => JSX.Element | null;
  cleanedTotals: DataRecord;
  showTotals: boolean;
  width: number;
  formData?: TableChartFormData;
}

ModuleRegistry.registerModules([AllCommunityModule, ClientSideRowModelModule]);

const isSearchFocused = new Map<string, boolean>();

type PersistedAgGridState = {
  v: 1;
  colState: ColumnState[];
  filterModel: unknown;
};

type PersistHelpers = {
  clearPersistedState: () => void;
  storageKey: string;
  paramName: string;
};

const buildUrlParamName = (id: string | number) => `agcs_${id}`;

const encodeState = (obj: PersistedAgGridState) => {
  try {
    const json = JSON.stringify(obj);
    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  } catch (error) {
    return '';
  }
};

const decodeState = (value: string): PersistedAgGridState | null => {
  try {
    const paddedValue = value.padEnd(Math.ceil(value.length / 4) * 4, '=');
    const base64 = paddedValue.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const parsed = JSON.parse(json) as PersistedAgGridState;
    if (parsed?.v !== 1 || !Array.isArray(parsed?.colState)) {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
};

const readStateFromUrl = (paramName: string) => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const encoded = urlParams.get(paramName);
    if (!encoded) return null;
    return decodeState(encoded);
  } catch (error) {
    return null;
  }
};

const deleteStateFromUrl = (paramName: string) => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has(paramName)) return;
    urlParams.delete(paramName);
    const search = urlParams.toString();
    const nextUrl = `${window.location.pathname}${
      search ? `?${search}` : ''
    }${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  } catch (error) {
    // Ignore history errors.
  }
};

const writeStateToUrl = (paramName: string, encodedOrNull: string | null) => {
  if (!encodedOrNull) {
    deleteStateFromUrl(paramName);
    return;
  }
  if (encodedOrNull.length > 1800) {
    deleteStateFromUrl(paramName);
    return;
  }
  try {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set(paramName, encodedOrNull);
    const search = urlParams.toString();
    const nextUrl = `${window.location.pathname}${
      search ? `?${search}` : ''
    }${window.location.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  } catch (error) {
    // Ignore history errors.
  }
};

const getColDefsSignature = (colDefs: ColDef[]) => {
  const parts: string[] = [];
  const collectParts = (defs: ColDef[]) => {
    defs.forEach(def => {
      const signature = [def.colId, def.field, def.headerName]
        .filter(Boolean)
        .join(':');
      if (signature) {
        parts.push(signature);
      }
      const maybeChildren = def as ColDef & { children?: ColDef[] };
      if (Array.isArray(maybeChildren.children)) {
        collectParts(maybeChildren.children);
      }
    });
  };
  collectParts(colDefs);
  return parts.join('|');
};

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
    formData,
  }) => {
    const gridRef = useRef<AgGridReact>(null);
    const gridApiRef = useRef<GridApi | null>(null);
    const columnApiRef = useRef<ColumnApi | null>(null);
    const isApplyingStateRef = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const rowData = useMemo(() => data, [data]);
    const containerRef = useRef<HTMLDivElement>(null);
    const hasStoredColumnState = useRef(false);

    const resolvedSliceId = useMemo(
      () =>
        formData?.slice_id ??
        formData?.sliceId ??
        serverPaginationData?.slice_id ??
        serverPaginationData?.sliceId ??
        id,
      [formData, serverPaginationData, id],
    );

    const searchId = `search-${resolvedSliceId}`;
    const storageKey = useMemo(
      () => `aggrid_state_custom:${resolvedSliceId}`,
      [resolvedSliceId],
    );
    const paramName = useMemo(
      () => buildUrlParamName(resolvedSliceId),
      [resolvedSliceId],
    );

    const gridInitialState: GridState = {
      ...(serverPagination && {
        sort: {
          sortModel: getInitialSortState(serverPaginationData?.sortBy || []),
        },
      }),
    };

    const persistHelpers = useMemo<PersistHelpers>(
      () => ({
        clearPersistedState: () => {
          try {
            localStorage.removeItem(storageKey);
          } catch (error) {
            // Ignore localStorage errors.
          }
          deleteStateFromUrl(paramName);
          hasStoredColumnState.current = false;
        },
        storageKey,
        paramName,
      }),
      [storageKey, paramName],
    );

    const defaultColDef = useMemo<ColDef>(
      () => ({
        filter: true,
        sortable: true,
        resizable: true,
        minWidth: 100,
        headerComponentParams: {
          persistHelpers,
        },
      }),
      [persistHelpers],
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
        height: gridHeight,
        width,
      }),
      [gridHeight, width],
    );

    const [quickFilterText, setQuickFilterText] = useState<string>();
    const [searchValue, setSearchValue] = useState(
      serverPaginationData?.searchText || '',
    );

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

    useEffect(() => {
      if (gridRef.current?.api && !hasStoredColumnState.current) {
        gridRef.current.api.sizeColumnsToFit();
      }
    }, [width]);

    const applySavedState = useCallback(
      (columnApi: ColumnApi, gridApi: GridApi) => {
        if (isApplyingStateRef.current) {
          return false;
        }
        const applyState = (state: PersistedAgGridState) => {
          columnApi.applyColumnState({
            state: state.colState,
            applyOrder: true,
          });
          gridApi.setFilterModel(state.filterModel ?? null);
          gridApi.onFilterChanged();
        };

        const urlState = readStateFromUrl(paramName);
        if (urlState) {
          isApplyingStateRef.current = true;
          try {
            applyState(urlState);
            try {
              localStorage.setItem(storageKey, JSON.stringify(urlState));
            } catch (error) {
              // Ignore localStorage errors.
            }
            hasStoredColumnState.current = true;
            return true;
          } finally {
            isApplyingStateRef.current = false;
          }
        }

        try {
          const storedState = localStorage.getItem(storageKey);
          if (!storedState) {
            return false;
          }
          const parsedState = JSON.parse(storedState) as PersistedAgGridState;
          if (parsedState?.v !== 1 || !Array.isArray(parsedState?.colState)) {
            return false;
          }
          isApplyingStateRef.current = true;
          try {
            applyState(parsedState);
            hasStoredColumnState.current = true;
            return true;
          } finally {
            isApplyingStateRef.current = false;
          }
        } catch (error) {
          return false;
        }
      },
      [paramName, storageKey],
    );

    const persistState = useCallback(
      (
        columnApi: ColumnApi | null | undefined,
        gridApi: GridApi | null | undefined,
      ) => {
        if (isApplyingStateRef.current) {
          return;
        }
        const resolvedColumnApi = columnApi ?? columnApiRef.current;
        const resolvedGridApi = gridApi ?? gridApiRef.current;
        if (!resolvedColumnApi || !resolvedGridApi) {
          return;
        }
        const state: PersistedAgGridState = {
          v: 1,
          colState: resolvedColumnApi.getColumnState(),
          filterModel: resolvedGridApi.getFilterModel(),
        };
        try {
          localStorage.setItem(storageKey, JSON.stringify(state));
          hasStoredColumnState.current = true;
        } catch (error) {
          // Ignore localStorage errors.
        }
        writeStateToUrl(paramName, encodeState(state));
      },
      [paramName, storageKey],
    );

    const onGridReady = (params: GridReadyEvent) => {
      gridApiRef.current = params.api;
      columnApiRef.current = params.columnApi;
      const restoredState = applySavedState(params.columnApi, params.api);
      hasStoredColumnState.current = restoredState;
      if (!restoredState) {
        // This will make columns fill the grid width
        params.api.sizeColumnsToFit();
      }
    };

    const handleColumnStateChange = useCallback(
      event => {
        persistState(event.columnApi, event.api);
      },
      [persistState],
    );

    const handleColumnResized = useCallback(
      event => {
        if (event.finished) {
          persistState(event.columnApi, event.api);
        }
      },
      [persistState],
    );

    const handleFilterChanged = useCallback(
      event => {
        persistState(event.columnApi, event.api);
      },
      [persistState],
    );

    const handleColumnEverythingChanged = useCallback(
      event => {
        if (isApplyingStateRef.current) return;
        requestAnimationFrame(() => {
          applySavedState(event.columnApi, event.api);
        });
      },
      [applySavedState],
    );

    const colDefsSignature = useMemo(
      () => getColDefsSignature(colDefsFromProps),
      [colDefsFromProps],
    );

    useEffect(() => {
      if (!columnApiRef.current || !gridApiRef.current) return;
      requestAnimationFrame(() => {
        applySavedState(columnApiRef.current!, gridApiRef.current!);
      });
    }, [applySavedState, colDefsSignature]);

    return (
      <div style={containerStyles} ref={containerRef}>
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
                    id="filter-text-box"
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

        <ThemedAgGridReact
          ref={gridRef}
          onGridReady={onGridReady}
          className="ag-container"
          rowData={rowData}
          headerHeight={36}
          rowHeight={30}
          columnDefs={colDefsFromProps}
          defaultColDef={defaultColDef}
          components={gridComponents}
          frameworkComponents={gridComponents}
          onColumnGroupOpened={params => params.api.sizeColumnsToFit()}
          rowSelection="multiple"
          animateRows
          onCellClicked={handleCrossFilter}
          onColumnVisible={handleColumnStateChange}
          onColumnPinned={handleColumnStateChange}
          onColumnMoved={handleColumnStateChange}
          onColumnResized={handleColumnResized}
          onFilterChanged={handleFilterChanged}
          onColumnEverythingChanged={handleColumnEverythingChanged}
          initialState={gridInitialState}
          suppressAggFuncInHeader
          enableCellTextSelection
          quickFilterText={serverPagination ? '' : quickFilterText}
          suppressMovableColumns={!allowRearrangeColumns}
          pagination={pagination}
          paginationPageSize={pageSize}
          paginationPageSizeSelector={PAGE_SIZE_OPTIONS}
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
            blanks: t('Blanks'),
            // Filter operations
            filterOoo: t('Filter'),
            applyFilter: t('Apply Filter'),
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
            persistHelpers,
          }}
        />
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
