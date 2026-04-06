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
import { Fragment, useCallback, useState, useMemo, memo } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import { css, styled, t } from '@superset-ui/core';
import { Checkbox } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import {
  Draggable,
  Droppable,
} from 'src/dashboard/components/dnd/DragDroppable';
import DragHandle from 'src/dashboard/components/dnd/DragHandle';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import IconButton from 'src/dashboard/components/IconButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import backgroundStyleOptions from 'src/dashboard/util/backgroundStyleOptions';
import { componentShape } from 'src/dashboard/util/propShapes';
import {
  BACKGROUND_TRANSPARENT,
  GRID_MIN_COLUMN_COUNT,
} from 'src/dashboard/util/constants';
import { EMPTY_CONTAINER_Z_INDEX } from 'src/dashboard/constants';
import { ROW_TYPE } from 'src/dashboard/util/componentTypes';

const propTypes = {
  id: PropTypes.string.isRequired,
  parentId: PropTypes.string.isRequired,
  component: componentShape.isRequired,
  parentComponent: componentShape.isRequired,
  index: PropTypes.number.isRequired,
  depth: PropTypes.number.isRequired,
  editMode: PropTypes.bool.isRequired,

  // grid related
  availableColumnCount: PropTypes.number.isRequired,
  columnWidth: PropTypes.number.isRequired,
  minColumnWidth: PropTypes.number.isRequired,
  onResizeStart: PropTypes.func.isRequired,
  onResize: PropTypes.func.isRequired,
  onResizeStop: PropTypes.func.isRequired,

  // dnd
  deleteComponent: PropTypes.func.isRequired,
  handleComponentDrop: PropTypes.func.isRequired,
  updateComponents: PropTypes.func.isRequired,

  // runtime collapse behavior
  isColumnCollapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  runtimeWidth: PropTypes.number,
};

const defaultProps = {
  isColumnCollapsed: false,
  onToggleCollapse: undefined,
  runtimeWidth: undefined,
};

const ColumnStyles = styled.div`
  ${({ theme, editMode, isCollapsed }) => css`
    &.grid-column {
      width: 100%;
      position: relative;
      min-height: ${isCollapsed ? theme.sizeUnit * 14 : 0}px;

      & > :not(.hover-menu):not(:last-child) {
        ${!editMode && `margin-bottom: ${theme.sizeUnit * 4}px;`}
      }
    }

    .dashboard--editing &:after {
      content: '';
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
      border: 1px dashed ${theme.colorBorder};
    }
    .dashboard--editing .resizable-container--resizing:hover > &:after,
    .dashboard--editing .hover-menu:hover + &:after {
      border: 1px dashed ${theme.colorPrimary};
      z-index: 2;
    }

    & .empty-droptarget {
      &.droptarget-edge {
        position: absolute;
        z-index: ${EMPTY_CONTAINER_Z_INDEX};
        &:first-child {
          inset-block-start: 0;
        }
      }
      &:first-child:not(.droptarget-edge) {
        position: absolute;
        z-index: ${EMPTY_CONTAINER_Z_INDEX};
        width: 100%;
        height: 100%;
      }
    }
  `}
`;

const emptyColumnContentStyles = theme => css`
  min-height: ${theme.sizeUnit * 25}px;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colorTextLabel};
`;

const MenuCheckboxLabel = styled.div`
  ${({ theme }) => css`
    white-space: nowrap;

    .ant-checkbox-wrapper {
      display: inline-flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const CollapseToggleButton = styled.button`
  ${({ theme, collapsed }) => css`
    position: absolute;
    top: 0;
    right: 0;
    z-index: 3;
    border: 1px solid ${theme.colorPrimaryBorder};
    background: ${collapsed
      ? theme.colorPrimaryBg
      : `linear-gradient(135deg, transparent 0 46%, ${theme.colorPrimaryBg} 46% 100%)`};
    color: ${theme.colorPrimary};
    box-shadow:
      inset 0 0 0 1px ${theme.colorPrimaryBorder},
      ${theme.boxShadowSecondary};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    opacity: ${collapsed ? 0.95 : 0.82};
    width: ${collapsed ? theme.sizeUnit * 6 : theme.sizeUnit * 9}px;
    min-width: ${collapsed ? theme.sizeUnit * 6 : theme.sizeUnit * 9}px;
    height: ${collapsed ? theme.sizeUnit * 18 : theme.sizeUnit * 9}px;
    min-height: ${collapsed ? theme.sizeUnit * 18 : theme.sizeUnit * 9}px;
    border-radius: ${collapsed
      ? `${theme.borderRadius * 2}px`
      : `0 ${theme.borderRadius * 2}px 0 ${theme.borderRadius * 4}px`};
    clip-path: ${collapsed
      ? 'none'
      : 'polygon(100% 0, 0 0, 100% 100%)'};
    transition:
      opacity 0.2s ease,
      background-color 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;

    svg {
      position: absolute;
      top: ${collapsed ? theme.sizeUnit * 6 : theme.sizeUnit}px;
      right: ${collapsed ? theme.sizeUnit : theme.sizeUnit / 2}px;
    }

    &:hover {
      background: ${theme.colorPrimaryBgHover};
      border-color: ${theme.colorPrimaryBorderHover};
      box-shadow:
        inset 0 0 0 1px ${theme.colorPrimaryBorderHover},
        ${theme.boxShadowSecondary};
      opacity: 1;
    }
  `}
`;

const Column = props => {
  const {
    component: columnComponent,
    parentComponent,
    index,
    availableColumnCount,
    columnWidth,
    minColumnWidth,
    depth,
    onResizeStart,
    onResize,
    onResizeStop,
    handleComponentDrop,
    editMode,
    onChangeTab,
    isComponentVisible,
    deleteComponent,
    id,
    parentId,
    updateComponents,
    isColumnCollapsed,
    onToggleCollapse,
    runtimeWidth,
  } = props;

  const [isFocused, setIsFocused] = useState(false);

  const handleDeleteComponent = useCallback(() => {
    deleteComponent(id, parentId);
  }, [deleteComponent, id, parentId]);

  const handleChangeFocus = useCallback(nextFocus => {
    setIsFocused(Boolean(nextFocus));
  }, []);

  const updateColumnMeta = useCallback(
    nextMeta => {
      updateComponents({
        [columnComponent.id]: {
          ...columnComponent,
          meta: {
            ...columnComponent.meta,
            ...nextMeta,
          },
        },
      });
    },
    [columnComponent, updateComponents],
  );

  const handleChangeBackground = useCallback(
    nextValue => {
      if (nextValue && columnComponent.meta.background !== nextValue) {
        updateColumnMeta({ background: nextValue });
      }
    },
    [columnComponent.meta.background, updateColumnMeta],
  );

  const handleChangeCollapseEnabled = useCallback(
    event => {
      const enableCollapse = event.target.checked;
      updateColumnMeta({
        enableCollapse,
        collapsedByDefault: enableCollapse
          ? Boolean(columnComponent.meta.collapsedByDefault)
          : false,
      });
    },
    [columnComponent.meta.collapsedByDefault, updateColumnMeta],
  );

  const handleChangeCollapsedByDefault = useCallback(
    event => {
      updateColumnMeta({ collapsedByDefault: event.target.checked });
    },
    [updateColumnMeta],
  );

  const columnItems = useMemo(
    () => columnComponent.children || [],
    [columnComponent.children],
  );

  const backgroundStyle = backgroundStyleOptions.find(
    opt =>
      opt.value === (columnComponent.meta.background || BACKGROUND_TRANSPARENT),
  );

  const canCollapse =
    parentComponent?.type === ROW_TYPE && Boolean(columnComponent.meta.enableCollapse);
  const isCollapsed = canCollapse && !editMode && isColumnCollapsed;
  const displayedWidth = isCollapsed
    ? GRID_MIN_COLUMN_COUNT
    : runtimeWidth ?? columnComponent.meta.width;

  const handleToggleCollapsed = useCallback(() => {
    onToggleCollapse?.(columnComponent.id);
  }, [columnComponent.id, onToggleCollapse]);

  const menuItems = useMemo(
    () => [
      <BackgroundStyleDropdown
        key={`${columnComponent.id}-background`}
        id={`${columnComponent.id}-background`}
        value={columnComponent.meta.background}
        onChange={handleChangeBackground}
      />,
      <MenuCheckboxLabel key={`${columnComponent.id}-collapse-enabled`}>
        <Checkbox
          name={`${columnComponent.id}-collapse-enabled`}
          checked={Boolean(columnComponent.meta.enableCollapse)}
          onChange={handleChangeCollapseEnabled}
        >
          {t('Allow collapse')}
        </Checkbox>
      </MenuCheckboxLabel>,
      <MenuCheckboxLabel key={`${columnComponent.id}-collapsed-default`}>
        <Checkbox
          name={`${columnComponent.id}-collapsed-default`}
          checked={Boolean(columnComponent.meta.collapsedByDefault)}
          disabled={!columnComponent.meta.enableCollapse}
          onChange={handleChangeCollapsedByDefault}
        >
          {t('Collapsed by default')}
        </Checkbox>
      </MenuCheckboxLabel>,
    ],
    [
      columnComponent.id,
      columnComponent.meta.background,
      columnComponent.meta.collapsedByDefault,
      columnComponent.meta.enableCollapse,
      handleChangeBackground,
      handleChangeCollapseEnabled,
      handleChangeCollapsedByDefault,
    ],
  );

  const renderColumnContent = () => {
    if (isCollapsed) {
      return null;
    }

    return (
      <>
        {editMode && (
          <Droppable
            component={columnComponent}
            parentComponent={columnComponent}
            {...(columnItems.length === 0
              ? {
                  dropToChild: true,
                }
              : {
                  component: columnItems[0],
                })}
            depth={depth}
            index={0}
            orientation="column"
            onDrop={handleComponentDrop}
            className={cx(
              'empty-droptarget',
              columnItems.length > 0 && 'droptarget-edge',
            )}
            editMode
          >
            {({ dropIndicatorProps }) =>
              dropIndicatorProps && <div {...dropIndicatorProps} />
            }
          </Droppable>
        )}
        {columnItems.length === 0 ? (
          <div css={emptyColumnContentStyles}>{t('Empty column')}</div>
        ) : (
          columnItems.map((componentId, itemIndex) => (
            <Fragment key={componentId}>
              <DashboardComponent
                id={componentId}
                parentId={columnComponent.id}
                depth={depth + 1}
                index={itemIndex}
                availableColumnCount={displayedWidth}
                columnWidth={columnWidth}
                onResizeStart={onResizeStart}
                onResize={onResize}
                onResizeStop={onResizeStop}
                isComponentVisible={isComponentVisible}
                onChangeTab={onChangeTab}
                parentEffectiveWidth={displayedWidth}
              />
              {editMode && (
                <Droppable
                  component={columnItems}
                  parentComponent={columnComponent}
                  depth={depth}
                  index={itemIndex + 1}
                  orientation="column"
                  onDrop={handleComponentDrop}
                  className={cx(
                    'empty-droptarget',
                    itemIndex === columnItems.length - 1 && 'droptarget-edge',
                  )}
                  editMode
                >
                  {({ dropIndicatorProps }) =>
                    dropIndicatorProps && <div {...dropIndicatorProps} />
                  }
                </Droppable>
              )}
            </Fragment>
          ))
        )}
      </>
    );
  };

  const renderChild = useCallback(
    ({ dragSourceRef }) => (
      <ResizableContainer
        id={columnComponent.id}
        adjustableWidth
        adjustableHeight={false}
        widthStep={columnWidth}
        widthMultiple={displayedWidth}
        minWidthMultiple={minColumnWidth}
        maxWidthMultiple={availableColumnCount + (displayedWidth || 0)}
        onResizeStart={onResizeStart}
        onResize={onResize}
        onResizeStop={onResizeStop}
        editMode={editMode}
      >
        <WithPopoverMenu
          isFocused={isFocused}
          onChangeFocus={handleChangeFocus}
          disableClick
          menuItems={menuItems}
          editMode={editMode}
        >
          {editMode && (
            <HoverMenu innerRef={dragSourceRef} position="top">
              <DragHandle position="top" />
              <DeleteComponentButton
                iconSize="m"
                onDelete={handleDeleteComponent}
              />
              <IconButton
                onClick={handleChangeFocus}
                icon={<Icons.SettingOutlined iconSize="m" />}
              />
            </HoverMenu>
          )}
          <ColumnStyles
            className={cx('grid-column', backgroundStyle.className)}
            editMode={editMode}
            isCollapsed={isCollapsed}
          >
            {canCollapse && !editMode && (
              <CollapseToggleButton
                type="button"
                aria-label={isCollapsed ? t('Expand column') : t('Collapse column')}
                collapsed={isCollapsed}
                onClick={handleToggleCollapsed}
              >
                {isCollapsed ? (
                  <Icons.VerticalRightOutlined iconSize="m" />
                ) : (
                  <Icons.VerticalLeftOutlined iconSize="m" />
                )}
              </CollapseToggleButton>
            )}
            {renderColumnContent()}
          </ColumnStyles>
        </WithPopoverMenu>
      </ResizableContainer>
    ),
    [
      availableColumnCount,
      backgroundStyle.className,
      canCollapse,
      columnComponent.id,
      columnWidth,
      displayedWidth,
      editMode,
      handleChangeFocus,
      handleDeleteComponent,
      handleToggleCollapsed,
      isCollapsed,
      isFocused,
      menuItems,
      minColumnWidth,
      onResize,
      onResizeStart,
      onResizeStop,
      renderColumnContent,
    ],
  );

  return (
    <Draggable
      component={columnComponent}
      parentComponent={parentComponent}
      orientation="column"
      index={index}
      depth={depth}
      onDrop={handleComponentDrop}
      editMode={editMode}
    >
      {renderChild}
    </Draggable>
  );
};

Column.propTypes = propTypes;
Column.defaultProps = defaultProps;

export default memo(Column);
