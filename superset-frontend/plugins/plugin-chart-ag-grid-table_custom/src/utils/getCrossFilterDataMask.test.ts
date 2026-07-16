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
import { getCrossFilterDataMask } from './getCrossFilterDataMask';

test('serializes bigint cross-filter values without losing digits', () => {
  const result = getCrossFilterDataMask({
    key: 'large_id',
    value: BigInt('9223372036854775807'),
    isActiveFilterValue: jest.fn(() => false),
    timestampFormatter: jest.fn(value => String(value)),
  });

  expect(result.dataMask.extraFormData.filters).toEqual([
    {
      col: 'large_id',
      op: 'IN',
      val: ['9223372036854775807'],
    },
  ]);
  expect(() => JSON.stringify(result.dataMask)).not.toThrow();
});
