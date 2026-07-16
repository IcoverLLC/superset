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
import { normalizeBigInts } from './normalizeBigInts';

test('recursively normalizes bigint drill values for JSON serialization', () => {
  const date = new Date('2026-07-16T00:00:00Z');
  const normalized = normalizeBigInts({
    drillToDetail: [
      {
        val: BigInt('9223372036854775807'),
        nested: { values: [BigInt(1), 'unchanged'] },
      },
    ],
    drillBy: { filters: [{ val: BigInt('9007199254740993') }] },
    date,
  });

  expect(normalized).toEqual({
    drillToDetail: [
      {
        val: '9223372036854775807',
        nested: { values: ['1', 'unchanged'] },
      },
    ],
    drillBy: { filters: [{ val: '9007199254740993' }] },
    date,
  });
  expect(() => JSON.stringify(normalized)).not.toThrow();
});
