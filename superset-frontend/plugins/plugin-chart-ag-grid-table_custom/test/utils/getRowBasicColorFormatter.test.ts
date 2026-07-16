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
import { BASIC_COLOR_FORMATTERS_ROW_KEY } from '../../src/consts';
import getRowBasicColorFormatter, {
  RowFormatters,
} from '../../src/utils/getRowBasicColorFormatter';

const green: RowFormatters = {
  sales: { backgroundColor: 'green', mainArrow: '↑', arrowColor: 'green' },
};
const red: RowFormatters = {
  sales: { backgroundColor: 'red', mainArrow: '↓', arrowColor: 'red' },
};
const positional = [green, red];

test('uses the formatter attached to the row after display-order sorting', () => {
  const data: Record<string | symbol, unknown> = { sales: 5 };
  data[BASIC_COLOR_FORMATTERS_ROW_KEY] = red;

  expect(getRowBasicColorFormatter({ data }, 0, positional)).toBe(red);
});

test('falls back to query-order position for rows without attached metadata', () => {
  expect(getRowBasicColorFormatter({ data: { sales: 5 } }, 1, positional)).toBe(
    red,
  );
});

test('symbol metadata cannot collide with or serialize as a dataset column', () => {
  const data: Record<string | symbol, unknown> = {
    sales: 5,
    __basicColorFormatters__: 'dataset value',
  };
  data[BASIC_COLOR_FORMATTERS_ROW_KEY] = green;

  expect(data.__basicColorFormatters__).toBe('dataset value');
  expect(JSON.stringify(data)).toBe(
    '{"sales":5,"__basicColorFormatters__":"dataset value"}',
  );
});
