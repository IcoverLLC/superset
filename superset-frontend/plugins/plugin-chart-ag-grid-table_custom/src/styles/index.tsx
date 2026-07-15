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
import { css, styled } from '@apache-superset/core/theme';
import { Select } from '@superset-ui/core/components';

/* Components for AgGridTable */
// Header Styles
export const Container = styled.div`
  ${({ theme }) => `
    display: flex;
    width: 100%;

    .three-dots-menu {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: ${theme.sizeUnit / 2}px;
      border-radius: ${theme.borderRadius}px;
    }
  `}
`;

export const HeaderContainer = styled.div`
  ${({ theme }) => `
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0 ${theme.sizeUnit * 2}px;
    overflow: hidden;
  `}
`;

export const HeaderLabel = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    overflow: hidden;
    max-width: 100%;
  `}
`;

export const SortIconWrapper = styled.span`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    margin-left: ${theme.sizeUnit * 2}px;
  `}
`;

export const FilterIconWrapper = styled.div<{ isFilterActive?: boolean }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 4px;
  overflow: hidden;
  cursor: pointer;
  border-radius: 4px;

  ${({ isFilterActive }) =>
    isFilterActive &&
    css`
      background: linear-gradient(
        var(--ag-icon-button-active-background-color),
        var(--ag-icon-button-active-background-color)
      );
      ::after {
        background-color: var(--ag-accent-color);
        border-radius: 50%;
        content: '';
        height: 6px;
        position: absolute;
        right: 4px;
        width: 6px;
      }
    `}

  svg {
    ${({ isFilterActive }) =>
      isFilterActive &&
      css`
        clip-path: path('M8,0C8,4.415 11.585,8 16,8L16,16L0,16L0,0L8,0Z');
        color: var(--ag-icon-button-active-color);
      `}

    :hover {
      ${({ isFilterActive }) =>
        !isFilterActive &&
        css`
          background-color: var(--ag-icon-button-hover-background-color);
          box-shadow: 0 0 0 var(--ag-icon-button-background-spread)
            var(--ag-icon-button-hover-background-color);
          color: var(--ag-icon-button-hover-color);
          border-radius: var(--ag-icon-button-border-radius);
        `}
    }
  }
`;

export const MenuContainer = styled.div`
  ${({ theme }) => `
    min-width: ${theme.sizeUnit * 45}px;
    padding: ${theme.sizeUnit}px 0;

    .menu-item {
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;

      &:hover {
        background-color: ${theme.colorPrimaryBgHover};
      }
    }

    .menu-divider {
      height: 1px;
      background-color: ${theme.colorBorderSecondary};
      margin: ${theme.sizeUnit}px 0;
    }
  `}
`;

export const PopoverWrapper = styled.div`
  position: static;
  display: inline-block;
`;

export const PopoverContainer = styled.div`
  ${({ theme }) =>
    `
      position: fixed;
      box-shadow: var(--ag-menu-shadow);
      border-radius: ${theme.sizeUnit}px;
      z-index: 99;
      min-width: ${theme.sizeUnit * 50}px;
      background: var(--ag-menu-background-color);
      border: var(--ag-menu-border);
      box-shadow: var(--ag-menu-shadow);
      color: var(--ag-menu-text-color);

    `}
`;

export const PaginationContainer = styled.div`
  ${({ theme }) => `
    border: 1px solid ${theme.colorBorderSecondary};
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colorBorderSecondary};
    font-size: ${theme.fontSize}px;
    color: ${theme.colorTextBase};
    transform: translateY(-${theme.sizeUnit}px);
    background: ${theme.colorBgBase};
  `}
`;

export const SelectWrapper = styled.div`
  ${({ theme }) => `
    position: relative;
    margin-left: ${theme.sizeUnit * 2}px;
    display: inline-block;
    min-width: ${theme.sizeUnit * 17}px;
    overflow: hidden;
  `}
`;

export const PageInfo = styled.span`
  ${({ theme }) => `
    margin: 0 ${theme.sizeUnit * 6}px;
    span {
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

export const PageCount = styled.span`
  ${({ theme }) => `
    span {
      font-weight: ${theme.fontWeightStrong};
    }
  `}
`;

export const ButtonGroup = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

export const PageButton = styled.div<{ disabled?: boolean }>`
  ${({ theme, disabled }) => `
    cursor: ${disabled ? 'not-allowed' : 'pointer'};
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      height: ${theme.sizeUnit * 3}px;
      width: ${theme.sizeUnit * 3}px;
      fill: ${disabled ? theme.colorTextQuaternary : theme.colorTextSecondary};
    }
  `}
`;

export const StyledSelect = styled(Select)`
  ${({ theme }) => `
    width: ${theme.sizeUnit * 30}px;
    margin-right: ${theme.sizeUnit * 2}px;
  `}
`;

// Time Comparison Visibility Styles
export const InfoText = styled.div`
  max-width: 242px;
  ${({ theme }) => `
    padding: 0 ${theme.sizeUnit * 2}px;
    color: ${theme.colorTextBase};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

export const ColumnLabel = styled.span`
  ${({ theme }) => `
    color: ${theme.colorTextLabel};
  `}
`;

export const CheckIconWrapper = styled.span`
  ${({ theme }) => `
    float: right;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

// Text Cell Renderer Styles
export const SummaryContainer = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit}px;
  `}
`;

export const SummaryText = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
  `}
`;

// Table Container Styles
export const StyledChartContainer = styled.div<{
  height: number;
}>`
  ${({ theme, height }) => css`
    display: flex;
    flex-direction: column;
    height: ${height}px;
    min-height: 0;

    --ag-background-color: ${theme.colorBgBase};
    --ag-foreground-color: ${theme.colorText};
    --ag-header-background-color: ${theme.colorBgBase};
    --ag-header-foreground-color: ${theme.colorText};

    .dt-is-filter {
      cursor: pointer;
      :hover {
        background-color: ${theme.colorPrimaryBgHover};
      }
    }

    .dt-is-active-filter {
      background: ${theme.colorPrimaryBg};
      :hover {
        background-color: ${theme.colorPrimaryBgHover};
      }
    }

    .dt-truncate-cell {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dt-truncate-cell:hover {
      text-overflow: clip;
      white-space: normal;
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .table-layout-container {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    .ag-grid-wrapper {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .ag-container {
      flex: 1;
      min-height: 0;
      border-radius: 0px;
      border: var(--ag-wrapper-border);
    }

    .ag-input-wrapper {
      ::before {
        z-index: 100;
      }
    }

    .filter-popover {
      z-index: 1 !important;
    }

    .search-container {
      display: flex;
      justify-content: flex-end;
      margin-bottom: ${theme.sizeUnit * 4}px;
    }

    .dropdown-controls-container {
      display: flex;
      flex-shrink: 0;
      justify-content: flex-end;
    }

    .time-comparison-dropdown {
      display: flex;
      flex-shrink: 0;
      padding-right: ${theme.sizeUnit * 4}px;
      padding-top: ${theme.sizeUnit * 1.75}px;
      height: fit-content;
    }

    .pagination-container {
      flex-shrink: 0;
    }

    .ag-header {
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
    }

    .ag-header-cell .ag-header-cell-comp-wrapper > div {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .ag-header-cell .ag-header-cell-comp-wrapper > div > .ag-header-cell-label {
      width: 100% !important;
      min-width: 0 !important;
      padding-right: 0 !important;
    }

    .ag-header-cell
      .ag-header-cell-comp-wrapper
      > div
      > .ag-header-cell-label
      > div {
      width: 100% !important;
      min-width: 0 !important;
      max-width: none !important;
    }

    .ag-header-cell .ag-header-cell-text {
      max-width: none !important;
      width: 100% !important;
    }

    .ag-header-cell {
      overflow: hidden;
      border-right: 1px solid ${theme.colorBorderSecondary};
    }

    .ag-header-cell:last-child {
      border-right: none;
    }

    .ag-header-cell .filter-trigger,
    .ag-header-cell .customHeaderAction {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      position: absolute !important;
      top: 50%;
      transform: translateY(-50%);
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .ag-header-cell .filter-trigger {
      right: 28px;
    }

    .ag-header-cell .customHeaderAction {
      right: 6px;
    }

    .ag-header-cell:hover .customHeaderAction,
    .ag-header-cell .customHeaderAction.is-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .ag-header-cell:hover .filter-trigger,
    .ag-header-cell .filter-trigger.is-visible {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    .ag-row {
      font-size: ${theme.fontSizeSM}px;
    }

    .ag-cell {
      border-right: 1px solid ${theme.colorBorderSecondary};
    }

    .ag-cell:last-child {
      border-right: none;
    }

    .ag-row-pinned {
      font-size: calc(${theme.fontSizeSM}px * 1.1);
    }

    .ag-spanned-row {
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
    }

    .ag-root-wrapper {
      border-radius: 0px;
    }
    .search-by-text-container {
      display: flex;
      align-items: center;
    }

    .search-by-text {
      margin-right: ${theme.sizeUnit * 2}px;
    }

    .ant-popover-inner {
      padding: 0px;
    }

    .input-container {
      margin-left: auto;
    }

    .input-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      overflow: visible;
    }

    .input-wrapper svg {
      pointer-events: none;
      transform: translate(${theme.sizeUnit * 7}px, ${theme.sizeUnit / 2}px);
      color: ${theme.colorTextBase};
    }

    .input-wrapper input {
      color: ${theme.colorText};
      font-size: ${theme.fontSizeSM}px;
      padding: ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 3}px
        ${theme.sizeUnit * 1.5}px ${theme.sizeUnit * 8}px;
      line-height: 1.8;
      border-radius: ${theme.borderRadius}px;
      border: 1px solid ${theme.colorBorderSecondary};
      background-color: transparent;
      outline: none;

      &:focus {
        border-color: ${theme.colorPrimary};
      }

      &::placeholder {
        color: ${theme.colorTextQuaternary};
      }
    }
  `}
`;
