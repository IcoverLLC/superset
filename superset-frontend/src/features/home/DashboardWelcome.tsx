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
 * software distributed with the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import rison from 'rison';
import { useSelector } from 'react-redux';
import {
  Button,
  Collapse,
  DeleteModal,
  ListViewCard,
  Loading,
} from '@superset-ui/core/components';
import handleResourceExport from 'src/utils/export';
import PropertiesModal from 'src/dashboard/components/PropertiesModal';
import DashboardCard from 'src/features/dashboards/DashboardCard';
import {
  DASHBOARD_WELCOME_FILTER_KEYS,
  getDashboardListFilters,
} from 'src/features/dashboards/listFilters';
import {
  type Dashboard,
  type FavoriteStatus,
} from 'src/views/CRUD/types';
import { useFavoriteStatus, useListViewResource } from 'src/views/CRUD/hooks';
import {
  CardContainer,
  createErrorHandler,
  handleDashboardDelete,
  loadingCardCount,
} from 'src/views/CRUD/utils';
import {
  ListViewUIFilters,
  type ListViewFilterValue,
} from 'src/components/ListView';
import type { InternalFilter } from 'src/components/ListView/types';
import { findPermission } from 'src/utils/findPermission';
import type { User, UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

const SECTION_PAGE_SIZE = 24;

type WelcomeTopMode = 'recent_views' | 'manual_config' | 'empty';

interface WelcomeSection {
  key: string;
  title: string;
  count: number;
  page: number;
  page_size: number;
  dashboards: Dashboard[];
}

interface WelcomeResponse {
  top_mode: WelcomeTopMode;
  top_lookback_days: number;
  top_dashboards: Dashboard[];
  sections: WelcomeSection[];
}

interface DashboardWelcomeProps {
  user: User;
  showThumbnails: boolean;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const WelcomeDashboardStyles = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 6}px ${theme.sizeUnit * 8}px ${theme.sizeUnit * 10}px;

    .ant-collapse {
      background: transparent;
    }

    .ant-collapse-item {
      border-bottom: 1px solid ${theme.colorBorderSecondary};
    }

    .ant-collapse-header {
      padding-inline: 0 !important;
      align-items: center !important;
      font-size: ${theme.fontSizeLG}px;
      font-weight: ${theme.fontWeightStrong};
    }

    .ant-collapse-content-box {
      padding-inline: 0 !important;
      padding-top: ${theme.sizeUnit * 2}px !important;
    }
  `}
`;

const FiltersBar = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.sizeUnit * 4}px ${theme.sizeUnit * 6}px;
    margin-bottom: ${theme.sizeUnit * 8}px;

    > * {
      min-width: min(100%, ${theme.sizeUnit * 55}px);
    }
  `}
`;

const SectionIntro = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 5}px;

    h2 {
      margin: 0 0 ${theme.sizeUnit * 2}px;
      font-size: ${theme.fontSizeXL}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    p {
      margin: 0;
      color: ${theme.colorTextSecondary};
    }
  `}
`;

const EmptySection = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 8}px 0 ${theme.sizeUnit * 4}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const LoadMoreRow = styled.div`
  ${({ theme }) => `
    display: flex;
    justify-content: center;
    padding-top: ${theme.sizeUnit * 6}px;
  `}
`;

function isFilterValuePresent(value: ListViewFilterValue['value']) {
  return value !== '' && value !== null && value !== undefined;
}

function normalizeFilterValue(value: ListViewFilterValue['value']) {
  if (value && typeof value === 'object' && 'value' in value) {
    return value.value;
  }
  return value;
}

function DashboardWelcome({
  user,
  showThumbnails,
  addDangerToast,
  addSuccessToast,
}: DashboardWelcomeProps) {
  const { roles } = useSelector<any, UserWithPermissionsAndRoles>(
    state => state.user,
  );
  const canReadTag = findPermission('can_read', 'Tag', roles);
  const filterConfigs = useMemo(
    () =>
      getDashboardListFilters({
        addDangerToast,
        canReadTag,
        user: {
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      }).filter(filter =>
        DASHBOARD_WELCOME_FILTER_KEYS.includes(
          filter.key as (typeof DASHBOARD_WELCOME_FILTER_KEYS)[number],
        ),
      ),
    [addDangerToast, canReadTag, user.firstName, user.lastName, user.userId],
  );
  const defaultFilters = useMemo<InternalFilter[]>(
    () =>
      filterConfigs.map(filter => ({
        id: filter.id,
        operator: filter.operator,
        urlDisplay: filter.urlDisplay,
        value: undefined,
      })),
    [filterConfigs],
  );
  const [internalFilters, setInternalFilters] =
    useState<InternalFilter[]>(defaultFilters);
  const [welcomeData, setWelcomeData] = useState<WelcomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [preparingExport, setPreparingExport] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(
    null,
  );
  const [dashboardToEdit, setDashboardToEdit] = useState<Dashboard | null>(null);

  const { hasPerm } = useListViewResource<Dashboard>(
    'dashboard',
    t('dashboard'),
    addDangerToast,
    true,
    [],
    [],
    false,
  );

  useEffect(() => {
    setInternalFilters(defaultFilters);
  }, [defaultFilters]);

  const apiFilters = useMemo(
    () =>
      internalFilters
        .filter(({ value }) => isFilterValuePresent(value))
        .map(({ id, operator, value }) => ({
          col: id,
          opr: operator,
          value: normalizeFilterValue(value),
        })),
    [internalFilters],
  );

  const section = welcomeData?.sections[0];
  const sectionDashboards = section?.dashboards ?? [];
  const allDashboards = useMemo(() => {
    const dashboardsById = new Map<number, Dashboard>();
    (welcomeData?.top_dashboards ?? []).forEach(dashboard => {
      dashboardsById.set(dashboard.id, dashboard);
    });
    sectionDashboards.forEach(dashboard => {
      dashboardsById.set(dashboard.id, dashboard);
    });
    return [...dashboardsById.values()];
  }, [sectionDashboards, welcomeData?.top_dashboards]);
  const dashboardIds = useMemo(
    () => allDashboards.map(dashboard => dashboard.id),
    [allDashboards],
  );
  const [saveFavoriteStatus, favoriteStatus] = useFavoriteStatus(
    'dashboard',
    dashboardIds,
    addDangerToast,
  );

  const fetchWelcomeData = useCallback(
    async (page: number, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const queryParams = rison.encode_uri({
        filters: apiFilters,
        page,
        page_size: SECTION_PAGE_SIZE,
      });

      try {
        const { json = {} } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/welcome/?q=${queryParams}`,
        });
        const result = json.result as WelcomeResponse;
        setWelcomeData(current => {
          if (!append || !current?.sections[0]) {
            return result;
          }
          const nextSection = result.sections[0];
          const previousSection = current.sections[0];
          return {
            ...result,
            sections: [
              {
                ...nextSection,
                dashboards: [
                  ...previousSection.dashboards,
                  ...nextSection.dashboards,
                ],
              },
            ],
          };
        });
      } catch (response) {
        await createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue fetching welcome dashboards: %s', errMsg),
          ),
        )(response as string);
        setWelcomeData(null);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [addDangerToast, apiFilters],
  );

  useEffect(() => {
    void fetchWelcomeData(0);
  }, [fetchWelcomeData]);

  const handleBulkDashboardExport = useCallback((dashboards: Dashboard[]) => {
    setPreparingExport(true);
    handleResourceExport(
      'dashboard',
      dashboards.map(({ id }) => id),
      () => {
        setPreparingExport(false);
      },
    );
  }, []);

  const handleDashboardEdit = useCallback(
    (dashboard: Dashboard) =>
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboard.id}`,
      }).then(() => fetchWelcomeData(0)),
    [fetchWelcomeData],
  );

  const hasMoreDashboards = (section?.count ?? 0) > sectionDashboards.length;

  const topSectionDescription = useMemo(() => {
    if (!welcomeData) {
      return t('Loading dashboards');
    }
    if (welcomeData.top_mode === 'recent_views') {
      return t(
        'Ranked by dashboard opens in the last %s days',
        welcomeData.top_lookback_days,
      );
    }
    if (welcomeData.top_mode === 'manual_config') {
      return t('Filled from the manual dashboard ID fallback in Superset config');
    }
    return t('No published dashboards matched the current filters');
  }, [welcomeData]);

  const renderCards = useCallback(
    (dashboards: Dashboard[], currentFavoriteStatus: FavoriteStatus) => (
      <CardContainer showThumbnails={showThumbnails}>
        {dashboards.map(dashboard => (
          <DashboardCard
            key={dashboard.id}
            dashboard={dashboard}
            hasPerm={hasPerm}
            bulkSelectEnabled={false}
            showThumbnails={showThumbnails}
            userId={user.userId}
            loading={false}
            openDashboardEditModal={setDashboardToEdit}
            saveFavoriteStatus={saveFavoriteStatus}
            favoriteStatus={currentFavoriteStatus[dashboard.id]}
            handleBulkDashboardExport={handleBulkDashboardExport}
            onDelete={setDashboardToDelete}
          />
        ))}
      </CardContainer>
    ),
    [
      handleBulkDashboardExport,
      hasPerm,
      saveFavoriteStatus,
      showThumbnails,
      user.userId,
    ],
  );

  return (
    <WelcomeDashboardStyles>
      <FiltersBar>
        <ListViewUIFilters
          filters={filterConfigs}
          internalFilters={internalFilters}
          updateFilterValue={(index, value) => {
            setInternalFilters(currentFilters =>
              currentFilters.map((filterValue, filterIndex) =>
                filterIndex === index
                  ? {
                      ...filterValue,
                      id: filterConfigs[index].id,
                      operator: filterConfigs[index].operator,
                      urlDisplay: filterConfigs[index].urlDisplay,
                      value,
                    }
                  : filterValue,
              ),
            );
          }}
        />
      </FiltersBar>

      <SectionIntro>
        <h2>{t('Top dashboards')}</h2>
        <p>{topSectionDescription}</p>
      </SectionIntro>

      {loading && !welcomeData ? (
        <CardContainer showThumbnails={showThumbnails}>
          {[...new Array(loadingCardCount)].map((_, index) => (
            <ListViewCard
              key={index}
              cover={showThumbnails ? undefined : <></>}
              description=""
              loading
            />
          ))}
        </CardContainer>
      ) : welcomeData?.top_dashboards.length ? (
        renderCards(welcomeData.top_dashboards, favoriteStatus)
      ) : (
        <EmptySection>{t('No dashboards to show in the TOP section.')}</EmptySection>
      )}

      <Collapse
        defaultActiveKey={['all_dashboards']}
        ghost
        items={[
          {
            key: 'all_dashboards',
            label: `${section?.title ?? t('All dashboards')} (${section?.count ?? 0})`,
            children:
              loading && !welcomeData ? (
                <CardContainer showThumbnails={showThumbnails}>
                  {[...new Array(loadingCardCount)].map((_, index) => (
                    <ListViewCard
                      key={index}
                      cover={showThumbnails ? undefined : <></>}
                      description=""
                      loading
                    />
                  ))}
                </CardContainer>
              ) : sectionDashboards.length ? (
                <>
                  {renderCards(sectionDashboards, favoriteStatus)}
                  {hasMoreDashboards && (
                    <LoadMoreRow>
                      <Button
                        buttonStyle="secondary"
                        loading={loadingMore}
                        onClick={() => {
                          if (section) {
                            void fetchWelcomeData(section.page + 1, true);
                          }
                        }}
                      >
                        {t('Load more')}
                      </Button>
                    </LoadMoreRow>
                  )}
                </>
              ) : (
                <EmptySection>
                  {t('No published dashboards matched the current filters.')}
                </EmptySection>
              ),
          },
        ]}
      />

      {dashboardToEdit && (
        <PropertiesModal
          dashboardId={dashboardToEdit.id}
          show
          onHide={() => setDashboardToEdit(null)}
          onSubmit={handleDashboardEdit}
        />
      )}

      {dashboardToDelete && (
        <DeleteModal
          description={
            <>
              {t('Are you sure you want to delete')}{' '}
              <b>{dashboardToDelete.dashboard_title}</b>?
            </>
          }
          onConfirm={() => {
            handleDashboardDelete(
              dashboardToDelete,
              () => {
                void fetchWelcomeData(0);
              },
              addSuccessToast,
              addDangerToast,
            );
            setDashboardToDelete(null);
          }}
          onHide={() => setDashboardToDelete(null)}
          open={!!dashboardToDelete}
          title={t('Please confirm')}
        />
      )}

      {preparingExport && <Loading />}
    </WelcomeDashboardStyles>
  );
}

export default DashboardWelcome;
