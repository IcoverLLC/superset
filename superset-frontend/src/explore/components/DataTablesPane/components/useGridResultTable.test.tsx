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
import { renderHook } from '@testing-library/react-hooks';
import { useGridColumns } from './useGridResultTable';

test('useGridColumns preserves coltype indexes when inherit columns are hidden', () => {
  const timestamp = 1640995200000;
  const hook = renderHook(() =>
    useGridColumns(
      ['value__inherit', 'timestamp'],
      [GenericDataType.String, GenericDataType.Temporal],
      [{ value__inherit: 'ignored', timestamp }],
    ),
  );

  const [column] = hook.result.current;
  expect(column.label).toBe('timestamp');
  expect(column.render({ value: timestamp })).toBe('2022-01-01 00:00:00');
});
