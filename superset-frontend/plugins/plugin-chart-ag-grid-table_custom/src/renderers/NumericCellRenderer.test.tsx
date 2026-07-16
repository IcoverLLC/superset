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
import { render, screen } from 'spec/helpers/testing-library';
import { GenericDataType } from '@apache-superset/core/common';
import { NumericCellRenderer } from './NumericCellRenderer';

test('renders bigint values without evaluating number-only cell bars', () => {
  const value = BigInt('9223372036854775807');
  const Cell = () =>
    NumericCellRenderer({
      value,
      valueFormatted: value.toString(),
      node: { rowIndex: 1 },
      col: {
        key: 'metric',
        label: 'Metric',
        dataType: GenericDataType.Numeric,
        isNumeric: true,
        config: {},
      },
      columns: [],
      hasBasicColorFormatters: false,
      basicColorFormatters: [],
      valueRange: [10, 10],
      alignPositiveNegative: true,
      colorPositiveNegative: false,
    } as never);

  render(<Cell />);

  expect(screen.getByText('9223372036854775807')).toBeInTheDocument();
});
