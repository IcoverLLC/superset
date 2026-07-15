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
import { createRef, type ComponentProps } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import BaseTimeFilterPlugin from './BaseTimeFilterPlugin';

jest.mock('@superset-ui/core', () => {
  const actual = jest.requireActual('@superset-ui/core');
  return {
    ...actual,
    getExtensionsRegistry: () => ({
      get: () => undefined,
    }),
  };
});

jest.mock('src/explore/components/controls/DateFilterControl', () => {
  const React = jest.requireActual('react');

  const MockDateFilterControl = ({ value }: { value?: string }) =>
    React.createElement('div', { 'data-test': 'mock-date-filter' }, value);

  return {
    __esModule: true,
    default: MockDateFilterControl,
    DateFilterControlV2: MockDateFilterControl,
  };
});

const noop = () => undefined;

type BaseTimeFilterPluginProps = ComponentProps<typeof BaseTimeFilterPlugin>;

const getProps = (
  overrides: Partial<BaseTimeFilterPluginProps> = {},
): BaseTimeFilterPluginProps =>
  ({
    behaviors: [] as BaseTimeFilterPluginProps['behaviors'],
    data: [] as BaseTimeFilterPluginProps['data'],
    filterState: { value: 'Last week' },
    formData: {
      calendarFormat: 'standard' as const,
      inView: true,
      nativeFilterId: 'time-filter',
    } as BaseTimeFilterPluginProps['formData'],
    height: 32,
    inputRef: createRef<HTMLInputElement>(),
    setDataMask: jest.fn(),
    setFilterActive: noop,
    setFocusedFilter: noop,
    setHoveredFilter: noop,
    unsetFocusedFilter: noop,
    unsetHoveredFilter: noop,
    width: 320,
    ...overrides,
  }) as BaseTimeFilterPluginProps;

describe('BaseTimeFilterPlugin', () => {
  test('does not re-emit the same value when rerendered with a new setDataMask callback', () => {
    const initialSetDataMask = jest.fn();
    const props = getProps({ setDataMask: initialSetDataMask });
    const { rerender } = render(<BaseTimeFilterPlugin {...props} />);

    expect(initialSetDataMask).not.toHaveBeenCalled();
    expect(screen.getByTestId('mock-date-filter')).toHaveTextContent(
      'Last week',
    );

    const nextSetDataMask = jest.fn();
    rerender(
      <BaseTimeFilterPlugin {...getProps({ setDataMask: nextSetDataMask })} />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });

  test('normalizes an incompatible monthly value only once across rerenders', () => {
    const initialSetDataMask = jest.fn();
    const monthlyProps: Partial<BaseTimeFilterPluginProps> = {
      filterState: { value: 'Last week' },
      formData: {
        calendarFormat: 'monthly' as const,
        inView: true,
        nativeFilterId: 'time-filter',
      },
      setDataMask: initialSetDataMask,
    };

    const { rerender } = render(
      <BaseTimeFilterPlugin {...getProps(monthlyProps)} />,
    );

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);
    expect(initialSetDataMask).toHaveBeenCalledWith({
      extraFormData: {
        time_range: 'previous calendar month',
      },
      filterState: {
        value: 'previous calendar month',
      },
    });
    expect(screen.getByTestId('mock-date-filter')).toHaveTextContent(
      'previous calendar month',
    );

    const nextSetDataMask = jest.fn();
    rerender(
      <BaseTimeFilterPlugin
        {...getProps({
          ...monthlyProps,
          setDataMask: nextSetDataMask,
        })}
      />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });
});
