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
import { AppSection } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import TimeGrainFilterPlugin from './TimeGrainFilterPlugin';
import transformProps from './transformProps';

const chartProps = {
  formData: {
    defaultValue: ['P1D'],
    nativeFilterId: 'time-grain-v2-filter',
  },
  height: 20,
  width: 220,
  hooks: {},
  ownState: {},
  filterState: { value: ['P1D'] },
  queriesData: [
    {
      data: [
        { duration: 'PT5M', name: '5 minutes' },
        { duration: 'P1D', name: 'day' },
        { duration: 'P1Y', name: 'year' },
      ],
    },
  ],
  behaviors: ['NATIVE_FILTER'],
  isRefreshing: false,
  appSection: AppSection.Dashboard,
};

describe('TimeGrainV2FilterPlugin', () => {
  const setDataMask = jest.fn();

  const getWrapper = (
    formData: Partial<typeof chartProps.formData> = {},
    filterState: typeof chartProps.filterState = { value: ['P1D'] },
  ) =>
    render(
      // @ts-ignore
      <TimeGrainFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...chartProps,
          formData: { ...chartProps.formData, ...formData },
          filterState,
        })}
        setDataMask={setDataMask}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows only configured time grains', async () => {
    getWrapper({ availableTimeGrains: ['PT5M', 'P1Y'] }, { value: [] });

    await userEvent.click(screen.getByRole('combobox'));

    expect(
      screen.getByRole('option', { name: '5 minutes' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'year' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'day' }),
    ).not.toBeInTheDocument();
  });

  test('clears selected values hidden by configured time grains', () => {
    getWrapper(
      { availableTimeGrains: ['PT5M', 'P1Y'], defaultValue: ['P1D'] },
      { value: ['P1D'] },
    );

    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: {},
      filterState: {
        label: undefined,
        value: null,
      },
    });
  });

  test('does not re-emit the same selected value on rerender with a new setDataMask callback', () => {
    const initialSetDataMask = jest.fn();
    const { rerender } = render(
      // @ts-ignore
      <TimeGrainFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...chartProps,
          formData: { ...chartProps.formData },
          filterState: { value: ['P1D'] },
        })}
        setDataMask={initialSetDataMask}
      />,
    );

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);
    expect(initialSetDataMask).toHaveBeenCalledWith({
      extraFormData: { time_grain_sqla: 'P1D' },
      filterState: { label: 'day', value: ['P1D'] },
    });

    const nextSetDataMask = jest.fn();
    rerender(
      // @ts-ignore
      <TimeGrainFilterPlugin
        // @ts-ignore
        {...transformProps({
          ...chartProps,
          formData: { ...chartProps.formData },
          filterState: { value: ['P1D'] },
        })}
        setDataMask={nextSetDataMask}
      />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });

  test('emits a normalized configured default when the store has no value', () => {
    getWrapper(
      { availableTimeGrains: ['PT5M', 'P1Y'], defaultValue: ['P1D'] },
      { value: undefined } as typeof chartProps.filterState,
    );

    expect(setDataMask).toHaveBeenCalledTimes(1);
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: {},
      filterState: {
        label: undefined,
        value: null,
      },
    });
  });

  test('emits a restored store value after mount', () => {
    const props = {
      ...transformProps({
        ...chartProps,
        formData: { ...chartProps.formData },
        filterState: { value: ['P1D'] },
      }),
    };
    const { rerender } = render(
      // @ts-ignore
      <TimeGrainFilterPlugin {...props} setDataMask={setDataMask} />,
    );

    rerender(
      // @ts-ignore
      <TimeGrainFilterPlugin
        {...props}
        filterState={{ value: ['P1Y'] }}
        setDataMask={setDataMask}
      />,
    );

    expect(setDataMask).toHaveBeenCalledTimes(2);
    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: { time_grain_sqla: 'P1Y' },
      filterState: { label: 'year', value: ['P1Y'] },
    });
  });

  test('clears hidden selected values only once across rerenders', () => {
    const initialSetDataMask = jest.fn();
    const props = {
      ...transformProps({
        ...chartProps,
        formData: {
          ...chartProps.formData,
          availableTimeGrains: ['PT5M', 'P1Y'],
          defaultValue: ['P1D'],
        },
        filterState: { value: ['P1D'] },
      }),
    };

    const { rerender } = render(
      // @ts-ignore
      <TimeGrainFilterPlugin {...props} setDataMask={initialSetDataMask} />,
    );

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);
    expect(initialSetDataMask).toHaveBeenCalledWith({
      extraFormData: {},
      filterState: {
        label: undefined,
        value: null,
      },
    });

    const normalizedProps = {
      ...props,
      filterState: { value: [] },
    };
    rerender(
      // @ts-ignore
      <TimeGrainFilterPlugin
        {...normalizedProps}
        setDataMask={initialSetDataMask}
      />,
    );

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);

    const nextSetDataMask = jest.fn();
    rerender(
      // @ts-ignore
      <TimeGrainFilterPlugin
        {...normalizedProps}
        setDataMask={nextSetDataMask}
      />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });
});
