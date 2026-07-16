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
import dateFilterComparator from './dateFilterComparator';

test('compares the selected local date with the UTC cell date', () => {
  const filterDate = new Date(2003, 9, 8);

  expect(
    dateFilterComparator(filterDate, new Date('2003-10-08T23:59:59Z')),
  ).toBe(0);
  expect(
    dateFilterComparator(filterDate, new Date('2003-10-07T23:59:59Z')),
  ).toBe(-1);
  expect(
    dateFilterComparator(filterDate, new Date('2003-10-09T00:00:00Z')),
  ).toBe(1);
});

test('treats empty and invalid cell dates as earlier values', () => {
  const filterDate = new Date(2003, 9, 8);

  expect(dateFilterComparator(filterDate, null)).toBe(-1);
  expect(dateFilterComparator(filterDate, undefined)).toBe(-1);
  expect(dateFilterComparator(filterDate, new Date('invalid-date'))).toBe(-1);
});
