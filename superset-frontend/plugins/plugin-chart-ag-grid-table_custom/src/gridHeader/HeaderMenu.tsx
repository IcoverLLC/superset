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
import { useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import type {
  Column,
  ColumnApi,
  ColumnPinnedType,
  GridApi,
} from 'ag-grid-community';

import { Icons } from '@superset-ui/core/components/Icons';
import { Menu, MenuItem } from '@superset-ui/core/components/Menu';
import copyTextToClipboard from 'src/utils/copy';
import {
  MenuDotsDropdown,
  type DropdownProps,
} from '@superset-ui/core/components';
import { PIVOT_COL_ID } from './constants';

const IconEmpty = styled.span`
  width: 14px;
`;

export type HeaderMenuProps = {
  colId: string;
  column: Column;
  api: GridApi;
  columnApi?: ColumnApi;
  pinnedLeft?: boolean;
  pinnedRight?: boolean;
  invisibleColumns: Column[];
  isMain?: boolean;
  serverPagination?: boolean;
  onVisibleChange: DropdownProps['onOpenChange'];
};

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  colId,
  column,
  api,
  columnApi: columnApiProp,
  pinnedLeft,
  pinnedRight,
  invisibleColumns,
  isMain,
  serverPagination,
  onVisibleChange,
}: HeaderMenuProps) => {
  const pinColumn = useCallback(
    (pinLoc: ColumnPinnedType) => {
      api.setColumnsPinned([colId], pinLoc);
    },
    [api, colId],
  );

  const unHideAction: MenuItem = {
    label: t('Unhide'),
    key: 'unHideSubMenu',
    icon: <Icons.EyeInvisibleOutlined iconSize="m" />,
    children: [
      invisibleColumns.length > 1 && {
        key: 'allHidden',
        label: <b>{t('All %s hidden columns', invisibleColumns.length)}</b>,
        onClick: () => {
          api.setColumnsVisible(invisibleColumns, true);
        },
      },
      ...invisibleColumns.map(c => ({
        key: c.getColId(),
        label: c.getColDef().headerName,
        onClick: () => {
          api.setColumnsVisible([c.getColId()], true);
        },
      })),
    ].filter(Boolean) as MenuItem[],
  };

  const mainMenuItems: MenuItem[] = [
    {
      key: 'copyData',
      label: t('Copy the current data'),
      icon: <Icons.CopyOutlined iconSize="m" />,
      onClick: () => {
        copyTextToClipboard(
          () =>
            new Promise((resolve, reject) => {
              const data = api.getDataAsCsv({
                columnKeys: api
                  .getAllDisplayedColumns()
                  .map(c => c.getColId())
                  .filter(id => id !== colId),
                suppressQuotes: true,
                columnSeparator: '\t',
              });
              if (data) {
                resolve(data);
              } else {
                reject();
              }
            }),
        );
      },
    },
    {
      key: 'downloadCsv',
      label: t('Download to CSV'),
      icon: <Icons.DownloadOutlined iconSize="m" />,
      onClick: () => {
        api.exportDataAsCsv({
          columnKeys: api
            .getAllDisplayedColumns()
            .map(c => c.getColId())
            .filter(id => id !== colId),
        });
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'autoSizeAllColumns',
      label: t('Autosize all columns'),
      icon: <Icons.ColumnWidthOutlined iconSize="m" />,
      onClick: () => {
        api.autoSizeAllColumns();
      },
    },
    unHideAction,
    {
      type: 'divider',
    },
    {
      key: 'resetColumns',
      label: t('Reset columns'),
      icon: <IconEmpty className="anticon" />,
      onClick: () => {
        api.setColumnsVisible(invisibleColumns, true);
        const columns = api.getColumns();
        if (columns) {
          const pinnedColumns = columns.filter(
            c => c.getColId() !== PIVOT_COL_ID && c.isPinned(),
          );
          api.setColumnsPinned(pinnedColumns, null);
          api.moveColumns(columns, 0);
          const firstColumn = columns.find(c => c.getColId() !== PIVOT_COL_ID);
          if (firstColumn) {
            api.ensureColumnVisible(firstColumn, 'start');
          }
        }
      },
    },
  ];

  const columnApi = columnApiProp ?? api.getColumnApi?.();
  const rowGroupColumns = columnApi?.getRowGroupColumns?.() || [];
  const hasGrouping = rowGroupColumns.length > 0;
  const isGroupedByThis = rowGroupColumns.some(
    groupedColumn => groupedColumn.getColId() === colId,
  );
  const colDef = column.getColDef();
  const isMetric =
    colDef?.context?.isMetric || colDef?.context?.isPercentMetric;
  const isGroupable =
    !!columnApi && !isMetric && colDef?.enableRowGroup !== false;
  const groupingDisabled = !!serverPagination;
  const groupingDisabledLabel = t(
    'Grouping is available only when client-side pagination is used.',
  );

  const clearGrouping = useCallback(() => {
    if (!columnApi) {
      return;
    }
    if (columnApi.setRowGroupColumns) {
      columnApi.setRowGroupColumns([]);
      return;
    }
    rowGroupColumns.forEach(groupedColumn => {
      columnApi.removeRowGroupColumn?.(groupedColumn);
    });
  }, [columnApi, rowGroupColumns]);

  const setSingleGroupColumn = useCallback(
    (columnId: string) => {
      if (!columnApi) {
        return;
      }
      if (columnApi.setRowGroupColumns) {
        columnApi.setRowGroupColumns([columnId]);
        return;
      }
      rowGroupColumns.forEach(groupedColumn => {
        columnApi.removeRowGroupColumn?.(groupedColumn);
      });
      columnApi.addRowGroupColumn?.(columnId);
    },
    [columnApi, rowGroupColumns],
  );

  const menuItems: MenuItem[] = [
    {
      key: 'copy',
      label: t('Copy'),
      icon: <Icons.CopyOutlined iconSize="m" />,
      onClick: () => {
        copyTextToClipboard(
          () =>
            new Promise((resolve, reject) => {
              const data = api.getDataAsCsv({
                columnKeys: [colId],
                suppressQuotes: true,
              });
              if (data) {
                resolve(data);
              } else {
                reject();
              }
            }),
        );
      },
    },
    ...(isGroupable && !isMain
      ? [
          !isGroupedByThis && {
            key: 'groupByThisColumn',
            label: (
              <span title={groupingDisabled ? groupingDisabledLabel : undefined}>
                {t('Group by this column / Сгруппировать по этому столбцу')}
              </span>
            ),
            icon: <Icons.UnorderedListOutlined iconSize="m" />,
            disabled: groupingDisabled,
            onClick: () => {
              if (groupingDisabled) {
                return;
              }
              setSingleGroupColumn(colId);
            },
          },
          isGroupedByThis && {
            key: 'ungroup',
            label: t('Ungroup / Убрать группировку'),
            icon: <Icons.DeleteOutlined iconSize="m" />,
            onClick: () => clearGrouping(),
          },
          hasGrouping && {
            key: 'clearGrouping',
            label: t('Clear grouping / Сбросить группировку'),
            icon: <Icons.DeleteOutlined iconSize="m" />,
            onClick: () => clearGrouping(),
          },
          ((!isGroupedByThis && !groupingDisabled) ||
            isGroupedByThis ||
            hasGrouping) && { type: 'divider' },
        ].filter(Boolean) as MenuItem[]
      : []),
    ...(pinnedLeft || pinnedRight
      ? [
          {
            key: 'unpin',
            label: t('Unpin'),
            icon: <Icons.UnlockOutlined iconSize="m" />,
            onClick: () => pinColumn(null),
          },
        ]
      : []),
    ...(!pinnedLeft
      ? [
          {
            key: 'pinLeft',
            label: t('Pin Left'),
            icon: <Icons.VerticalRightOutlined iconSize="m" />,
            onClick: () => pinColumn('left'),
          },
        ]
      : []),
    ...(!pinnedRight
      ? [
          {
            key: 'pinRight',
            label: t('Pin Right'),
            icon: <Icons.VerticalLeftOutlined iconSize="m" />,
            onClick: () => pinColumn('right'),
          },
        ]
      : []),
    { type: 'divider' },
    {
      key: 'autosize',
      label: t('Autosize Column'),
      icon: <Icons.ColumnWidthOutlined iconSize="m" />,
      onClick: () => {
        api.autoSizeColumns([colId]);
      },
    },
    {
      key: 'hide',
      label: t('Hide Column'),
      icon: <Icons.EyeInvisibleOutlined iconSize="m" />,
      onClick: () => {
        api.setColumnsVisible([colId], false);
      },
      disabled: api.getColumns()?.length === invisibleColumns.length + 1,
    },
    ...(invisibleColumns.length > 0 ? [unHideAction] : []),
  ];

  return (
    <MenuDotsDropdown
      placement="bottomRight"
      trigger={['click']}
      onOpenChange={onVisibleChange}
      overlay={
        <Menu
          style={{ width: isMain ? 250 : 180 }}
          mode="vertical"
          items={isMain ? mainMenuItems : menuItems}
        />
      }
    />
  );
};
