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

import { ValueGetterParams } from '@superset-ui/core/components/ThemedAgGridReact';
import filterValueGetter from './filterValueGetter';

const buildParams = (
  rawValue: unknown,
  formatter?: (params: { value: unknown }) => string,
) =>
  ({
    data: { metric: rawValue },
    colDef: {
      field: 'metric',
      valueFormatter: formatter,
    },
  }) as ValueGetterParams;

describe('filterValueGetter', () => {
  it('uses the formatted integer value for numeric filtering', () => {
    const params = buildParams(10.3132, () => '10');

    expect(filterValueGetter(params)).toBe(10);
  });

  it('preserves formatted decimal precision for numeric filtering', () => {
    const params = buildParams(10.3132, () => '10.3');

    expect(filterValueGetter(params)).toBe(10.3);
  });

  it('keeps percent-formatted filter values aligned with the display value', () => {
    const params = buildParams(0.103132, () => '10.3%');

    expect(filterValueGetter(params)).toBeCloseTo(0.103);
  });

  it('supports zero values and falls back to the raw number without a formatter', () => {
    expect(filterValueGetter(buildParams(0, () => '0'))).toBe(0);
    expect(filterValueGetter(buildParams(42))).toBe(42);
  });
});
