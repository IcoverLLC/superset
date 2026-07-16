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

jest.mock('./AgGridTable', () => () => null);
jest.mock('./utils/useColDefs', () => ({ useColDefs: () => [] }));

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
