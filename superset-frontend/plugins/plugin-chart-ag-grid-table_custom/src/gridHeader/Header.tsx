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
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { styled } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import type { Column, GridApi } from 'ag-grid-community';

import { Icons } from '@superset-ui/core/components/Icons';
import { PIVOT_COL_ID } from './constants';
import { HeaderMenu } from './HeaderMenu';

interface Params {
  enableFilterButton?: boolean;
  enableSorting?: boolean;
  displayName: string;
  column: Column;
  api: GridApi;
  showFilter?: (buttonElement: HTMLElement) => void;
  setSort: (sort: string | null, multiSort: boolean) => void;
}

const SORT_DIRECTION = [null, 'asc', 'desc'];

const HeaderCell = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  min-height: 100%;
  .ag-header-cell-text {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  &[role='button'] {
    cursor: pointer;
  }
`;

const HeaderRoot = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  column-gap: ${({ theme }) => theme.sizeUnit}px;
`;

const HeaderLabel = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  column-gap: ${({ theme }) => theme.sizeUnit / 2}px;
`;

const HeaderCellSort = styled.span`
  display: inline-flex;
  align-items: center;
  line-height: 1;
  color: ${({ theme }) => theme.colorPrimary};
  font-size: calc(${({ theme }) => theme.fontSizeXS} * 1.3);
  svg {
    width: calc(${({ theme }) => theme.fontSizeXS} * 1.3);
    height: calc(${({ theme }) => theme.fontSizeXS} * 1.3);
  }
`;

const FilterIndicator = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colorPrimary};
  margin-right: ${({ theme }) => theme.sizeUnit / 2}px;
  svg {
    width: calc(${({ theme }) => theme.fontSizeXS} * 1.6);
    height: calc(${({ theme }) => theme.fontSizeXS} * 1.6);
  }
`;

const SortSeqLabel = styled.span`
  margin-left: ${({ theme }) => theme.sizeUnit / 2}px;
  font-size: calc(${({ theme }) => theme.fontSizeXS} * 1.3);
  line-height: 1;
`;

const HeaderActionGroup = styled.div`
  display: inline-flex;
  position: static;
  align-items: center;
  justify-self: end;
  align-self: center;
  flex-shrink: 0;
  min-height: 100%;
  column-gap: ${({ theme }) => theme.sizeUnit}px;
`;

const HeaderAction = styled.div`
  display: inline-flex;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  align-items: center;
  &.main {
    flex-direction: row;
    justify-content: center;
    width: 100%;
  }
  & .ant-dropdown-trigger {
    cursor: context-menu;
    padding: ${({ theme }) => theme.sizeUnit * 2}px;
    background-color: var(--ag-background-color);
    box-shadow: 0 0 2px var(--ag-chip-border-color);
    border-radius: 50%;
    &:hover {
      box-shadow: 0 0 4px ${({ theme }) => theme.colorBorderSecondary};
    }
  }
`;

const FilterTrigger = styled.button`
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  background-color: var(--ag-background-color);
  box-shadow: 0 0 2px var(--ag-chip-border-color);
  border-radius: 50%;
  border: none;
  color: ${({ theme }) => theme.colorTextTertiary};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  outline: none;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  .ag-icon,
  svg {
    color: currentColor;
    fill: currentColor;
  }
  &:hover,
  &:focus-visible {
    color: ${({ theme }) => theme.colorPrimary};
    box-shadow: 0 0 4px ${({ theme }) => theme.colorBorderSecondary};
  }
  &.is-visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
  }
`;

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(item => hasMeaningfulValue(item));
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(item =>
      hasMeaningfulValue(item),
    );
  }
  return false;
};

export const Header: React.FC<Params> = ({
  enableSorting,
  displayName,
  setSort,
  column,
  api,
  showFilter,
}: Params) => {
  const colId = column.getColId();
  const pinnedLeft = column.isPinnedLeft();
  const pinnedRight = column.isPinnedRight();
  const sortOption = useRef<number>(0);
  const [invisibleColumns, setInvisibleColumns] = useState<Column[]>([]);
  const [currentSort, setCurrentSort] = useState<string | null>(null);
  const [sortIndex, setSortIndex] = useState<number | null>();
  const [isFilterActive, setIsFilterActive] = useState(false);
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
  const isSortActive = currentSort === 'asc' || currentSort === 'desc';
  const hideColumn = useCallback(() => {
    const visibleColumns = api.getColumns()?.filter(c => c.isVisible()) || [];
    const canHideColumn =
      colId !== PIVOT_COL_ID &&
      visibleColumns.some(c => c.getColId() === colId);

    if (!canHideColumn || visibleColumns.length <= 1) {
      return;
    }

    api.setColumnsVisible([colId], false);
  }, [api, colId]);
  const onHeaderClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.altKey) {
        hideColumn();
        return;
      }

      if (!enableSorting) {
        return;
      }

      sortOption.current = (sortOption.current + 1) % SORT_DIRECTION.length;
      const sort = SORT_DIRECTION[sortOption.current];
      setSort(sort, event.shiftKey);
      setCurrentSort(sort);
    },
    [enableSorting, hideColumn, setSort],
  );
  const onVisibleChange = useCallback(
    (isVisible: boolean) => {
      if (isVisible) {
        setInvisibleColumns(
          api.getColumns()?.filter(c => !c.isVisible()) || [],
        );
      }
    },
    [api],
  );

  const onSortChanged = useCallback(() => {
    const hasMultiSort =
      api.getAllDisplayedColumns().findIndex(c => c.getSortIndex()) !== -1;
    const updatedSortIndex = column.getSortIndex();
    sortOption.current = SORT_DIRECTION.indexOf(column.getSort() ?? null);
    setCurrentSort(column.getSort() ?? null);
    setSortIndex(hasMultiSort ? updatedSortIndex : null);
  }, [api, column]);

  const onFilterMenuMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      (
        event.nativeEvent as {
          stopImmediatePropagation?: () => void;
        }
      ).stopImmediatePropagation?.();
    },
    [],
  );

  const onFilterMenuClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsFilterMenuVisible(true);
      const target = event.currentTarget as HTMLElement;
      const apiWithMenus = api as GridApi & {
        showFilterMenuAfterButtonClick?: (col: Column, el: HTMLElement) => void;
        showColumnMenuAfterButtonClick?: (col: Column, el: HTMLElement) => void;
        showFilterMenu?: (colId: string) => void;
      };

      if (showFilter) {
        showFilter(target);
        return;
      }

      if (apiWithMenus.showFilterMenuAfterButtonClick) {
        apiWithMenus.showFilterMenuAfterButtonClick(column, target);
        return;
      }

      if (apiWithMenus.showColumnMenuAfterButtonClick) {
        apiWithMenus.showColumnMenuAfterButtonClick(column, target);
        return;
      }

      if (apiWithMenus.showFilterMenu) {
        apiWithMenus.showFilterMenu(colId);
      }
    },
    [api, colId, column, showFilter],
  );

  const onFilterMenuVisibilityChanged = useCallback(
    (event: { visible?: boolean; column?: Column | null }) => {
      const eventColId = event.column?.getColId?.();

      if (event.visible === true && eventColId === colId) {
        setIsFilterMenuVisible(true);
        return;
      }

      if (event.visible === false && (!eventColId || eventColId === colId)) {
        setIsFilterMenuVisible(false);
      }
    },
    [colId],
  );

  const syncFilterState = useCallback(() => {
    const filterModel = api?.getFilterModel?.();
    const columnFilter = colId ? filterModel?.[colId] : null;
    const hasModel = Boolean(columnFilter && hasMeaningfulValue(columnFilter));
    setIsFilterActive(hasModel);
  }, [api, colId]);

  useEffect(() => {
    api.addEventListener('sortChanged', onSortChanged);

    return () => {
      if (api.isDestroyed()) return;
      api.removeEventListener('sortChanged', onSortChanged);
    };
  }, [api, onSortChanged]);

  useEffect(() => {
    api.addEventListener('filterChanged', syncFilterState);
    syncFilterState();

    return () => {
      if (api.isDestroyed()) return;
      api.removeEventListener('filterChanged', syncFilterState);
    };
  }, [api, syncFilterState]);

  useEffect(() => {
    api.addEventListener(
      'columnMenuVisibleChanged',
      onFilterMenuVisibilityChanged,
    );

    return () => {
      if (api.isDestroyed()) return;
      api.removeEventListener(
        'columnMenuVisibleChanged',
        onFilterMenuVisibilityChanged,
      );
    };
  }, [api, onFilterMenuVisibilityChanged]);

  return (
    <HeaderRoot>
      {colId !== PIVOT_COL_ID && (
        <HeaderCell
          tabIndex={0}
          className="ag-header-cell-label"
          role="button"
          onClick={onHeaderClick}
          title={
            enableSorting
              ? t(
                  'Click to sort. Hold ⇧ Shift for multi-sort or Alt + click to hide the column.',
                )
              : t('Hold Alt + click to hide the column.')
          }
        >
          <HeaderLabel>
            <div className="ag-header-cell-text">{displayName}</div>
            {enableSorting && (isSortActive || isFilterActive) && (
              <HeaderCellSort>
                {isFilterActive && (
                  <FilterIndicator aria-hidden="true">
                    <Icons.FilterOutlined />
                  </FilterIndicator>
                )}
                {currentSort === 'asc' && <Icons.CaretUpOutlined />}
                {currentSort === 'desc' && <Icons.CaretDownOutlined />}
                {typeof sortIndex === 'number' && (
                  <SortSeqLabel>{sortIndex + 1}</SortSeqLabel>
                )}
              </HeaderCellSort>
            )}
          </HeaderLabel>
        </HeaderCell>
      )}
      {colId && api && (
        <HeaderActionGroup>
          {colId !== PIVOT_COL_ID && (
            <FilterTrigger
              type="button"
              onMouseDown={onFilterMenuMouseDown}
              onClick={onFilterMenuClick}
              aria-label={t('Open filter menu')}
              className={`filter-trigger${
                isFilterMenuVisible ? ' is-visible' : ''
              }`}
            >
              <span className="ag-icon ag-icon-filter" aria-hidden="true" />
            </FilterTrigger>
          )}
          <HeaderAction
            className={`customHeaderAction${
              colId === PIVOT_COL_ID ? ' main' : ''
            }`}
          >
            {colId && (
              <HeaderMenu
                colId={colId}
                api={api}
                pinnedLeft={pinnedLeft}
                pinnedRight={pinnedRight}
                invisibleColumns={invisibleColumns}
                isMain={colId === PIVOT_COL_ID}
                onVisibleChange={onVisibleChange}
              />
            )}
          </HeaderAction>
        </HeaderActionGroup>
      )}
    </HeaderRoot>
  );
};
