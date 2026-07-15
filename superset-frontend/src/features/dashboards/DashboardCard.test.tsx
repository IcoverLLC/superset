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

import { MemoryRouter } from 'react-router-dom';
import {
  JsonResponse,
  SupersetClient,
  isFeatureEnabled,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';

import { render, screen, waitFor, within } from 'spec/helpers/testing-library';

import DashboardCard from './DashboardCard';

const mockDashboard = {
  id: 1,
  dashboard_title: 'Sample Dashboard',
  certified_by: 'John Doe',
  certification_details: 'Certified on 2022-01-01',
  published: true,
  url: '/dashboard/1',
  thumbnail_url: '/thumbnails/1.png',
  changed_on_delta_humanized: '2 days ago',
  owners: [
    { id: 1, name: 'Alice', first_name: 'Alice', last_name: 'Doe' },
    { id: 2, name: 'Bob', first_name: 'Bob', last_name: 'Smith' },
  ],
  changed_by_name: 'John Doe',
  changed_by: 'john.doe@example.com',
};

const mockHasPerm = jest.fn().mockReturnValue(true);
const mockOpenDashboardEditModal = jest.fn();
const mockSaveFavoriteStatus = jest.fn();
const mockHandleBulkDashboardExport = jest.fn();
const mockOnDelete = jest.fn();

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

beforeAll(() => {
  mockedIsFeatureEnabled.mockReturnValue(true);
});

afterAll(() => {
  mockedIsFeatureEnabled.mockClear();
});

beforeEach(() => {
  render(
    <MemoryRouter>
      <DashboardCard
        dashboard={mockDashboard}
        hasPerm={mockHasPerm}
        bulkSelectEnabled={false}
        loading={false}
        openDashboardEditModal={mockOpenDashboardEditModal}
        saveFavoriteStatus={mockSaveFavoriteStatus}
        favoriteStatus={false}
        userId={1}
        handleBulkDashboardExport={mockHandleBulkDashboardExport}
        onDelete={mockOnDelete}
      />
    </MemoryRouter>,
  );
});

test('Renders the dashboard title', () => {
  const titleElement = screen.getByText('Sample Dashboard');
  expect(titleElement).toBeInTheDocument();
});

it('Renders the certification badge', () => {
  const certificationDetailsElement = screen.getByTestId('info-circle');
  expect(certificationDetailsElement).toBeInTheDocument();
});

it('renders the certification badge with the action controls', () => {
  const actions = screen.getByTestId('card-actions');
  const favorite = within(actions).getByTestId('fave-unfave-icon');
  const certified = within(actions).getByTestId('info-circle');

  expect(favorite).toBeInTheDocument();
  expect(certified).toBeInTheDocument();
  expect(favorite.compareDocumentPosition(certified)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
});

it('Renders the published status', () => {
  const publishedElement = screen.getByText(/published/i);
  expect(publishedElement).toBeInTheDocument();
});

test('Renders the modified date', () => {
  const modifiedDateElement = screen.getByText('Modified 2 days ago');
  expect(modifiedDateElement).toBeInTheDocument();
});

it('renders a custom description when provided', () => {
  render(
    <MemoryRouter>
      <DashboardCard
        dashboard={mockDashboard}
        description="Viewed 3 hours ago"
        hasPerm={mockHasPerm}
        bulkSelectEnabled={false}
        loading={false}
        openDashboardEditModal={mockOpenDashboardEditModal}
        saveFavoriteStatus={mockSaveFavoriteStatus}
        favoriteStatus={false}
        userId={1}
        handleBulkDashboardExport={mockHandleBulkDashboardExport}
        onDelete={mockOnDelete}
      />
    </MemoryRouter>,
  );

  expect(screen.getByText('Viewed 3 hours ago')).toBeInTheDocument();
});

it('keeps the highlighted border for bordered dashboard cards', () => {
  expect(screen.getByTestId('styled-card').parentElement).toHaveStyleRule(
    'border',
    `1px solid ${supersetTheme.colorTextLabel}`,
    {
      target: '.ant-card.ant-card-bordered',
    },
  );
});

it('should fetch thumbnail when dashboard has no thumbnail URL and feature flag is enabled', async () => {
  const mockGet = jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { thumbnail_url: '/new-thumbnail.png' } },
  } as unknown as JsonResponse);

  const { rerender } = render(
    <DashboardCard
      dashboard={{
        id: 1,
        thumbnail_url: '',
        changed_by_name: '',
        changed_by: '',
        dashboard_title: '',
        published: false,
        url: '',
        owners: [],
      }}
      hasPerm={() => true}
      bulkSelectEnabled={false}
      loading={false}
      saveFavoriteStatus={() => {}}
      favoriteStatus={false}
      showThumbnails
      handleBulkDashboardExport={() => {}}
      onDelete={() => {}}
    />,
  );
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalledWith({
      endpoint: '/api/v1/dashboard/1',
    });
  });
  rerender(
    <DashboardCard
      dashboard={{
        id: 1,
        thumbnail_url: '/new-thumbnail.png',
        changed_by_name: '',
        changed_by: '',
        dashboard_title: '',
        published: false,
        url: '',
        owners: [],
      }}
      hasPerm={() => true}
      bulkSelectEnabled={false}
      loading={false}
      saveFavoriteStatus={() => {}}
      favoriteStatus={false}
      showThumbnails
      handleBulkDashboardExport={() => {}}
      onDelete={() => {}}
    />,
  );
  mockGet.mockRestore();
});
