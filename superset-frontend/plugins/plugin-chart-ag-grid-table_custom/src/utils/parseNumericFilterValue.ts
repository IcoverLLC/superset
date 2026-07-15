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

export const NUMERIC_FILTER_ALLOWED_CHAR_PATTERN = '\\d\\-\\+\\.,%\\s';

const PERCENT_SUFFIX = '%';
const NON_NUMERIC_FILTER_CHARS = /[^\d+\-.,%\s]/g;

function normalizeNumericString(value: string): {
  hasPercentSuffix: boolean;
  normalizedValue: string | null;
} {
  const sanitizedValue = value.replace(NON_NUMERIC_FILTER_CHARS, '').trim();

  if (!sanitizedValue) {
    return {
      hasPercentSuffix: false,
      normalizedValue: null,
    };
  }

  const hasPercentSuffix = sanitizedValue.endsWith(PERCENT_SUFFIX);
  const compactValue = (
    hasPercentSuffix ? sanitizedValue.slice(0, -1).trim() : sanitizedValue
  ).replace(/\s+/g, '');

  if (!compactValue) {
    return {
      hasPercentSuffix,
      normalizedValue: null,
    };
  }

  const hasDot = compactValue.includes('.');
  const hasComma = compactValue.includes(',');

  if (hasDot && hasComma) {
    const lastDotIndex = compactValue.lastIndexOf('.');
    const lastCommaIndex = compactValue.lastIndexOf(',');
    const decimalSeparator = lastDotIndex > lastCommaIndex ? '.' : ',';
    const thousandsSeparator = decimalSeparator === '.' ? ',' : '.';

    return {
      hasPercentSuffix,
      normalizedValue: compactValue
        .split(thousandsSeparator)
        .join('')
        .replace(decimalSeparator, '.'),
    };
  }

  if (hasComma) {
    const parts = compactValue.split(',');

    if (parts.length === 2 && parts[1].length === 3 && !hasPercentSuffix) {
      return {
        hasPercentSuffix,
        normalizedValue: parts.join(''),
      };
    }

    return {
      hasPercentSuffix,
      normalizedValue: `${parts.slice(0, -1).join('')}.${parts.at(-1)}`,
    };
  }

  return {
    hasPercentSuffix,
    normalizedValue: compactValue,
  };
}

export default function parseNumericFilterValue(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const { hasPercentSuffix, normalizedValue } = normalizeNumericString(value);

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return hasPercentSuffix ? parsedValue / 100 : parsedValue;
}
