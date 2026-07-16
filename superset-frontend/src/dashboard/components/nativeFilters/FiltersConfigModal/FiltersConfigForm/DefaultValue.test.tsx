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
import { render, screen } from 'spec/helpers/testing-library';
import DefaultValue from './DefaultValue';
import { TIME_FILTER_INPUT_WIDTH } from './constants';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: ({ width }: { width: number }) => (
    <div data-test="default-value-chart" data-width={width} />
  ),
}));

test('uses the time-filter width for filter_time_v2', () => {
  const form = {
    getFieldValue: jest.fn(() => ({
      filterId: {
        filterType: 'filter_time_v2',
        defaultValueQueriesData: [],
        defaultDataMask: { filterState: { value: 'Last month' } },
      },
    })),
  };

  render(
    <DefaultValue
      hasDefaultValue
      filterId="filterId"
      hasDataset={false}
      form={form as any}
      setDataMask={jest.fn()}
      formData={{} as any}
      enableNoResults
    />,
  );

  expect(screen.getByTestId('default-value-chart')).toHaveAttribute(
    'data-width',
    String(TIME_FILTER_INPUT_WIDTH),
  );
});
