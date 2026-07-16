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
import hasPendingDefaultToFirstItemParent from './hasPendingDefaultToFirstItemParent';

const parentId = 'NATIVE_FILTER-PARENT';
const defaultFirstById = { [parentId]: true };

test('blocks while a default-to-first parent has not selected its value', () => {
  expect(
    hasPendingDefaultToFirstItemParent(
      [parentId],
      { [parentId]: { filterState: {}, extraFormData: {} } },
      defaultFirstById,
    ),
  ).toBe(true);
});

test('unblocks after the parent selects its first value', () => {
  expect(
    hasPendingDefaultToFirstItemParent(
      [parentId],
      {
        [parentId]: {
          filterState: { value: ['Toyota'] },
          extraFormData: {},
        },
      },
      defaultFirstById,
    ),
  ).toBe(false);
});

test('does not block a parent without default-to-first enabled', () => {
  expect(
    hasPendingDefaultToFirstItemParent(
      [parentId],
      { [parentId]: { filterState: {}, extraFormData: {} } },
      { [parentId]: false },
    ),
  ).toBe(false);
});
