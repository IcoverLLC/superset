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
import { NO_TIME_RANGE } from '@superset-ui/core';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
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

  const MockDateFilterControl = ({
    value,
    onChange,
  }: {
    value?: string;
    onChange: (value?: string) => void;
  }) =>
    React.createElement(
      'div',
      null,
      React.createElement('span', { 'data-test': 'mock-date-filter' }, value),
      React.createElement(
        'button',
        {
          'data-test': 'clear-time-filter',
          type: 'button',
          onClick: () => onChange(undefined),
        },
        'clear',
      ),
    );

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
  test('emits a restored value once without repeating for a new callback', () => {
    const initialSetDataMask = jest.fn();
    const props = getProps({ setDataMask: initialSetDataMask });
    const { rerender } = render(<BaseTimeFilterPlugin {...props} />);

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);
    expect(initialSetDataMask).toHaveBeenCalledWith({
      extraFormData: { time_range: 'Last week' },
      filterState: { value: 'Last week' },
    });
    expect(screen.getByTestId('mock-date-filter')).toHaveTextContent(
      'Last week',
    );

    const nextSetDataMask = jest.fn();
    rerender(
      <BaseTimeFilterPlugin {...getProps({ setDataMask: nextSetDataMask })} />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });

  test('emits a configured default once when the store has no value', () => {
    const setDataMask = jest.fn();

    render(
      <BaseTimeFilterPlugin
        {...getProps({
          filterState: {},
          formData: {
            calendarFormat: 'standard',
            defaultValue: 'Last month',
            inView: true,
            nativeFilterId: 'time-filter',
          },
          setDataMask,
        })}
      />,
    );

    expect(setDataMask).toHaveBeenCalledTimes(1);
    expect(setDataMask).toHaveBeenCalledWith({
      extraFormData: { time_range: 'Last month' },
      filterState: { value: 'Last month' },
    });
  });

  test('preserves an explicit clear instead of restoring the configured default', async () => {
    const setDataMask = jest.fn();
    const formData = {
      calendarFormat: 'standard' as const,
      defaultValue: 'Last month',
      inView: true,
      nativeFilterId: 'time-filter',
    };
    const { rerender, unmount } = render(
      <BaseTimeFilterPlugin
        {...getProps({ filterState: {}, formData, setDataMask })}
      />,
    );

    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: { time_range: 'Last month' },
      filterState: { value: 'Last month' },
    });

    // Acknowledge the initialized default in the store before clearing it.
    rerender(
      <BaseTimeFilterPlugin
        {...getProps({
          filterState: { value: 'Last month' },
          formData,
          setDataMask,
        })}
      />,
    );
    await userEvent.click(screen.getByTestId('clear-time-filter'));

    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: {},
      filterState: { value: null },
    });

    // Store acknowledgement must keep both the rendered control and emitted
    // query state cleared, rather than falling back to the configured default.
    rerender(
      <BaseTimeFilterPlugin
        {...getProps({
          filterState: { value: null },
          formData,
          setDataMask,
        })}
      />,
    );
    expect(screen.getByTestId('mock-date-filter')).toHaveTextContent(
      NO_TIME_RANGE,
    );
    expect(setDataMask).toHaveBeenCalledTimes(2);

    unmount();
    const remountSetDataMask = jest.fn();
    render(
      <BaseTimeFilterPlugin
        {...getProps({
          filterState: { value: null },
          formData,
          setDataMask: remountSetDataMask,
        })}
      />,
    );

    expect(screen.getByTestId('mock-date-filter')).toHaveTextContent(
      NO_TIME_RANGE,
    );
    expect(remountSetDataMask).toHaveBeenCalledTimes(1);
    expect(remountSetDataMask).toHaveBeenCalledWith({
      extraFormData: {},
      filterState: { value: null },
    });
  });

  test('emits a restored store value after mount', () => {
    const setDataMask = jest.fn();
    const { rerender } = render(
      <BaseTimeFilterPlugin {...getProps({ setDataMask })} />,
    );

    rerender(
      <BaseTimeFilterPlugin
        {...getProps({
          filterState: { value: 'Last month' },
          setDataMask,
        })}
      />,
    );

    expect(setDataMask).toHaveBeenCalledTimes(2);
    expect(setDataMask).toHaveBeenLastCalledWith({
      extraFormData: { time_range: 'Last month' },
      filterState: { value: 'Last month' },
    });
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

    const normalizedProps = getProps({
      ...monthlyProps,
      filterState: { value: 'previous calendar month' },
    });
    rerender(<BaseTimeFilterPlugin {...normalizedProps} />);

    expect(initialSetDataMask).toHaveBeenCalledTimes(1);

    const nextSetDataMask = jest.fn();
    rerender(
      <BaseTimeFilterPlugin
        {...normalizedProps}
        setDataMask={nextSetDataMask}
      />,
    );

    expect(nextSetDataMask).not.toHaveBeenCalled();
  });
});
