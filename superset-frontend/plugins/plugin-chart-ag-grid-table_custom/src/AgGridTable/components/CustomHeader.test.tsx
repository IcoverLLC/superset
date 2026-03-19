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
/* eslint-disable import/no-extraneous-dependencies */
import type { ReactNode } from 'react';
import { render } from 'spec/helpers/testing-library';
import type { GridApi } from 'ag-grid-community';
import CustomHeader from './CustomHeader';

jest.mock('./Filter', () => () => <div data-test="filter-icon" />);
jest.mock('./KebabMenu', () => () => <div data-test="kebab-menu" />);
jest.mock('./CustomPopover', () => ({
  __esModule: true,
  default: ({
    children,
  }: {
    children: ReactNode;
    content: ReactNode;
    isOpen: boolean;
    onClose: () => void;
  }) => <>{children}</>,
}));

const createProps = (sort: 'asc' | 'desc' | null = null) => ({
  displayName: 'global_sales',
  enableSorting: true,
  setSort: jest.fn(),
  context: {
    initialSortState: sort ? [{ colId: 'sales', sort }] : [],
    onColumnHeaderClicked: jest.fn(),
  },
  column: {
    getColId: () => 'sales',
    getColDef: () => ({ context: {} }),
    getUserProvidedColDef: () => ({ isMain: false }),
    isFilterActive: () => false,
  },
  api: {
    getColumnFilterInstance: jest.fn(),
  } as unknown as GridApi,
});

test('does not render sort icon wrapper when column is not sorted', () => {
  const { queryByTestId } = render(<CustomHeader {...createProps()} />);

  expect(queryByTestId('sort-icon-wrapper')).not.toBeInTheDocument();
});

test('renders sort icon wrapper only for the sorted column', () => {
  const { getByTestId } = render(<CustomHeader {...createProps('asc')} />);

  expect(getByTestId('sort-icon-wrapper')).toBeInTheDocument();
});

test('keeps header actions visible when the filter is active', () => {
  const props = createProps();
  props.column.isFilterActive = () => true;

  const { getByTestId } = render(<CustomHeader {...props} />);

  expect(getByTestId('header-filter-trigger-container')).toHaveClass(
    'filter-trigger',
    'active',
    'is-visible',
  );
  expect(getByTestId('header-menu-trigger-container')).toHaveClass(
    'customHeaderAction',
    'is-visible',
  );
});

test('does not render the three-dots menu for percent metrics', () => {
  const props = createProps();
  props.column.getColDef = () => ({ context: { isPercentMetric: true } });

  const { queryByTestId } = render(<CustomHeader {...props} />);

  expect(queryByTestId('header-menu-trigger')).not.toBeInTheDocument();
  expect(queryByTestId('header-filter-trigger')).toBeInTheDocument();
});

test('renders the title inside the ag-grid label/text structure', () => {
  const { container } = render(<CustomHeader {...createProps()} />);

  expect(
    container.querySelector(
      '.ag-header-cell-label > div > .ag-header-cell-text',
    ),
  ).toHaveTextContent('global_sales');
});

test('keeps the title wrapper min-width at least as wide as the longest word', () => {
  const { getByTestId } = render(<CustomHeader {...createProps()} />);

  expect(getByTestId('header-title-wrapper')).toHaveStyle({
    minWidth: '12ch',
  });
});
