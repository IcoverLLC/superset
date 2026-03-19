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

export default function parseNumericFilterValue(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const hasPercentSuffix = trimmedValue.endsWith(PERCENT_SUFFIX);
  const normalizedValue = hasPercentSuffix
    ? trimmedValue.slice(0, -1).trim()
    : trimmedValue;

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue.replace(',', '.'));

  if (!Number.isFinite(parsedValue)) {
    return null;
  }

  return hasPercentSuffix ? parsedValue / 100 : parsedValue;
}
