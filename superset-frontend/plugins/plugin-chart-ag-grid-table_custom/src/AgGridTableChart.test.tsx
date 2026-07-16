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
import { render, waitFor } from 'spec/helpers/testing-library';
import testData from '../../plugin-chart-table/test/testData';
import AgGridTableChart from './AgGridTableChart';
import transformProps from './transformProps';

type GridCallbacks = {
  onServerPaginationChange: (pageNumber: number, pageSize: number) => void;
  onServerPageSizeChange: (pageSize: number) => void;
  onSearchChange: (searchText: string) => void;
  onSortChange: (sortBy: { id: string; desc: boolean }[]) => void;
};

let mockGridProps: GridCallbacks | undefined;
const mockUseColDefs = jest.fn((_args: unknown) => []);

jest.mock('./AgGridTable', () => (props: GridCallbacks) => {
  mockGridProps = props;
  return null;
});
jest.mock('./utils/useColDefs', () => ({
  useColDefs: (args: unknown) => mockUseColDefs(args),
}));

beforeEach(() => {
  mockGridProps = undefined;
  mockUseColDefs.mockClear();
});

test('clamps a server page that is outside the updated row count', async () => {
  const setDataMask = jest.fn();
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      server_pagination: true,
      server_page_length: 20,
    },
  });

  render(
    <AgGridTableChart
      {...props}
      rowCount={50}
      serverPagination
      serverPaginationData={{ currentPage: 5, pageSize: 20 }}
      setDataMask={setDataMask}
    />,
  );

  await waitFor(() => {
    expect(setDataMask).toHaveBeenCalledWith(
      expect.objectContaining({
        ownState: expect.objectContaining({ currentPage: 2, pageSize: 20 }),
      }),
    );
  });
});

test('server callbacks preserve the latest pagination state after rerender', () => {
  const setDataMask = jest.fn();
  const props = transformProps({
    ...testData.basic,
    rawFormData: {
      ...testData.basic.rawFormData,
      server_pagination: true,
      server_page_length: 20,
    },
  });
  const initialState = {
    currentPage: 1,
    pageSize: 20,
    searchColumn: 'name',
    searchText: 'initial',
    sortBy: [{ id: 'name', desc: false }],
  };
  const latestState = {
    ...initialState,
    searchText: 'latest',
    sortBy: [{ id: 'sum__num', desc: true }],
  };
  const { rerender } = render(
    <AgGridTableChart
      {...props}
      serverPagination
      serverPaginationData={initialState}
      setDataMask={setDataMask}
    />,
  );

  rerender(
    <AgGridTableChart
      {...props}
      serverPagination
      serverPaginationData={latestState}
      setDataMask={setDataMask}
    />,
  );

  expect(mockGridProps).toBeDefined();
  mockGridProps?.onServerPaginationChange(3, 20);
  expect(setDataMask).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ownState: expect.objectContaining({
        currentPage: 3,
        searchText: 'latest',
        sortBy: latestState.sortBy,
      }),
    }),
  );

  mockGridProps?.onSearchChange('next');
  expect(setDataMask).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ownState: expect.objectContaining({
        currentPage: 0,
        searchText: 'next',
        sortBy: latestState.sortBy,
      }),
    }),
  );

  mockGridProps?.onSortChange([{ id: 'name', desc: true }]);
  expect(setDataMask).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ownState: expect.objectContaining({
        searchText: 'latest',
        sortBy: [{ id: 'name', desc: true }],
      }),
    }),
  );
});

test('recomputes visible columns when time comparison is enabled', () => {
  const props = transformProps(testData.basic);
  const columns = [
    { ...props.columns[0], config: {} },
    { ...props.columns[1], config: { visible: false } },
  ];
  const { rerender } = render(
    <AgGridTableChart
      {...props}
      columns={columns}
      isUsingTimeComparison={false}
    />,
  );

  rerender(
    <AgGridTableChart {...props} columns={columns} isUsingTimeComparison />,
  );

  const latestArgs = mockUseColDefs.mock.calls.at(-1)?.[0] as {
    columns: typeof columns;
  };
  expect(latestArgs.columns).toEqual([columns[0]]);
});
