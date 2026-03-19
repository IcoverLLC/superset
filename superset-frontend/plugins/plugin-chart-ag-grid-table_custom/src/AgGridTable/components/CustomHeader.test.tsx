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
