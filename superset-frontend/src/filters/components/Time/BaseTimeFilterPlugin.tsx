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
import { NO_TIME_RANGE, getExtensionsRegistry } from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect, useRef } from 'react';
import DateFilterControl, {
  DateFilterControlVariant,
  DateFilterControlV2,
} from 'src/explore/components/controls/DateFilterControl';
import { normalizeTimeRangeForCalendarFormat } from 'src/explore/components/controls/DateFilterControl/utils';
import { PluginFilterTimeProps } from './types';
import { FilterPluginStyle } from '../common';

const TimeFilterStyles = styled(FilterPluginStyle)`
  display: flex;
  align-items: center;
  overflow-x: visible;

  & .ant-tag {
    margin-right: 0;
  }
`;

const ControlContainer = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  display: flex;
  height: 100%;
  max-width: 100%;
  width: 100%;
  & > div,
  & > div:hover {
    ${({ validateStatus, theme }) => {
      if (!validateStatus) return '';
      switch (validateStatus) {
        case 'error':
          return `border-color: ${theme.colorError}`;
        case 'warning':
          return `border-color: ${theme.colorWarning}`;
        case 'info':
          return `border-color: ${theme.colorInfo}`;
        default:
          return `border-color: ${theme.colorError}`;
      }
    }}
  }
  & > div {
    width: 100%;
  }

  &:focus > div {
    border-color: ${({ theme }) => theme.colorPrimary};
    box-shadow: ${({ theme }) => `0 0 0 2px ${theme.controlOutline}`};
    outline: 0;
  }
`;

type BaseTimeFilterPluginProps = PluginFilterTimeProps & {
  variant?: DateFilterControlVariant;
  extensionKey?: string;
};

export default function BaseTimeFilterPlugin(props: BaseTimeFilterPluginProps) {
  const {
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    width,
    height,
    filterState,
    inputRef,
    isOverflowingFilterBar = false,
    variant = 'default',
    extensionKey = 'filter.dateFilterControl',
  } = props;
  const extensionsRegistry = getExtensionsRegistry();
  const calendarFormat = props.formData?.calendarFormat ?? 'standard';
  const storedValue = filterState.value as string | null | undefined;
  const currentValue =
    storedValue === undefined
      ? (props.formData?.defaultValue ?? NO_TIME_RANGE)
      : (storedValue ?? NO_TIME_RANGE);
  const normalizedValue = normalizeTimeRangeForCalendarFormat(
    currentValue,
    calendarFormat,
  );
  const lastNormalizedSyncRef = useRef<string | null>(null);
  const pendingUserValueRef = useRef<{
    calendarFormat: typeof calendarFormat;
    previousValue: string;
    value: string;
  } | null>(null);
  const pendingNormalizedValueRef = useRef<{
    calendarFormat: typeof calendarFormat;
    previousValue: string;
    value: string;
  } | null>(null);

  const FallbackComponent =
    variant === 'v2' ? DateFilterControlV2 : DateFilterControl;
  const DateFilterControlExtension = (
    extensionsRegistry as typeof extensionsRegistry & {
      get: (key: string) => unknown;
    }
  ).get(extensionKey) as typeof FallbackComponent | undefined;
  const DateFilterComponent = DateFilterControlExtension ?? FallbackComponent;

  const emitTimeRange = useCallback(
    (timeRange?: string): void => {
      const isSet = timeRange && timeRange !== NO_TIME_RANGE;
      setDataMask({
        extraFormData: isSet
          ? {
              time_range: timeRange,
            }
          : {},
        filterState: {
          // `undefined` means the store has not been initialized and allows a
          // configured default to be restored. Use `null` for an explicit
          // clear so the default is not immediately applied again.
          value: isSet ? timeRange : null,
        },
      });
    },
    [setDataMask],
  );

  const handleTimeRangeChange = useCallback(
    (timeRange?: string): void => {
      const normalizedTimeRange = normalizeTimeRangeForCalendarFormat(
        timeRange || NO_TIME_RANGE,
        calendarFormat,
      );
      pendingUserValueRef.current = {
        calendarFormat,
        previousValue: currentValue,
        value: normalizedTimeRange,
      };
      emitTimeRange(normalizedTimeRange);
    },
    [calendarFormat, currentValue, emitTimeRange],
  );

  useEffect(() => {
    const syncKey = `${calendarFormat}::${currentValue}::${normalizedValue}`;
    const pendingUserValue = pendingUserValueRef.current;
    const pendingNormalizedValue = pendingNormalizedValueRef.current;

    if (pendingUserValue?.calendarFormat !== calendarFormat) {
      pendingUserValueRef.current = null;
    } else if (pendingUserValue) {
      if (normalizedValue === pendingUserValue.value) {
        pendingUserValueRef.current = null;
        lastNormalizedSyncRef.current = syncKey;
        return;
      }

      if (currentValue === pendingUserValue.previousValue) {
        return;
      }

      pendingUserValueRef.current = null;
    }

    if (pendingNormalizedValue?.calendarFormat !== calendarFormat) {
      pendingNormalizedValueRef.current = null;
    } else if (pendingNormalizedValue) {
      if (
        currentValue === pendingNormalizedValue.value &&
        normalizedValue === pendingNormalizedValue.value
      ) {
        pendingNormalizedValueRef.current = null;
        lastNormalizedSyncRef.current = syncKey;
        return;
      }

      if (
        currentValue !== pendingNormalizedValue.previousValue ||
        normalizedValue !== pendingNormalizedValue.value
      ) {
        pendingNormalizedValueRef.current = null;
      }
    }

    if (lastNormalizedSyncRef.current === syncKey) {
      return;
    }

    lastNormalizedSyncRef.current = syncKey;
    if (currentValue !== normalizedValue) {
      pendingNormalizedValueRef.current = {
        calendarFormat,
        previousValue: currentValue,
        value: normalizedValue,
      };
    }
    emitTimeRange(normalizedValue);
  }, [calendarFormat, currentValue, emitTimeRange, normalizedValue]);

  return props.formData?.inView ? (
    <TimeFilterStyles width={width} height={height}>
      <ControlContainer
        ref={inputRef}
        validateStatus={filterState.validateStatus}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        tabIndex={-1}
      >
        <DateFilterComponent
          value={normalizedValue}
          name={props.formData.nativeFilterId || 'time_range'}
          onChange={handleTimeRangeChange}
          onOpenPopover={() => setFilterActive(true)}
          onClosePopover={() => {
            setFilterActive(false);
            unsetHoveredFilter();
            unsetFocusedFilter();
          }}
          isOverflowingFilterBar={isOverflowingFilterBar}
          calendarFormat={calendarFormat}
        />
      </ControlContainer>
    </TimeFilterStyles>
  ) : null;
}
