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
import { QueryMode, SMART_DATE_ID, TimeGranularity } from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import testData from '../../plugin-chart-table/test/testData';
import transformProps from './transformProps';

test('merges dashboard extra form data into transformed form data', () => {
  const transformedProps = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      include_search: false,
      extra_form_data: {
        include_search: true,
      } as never,
    },
  });

  expect(transformedProps.includeSearch).toBe(true);
  expect(transformedProps.formData.include_search).toBe(true);
});

test('does not apply time grain formatting to raw temporal values', () => {
  const transformedProps = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      query_mode: QueryMode.Raw,
      time_grain_sqla: TimeGranularity.MONTH,
      table_timestamp_format: SMART_DATE_ID,
    },
    queriesData: [
      {
        ...testData.basic.queriesData[0],
        colnames: ['__timestamp'],
        coltypes: [GenericDataType.Temporal],
        data: [{ __timestamp: '2020-01-15T12:34:56' }],
      },
    ],
  });

  expect(transformedProps.isRawRecords).toBe(true);
  expect(transformedProps.columns[0].formatter).toBe(String);
});
