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

import parseNumericFilterValue, {
  NUMERIC_FILTER_ALLOWED_CHAR_PATTERN,
} from './parseNumericFilterValue';

describe('parseNumericFilterValue', () => {
  it('parses plain numeric values as-is', () => {
    expect(parseNumericFilterValue('10')).toBe(10);
    expect(parseNumericFilterValue('-5.25')).toBe(-5.25);
    expect(parseNumericFilterValue(3.5)).toBe(3.5);
  });

  it('converts percentage suffixes into fractional values', () => {
    expect(parseNumericFilterValue('10%')).toBe(0.1);
    expect(parseNumericFilterValue(' 12.5% ')).toBe(0.125);
    expect(parseNumericFilterValue('-50%')).toBe(-0.5);
  });

  it('supports comma decimal separators for percent values', () => {
    expect(parseNumericFilterValue('12,5%')).toBe(0.125);
  });

  it('parses formatted numeric strings with grouping and currency symbols', () => {
    expect(parseNumericFilterValue('$1,234.5')).toBe(1234.5);
    expect(parseNumericFilterValue('€ 1 234,5')).toBe(1234.5);
  });

  it('returns null for empty or invalid inputs', () => {
    expect(parseNumericFilterValue('')).toBeNull();
    expect(parseNumericFilterValue('   ')).toBeNull();
    expect(parseNumericFilterValue('%')).toBeNull();
    expect(parseNumericFilterValue('abc')).toBeNull();
    expect(parseNumericFilterValue(Number.NaN)).toBeNull();
    expect(parseNumericFilterValue(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('allows percent signs in numeric filter inputs', () => {
    expect(NUMERIC_FILTER_ALLOWED_CHAR_PATTERN).toContain('%');
  });
});
