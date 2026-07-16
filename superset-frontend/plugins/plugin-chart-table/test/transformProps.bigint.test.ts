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
import { GenericDataType } from '@apache-superset/core/common';
import transformProps from '../src/transformProps';
import testData from './testData';

const mainValue = BigInt('9223372036854775807');
const comparisonValue = BigInt('9223372036854775800');

test('preserves bigint comparison values and calculates exact bigint totals', () => {
  const transformedProps = transformProps({
    ...testData.comparison,
    rawFormData: {
      ...testData.comparison.rawFormData,
      metrics: ['metric_1'],
      percent_metrics: [],
    },
    queriesData: [
      {
        ...testData.comparison.queriesData[0],
        colnames: ['metric_1', 'metric_1__P1D'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
        data: [
          {
            metric_1: mainValue,
            metric_1__P1D: comparisonValue,
          },
        ],
      },
      {
        ...testData.comparison.queriesData[1],
        data: [
          {
            metric_1: mainValue,
            metric_1__P1D: comparisonValue,
          },
          { metric_1: BigInt(2), metric_1__P1D: BigInt(1) },
        ],
      },
    ],
  });

  expect(transformedProps.data[0]).toEqual(
    expect.objectContaining({
      'Main metric_1': mainValue,
      '# metric_1': comparisonValue,
      '\u25B3 metric_1': BigInt(7),
    }),
  );
  expect(transformedProps.totals).toEqual(
    expect.objectContaining({
      'Main metric_1': mainValue + BigInt(2),
      '# metric_1': comparisonValue + BigInt(1),
      '\u25B3 metric_1': BigInt(8),
    }),
  );
  expect(
    Number.isFinite(transformedProps.data[0]['% metric_1'] as number),
  ).toBe(true);
});

test('preserves exact totals and differences for mixed safe integers and bigint', () => {
  const transformedProps = transformProps({
    ...testData.comparison,
    rawFormData: {
      ...testData.comparison.rawFormData,
      metrics: ['metric_1'],
      percent_metrics: [],
    },
    queriesData: [
      {
        ...testData.comparison.queriesData[0],
        colnames: ['metric_1', 'metric_1__P1D'],
        coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
        data: [{ metric_1: mainValue, metric_1__P1D: 1 }],
      },
      {
        ...testData.comparison.queriesData[1],
        data: [
          { metric_1: mainValue, metric_1__P1D: comparisonValue },
          { metric_1: 2, metric_1__P1D: 1 },
        ],
      },
    ],
  });

  expect(transformedProps.data[0]['\u25B3 metric_1']).toBe(
    mainValue - BigInt(1),
  );
  expect(transformedProps.totals).toEqual(
    expect.objectContaining({
      'Main metric_1': mainValue + BigInt(2),
      '# metric_1': comparisonValue + BigInt(1),
      '\u25B3 metric_1': BigInt(8),
    }),
  );
});
