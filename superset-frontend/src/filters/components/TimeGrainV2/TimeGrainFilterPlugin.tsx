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
  ensureIsArray,
  ExtraFormData,
  t,
  TimeGranularity,
  tn,
} from '@superset-ui/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FormItem,
  type FormItemProps,
  Select,
} from '@superset-ui/core/components';
import { FilterPluginStyle, StatusMessage } from '../common';
import { PluginFilterTimeGrainProps } from './types';

export default function PluginFilterTimegrainV2(
  props: PluginFilterTimeGrainProps,
) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const { availableTimeGrains, defaultValue } = formData;

  const filterAvailableTimeGrains = useCallback(
    (values: string[] | string | undefined | null) =>
      ensureIsArray<string>(values).filter(
        timeGrain =>
          !availableTimeGrains?.length || availableTimeGrains.includes(timeGrain),
      ),
    [availableTimeGrains],
  );
  const initialValue =
    filterState.value === undefined ? defaultValue ?? [] : filterState.value;
  const [value, setValue] = useState<string[]>(() =>
    filterAvailableTimeGrains(initialValue),
  );
  const lastAutoSyncRef = useRef<string | null>(null);
  const pendingUserValueRef = useRef<string | null>(null);
  const filteredData = useMemo(() => {
    if (!availableTimeGrains?.length) {
      return data;
    }
    const allowedTimeGrains = new Set(availableTimeGrains);
    return data.filter(
      ({ duration }: { duration: string }) => allowedTimeGrains.has(duration),
    );
  }, [availableTimeGrains, data]);
  const durationMap = useMemo(
    () =>
      filteredData.reduce(
        (agg, { duration, name }: { duration: string; name: string }) => {
          agg[duration] = name;
          return agg;
        },
        {} as { [key in string]: string },
      ),
    [filteredData],
  );

  const applyValue = useCallback((resultValue: string[]) => {
    const [timeGrain] = resultValue;
    const label = timeGrain ? durationMap[timeGrain] : undefined;

    const extraFormData: ExtraFormData = {};
    if (timeGrain) {
      extraFormData.time_grain_sqla = timeGrain as TimeGranularity;
    }
    setValue(resultValue);
    setDataMask({
      extraFormData,
      filterState: {
        label,
        value: resultValue.length ? resultValue : null,
      },
    });
  }, [durationMap, setDataMask]);

  const handleChange = (values: string[] | string | undefined | null) => {
    const resultValue = filterAvailableTimeGrains(values);
    pendingUserValueRef.current = JSON.stringify(resultValue);
    lastAutoSyncRef.current = null;
    applyValue(resultValue);
  };

  const sourceValue =
    filterState.value === undefined ? defaultValue ?? [] : filterState.value;
  const rawFilterStateValue = useMemo(
    () => ensureIsArray<string>(filterState.value ?? []),
    [filterState.value],
  );
  const nextSyncedValue = useMemo(
    () => filterAvailableTimeGrains(sourceValue),
    [filterAvailableTimeGrains, sourceValue],
  );
  const rawFilterStateValueKey = useMemo(
    () => JSON.stringify(rawFilterStateValue),
    [rawFilterStateValue],
  );
  const nextSyncedValueKey = useMemo(
    () => JSON.stringify(nextSyncedValue),
    [nextSyncedValue],
  );
  const selectedValueKey = JSON.stringify(value);

  useEffect(() => {
    if (pendingUserValueRef.current === nextSyncedValueKey) {
      pendingUserValueRef.current = null;
    }

    if (rawFilterStateValueKey !== nextSyncedValueKey) {
      const autoSyncKey = `${rawFilterStateValueKey}::${nextSyncedValueKey}`;
      if (lastAutoSyncRef.current === autoSyncKey) {
        return;
      }

      lastAutoSyncRef.current = autoSyncKey;
      applyValue(nextSyncedValue);
      return;
    }

    lastAutoSyncRef.current = null;

    if (
      pendingUserValueRef.current &&
      pendingUserValueRef.current !== nextSyncedValueKey
    ) {
      return;
    }

    if (selectedValueKey !== nextSyncedValueKey) {
      setValue(nextSyncedValue);
    }
  }, [
    applyValue,
    nextSyncedValue,
    nextSyncedValueKey,
    rawFilterStateValueKey,
    selectedValueKey,
  ]);

  const placeholderText =
    (filteredData || []).length === 0
      ? t('No data')
      : tn('%s option', '%s options', filteredData.length, filteredData.length);

  const formItemData: FormItemProps = {};
  if (filterState.validateMessage) {
    formItemData.extra = (
      <StatusMessage status={filterState.validateStatus}>
        {filterState.validateMessage}
      </StatusMessage>
    );
  }

  const options = (filteredData || []).map(
    (row: { name: string; duration: string }) => {
      const { name, duration } = row;
      return {
        label: name,
        value: duration,
      };
    },
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem validateStatus={filterState.validateStatus} {...formItemData}>
        <Select
          name={formData.nativeFilterId}
          allowClear
          value={value}
          placeholder={placeholderText}
          // @ts-ignore
          onChange={handleChange}
          onBlur={unsetFocusedFilter}
          onFocus={setFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
          ref={inputRef}
          options={options}
          onOpenChange={setFilterActive}
          sortComparator={() => 0}
        />
      </FormItem>
    </FilterPluginStyle>
  );
}
