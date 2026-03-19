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
import type { Column, GridApi } from 'ag-grid-community';
import { act, fireEvent, render } from 'spec/helpers/testing-library';
import { Header } from './Header';
import { PIVOT_COL_ID } from './constants';

jest.mock('./HeaderMenu', () => ({
  HeaderMenu: () => <div data-test="mock-header-menu" />,
}));

class MockApi extends EventTarget {
  setColumnsVisible = jest.fn();

  private columns: Column[] = [];

  getFilterModel = jest.fn(() => ({}));

  setColumns(columns: Column[]) {
    this.columns = columns;
  }

  getColumns() {
    return this.columns;
  }

  getAllDisplayedColumns() {
    return this.columns.filter(column => column.isVisible());
  }

  isDestroyed() {
    return false;
  }
}

const createColumn = (
  colId: string,
  isVisible = true,
  overrides: Partial<Column> = {},
) =>
  ({
    getColId: () => colId,
    isPinnedLeft: () => true,
    isPinnedRight: () => false,
    isVisible: () => isVisible,
    getSort: () => 'asc',
    getSortIndex: () => null,
    ...overrides,
  }) as unknown as Column;

const setup = () => {
  const api = new MockApi();
  const column = createColumn('123');
  const anotherColumn = createColumn('456');
  api.setColumns([column, anotherColumn]);

  const props = {
    displayName: 'test column',
    setSort: jest.fn(),
    enableSorting: true,
    column,
    api: api as unknown as GridApi,
  };

  return { api, props };
};

test('renders display name for the column', () => {
  const { props } = setup();
  const { queryByText } = render(<Header {...props} />);
  expect(queryByText(props.displayName)).toBeInTheDocument();
});

test('sorts by clicking a column header', () => {
  const { props } = setup();
  const { getByText } = render(<Header {...props} />);
  fireEvent.click(getByText(props.displayName));
  expect(props.setSort).toHaveBeenCalledWith('asc', false);
  fireEvent.click(getByText(props.displayName));
  expect(props.setSort).toHaveBeenCalledWith('desc', false);
  fireEvent.click(getByText(props.displayName));
  expect(props.setSort).toHaveBeenCalledWith(null, false);
});

test('hides a column on Alt + click without sorting', () => {
  const { api, props } = setup();
  const { getByText } = render(<Header {...props} />);

  fireEvent.click(getByText(props.displayName), { altKey: true });

  expect(api.setColumnsVisible).toHaveBeenCalledWith(['123'], false);
  expect(props.setSort).not.toHaveBeenCalled();
});

test('does not hide the last visible column on Alt + click', () => {
  const api = new MockApi();
  const column = createColumn('123');
  api.setColumns([column]);
  const setSort = jest.fn();

  const { getByText } = render(
    <Header
      displayName="test column"
      setSort={setSort}
      enableSorting
      column={column}
      api={api as unknown as GridApi}
    />,
  );

  fireEvent.click(getByText('test column'), { altKey: true });

  expect(api.setColumnsVisible).not.toHaveBeenCalled();
  expect(setSort).not.toHaveBeenCalled();
});

test('synchronizes the current sort when sortChanged event occured', async () => {
  const { api, props } = setup();
  const { findByTitle } = render(<Header {...props} />);
  act(() => {
    api.dispatchEvent(new Event('sortChanged'));
  });
  expect(
    await findByTitle(/Alt \+ click to hide the column/i),
  ).toBeInTheDocument();
});

test('keeps filter trigger hidden when filter is active and shows active indicator instead', async () => {
  const { api, props } = setup();
  api.getFilterModel = jest.fn(() => ({
    '123': {
      filter: 'abc',
      type: 'contains',
    },
  }));

  const { container, findByTitle } = render(<Header {...props} />);

  act(() => {
    api.dispatchEvent(new Event('filterChanged'));
  });

  expect(
    await findByTitle(/Alt \+ click to hide the column/i),
  ).toBeInTheDocument();
  expect(container.querySelector('.filter-trigger.active')).toBeInTheDocument();
  expect(
    container.querySelector('.filter-trigger.is-visible'),
  ).not.toBeInTheDocument();
  expect(container.querySelector('.filter-trigger.active')).toHaveStyle({
    visibility: 'hidden',
  });
});

test('hide display name for PIVOT_COL_ID', () => {
  const { api, props } = setup();
  const { queryByText } = render(
    <Header
      {...props}
      api={api as unknown as GridApi}
      column={createColumn(PIVOT_COL_ID)}
    />,
  );
  expect(queryByText(props.displayName)).not.toBeInTheDocument();
});
