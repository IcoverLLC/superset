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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  styled,
  SupersetClient,
  t,
} from '@superset-ui/core';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
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
const WELCOME_FILTER_KEYS = ['search', 'tags', 'favorite'] as const;
const WELCOME_FILTER_HEADERS: Record<(typeof WELCOME_FILTER_KEYS)[number], string> =
  {
    search: '\u0418\u043c\u044f',
    tags: '\u0422\u0435\u0433',
    favorite: '\u0418\u0437\u0431\u0440\u0430\u043d\u043d\u043e\u0435',
  };

type WelcomeTopMode =
  | 'personal_recent_views'
  | 'recent_views'
  | 'default_order'
  | 'manual_config'
  | 'empty';

interface WelcomeSection {
  key: string;
  title: string;
  count: number | null;
  page: number;
  page_size: number;
  dashboards: Dashboard[];
}

interface WelcomeResponse {
  top_mode: WelcomeTopMode;
  top_lookback_days: number;
  top_dashboards: Dashboard[];
  recently_viewed_at?: Record<string, string>;
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

const WelcomeCardContainer = styled(CardContainer)`
  max-height: none;
  overflow: visible;
  grid-template-columns: repeat(auto-fit, 300px);
`;

const TopCardContainer = styled(WelcomeCardContainer)`
  grid-template-columns: repeat(8, 300px);

  @media (max-width: 2559px) {
    grid-template-columns: repeat(4, 300px);
  }

  @media (max-width: 1279px) {
    grid-template-columns: repeat(2, 300px);
  }

  @media (max-width: 679px) {
    grid-template-columns: repeat(1, 300px);
  }
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

function getRecentlyViewedDescription(viewedAt?: string) {
  if (!viewedAt) {
    return '\u00a0';
  }
  return t(
    '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043e %s',
    extendedDayjs(viewedAt).fromNow(),
  );
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
          userId: user.userId ?? '',
          firstName: user.firstName,
          lastName: user.lastName,
        },
      })
        .filter(filter =>
          WELCOME_FILTER_KEYS.includes(
            filter.key as (typeof WELCOME_FILTER_KEYS)[number],
          ),
        )
        .map(filter => ({
          ...filter,
          Header:
            WELCOME_FILTER_HEADERS[
              filter.key as (typeof WELCOME_FILTER_KEYS)[number]
            ] ?? filter.Header,
          unfilteredLabel:
            filter.key === 'favorite'
              ? '\u041b\u044e\u0431\u043e\u0435'
              : filter.unfilteredLabel,
          selects:
            filter.key === 'favorite'
              ? [
                  {
                    label: '\u0414\u0430',
                    value: true,
                  },
                  {
                    label: '\u041d\u0435\u0442',
                    value: false,
                  },
                ]
              : filter.selects,
        })),
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
  const [sectionExpanded, setSectionExpanded] = useState(false);
  const welcomeLoadVersionRef = useRef(0);

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
    async (
      page: number,
      append = false,
      loadSections = true,
      loadRecentlyViewedAt = true,
      preserveCurrentOnError = false,
      loadVersion = welcomeLoadVersionRef.current,
    ): Promise<WelcomeResponse | null> => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const queryParams = rison.encode_uri({
        filters: apiFilters,
        load_sections: loadSections,
        load_recently_viewed_at: loadRecentlyViewedAt,
        page,
        page_size: SECTION_PAGE_SIZE,
      });

      try {
        const { json = {} } = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/welcome/?q=${queryParams}`,
        });
        const result = json.result as WelcomeResponse;
        if (loadVersion !== welcomeLoadVersionRef.current) {
          return null;
        }
        setWelcomeData(current => {
          if (loadVersion !== welcomeLoadVersionRef.current) {
            return current;
          }

          const mergedRecentlyViewedAt = {
            ...(current?.recently_viewed_at || {}),
            ...(result.recently_viewed_at || {}),
          };

          if (!append || !current?.sections[0] || !result.sections[0]) {
            return {
              ...result,
              recently_viewed_at: mergedRecentlyViewedAt,
            };
          }
          const nextSection = result.sections[0];
          const previousSection = current.sections[0];
          return {
            ...result,
            recently_viewed_at: mergedRecentlyViewedAt,
            sections: [
              {
                ...nextSection,
                count: nextSection.count ?? previousSection.count,
                dashboards: [
                  ...previousSection.dashboards,
                  ...nextSection.dashboards,
                ],
              },
            ],
          };
        });
        return result;
      } catch (response) {
        if (loadVersion !== welcomeLoadVersionRef.current) {
          return null;
        }
        await createErrorHandler(errMsg =>
          addDangerToast(
            t(
              '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c ' +
                '\u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c ' +
                '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u044b ' +
                '\u043d\u0430 \u0433\u043b\u0430\u0432\u043d\u043e\u0439 ' +
                '\u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435: %s',
              errMsg,
            ),
          ),
        )(response as string);
        if (!preserveCurrentOnError) {
          setWelcomeData(null);
        }
        return null;
      } finally {
        if (loadVersion === welcomeLoadVersionRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [addDangerToast, apiFilters],
  );

  const fetchInitialWelcomeData = useCallback(async () => {
    const loadVersion = welcomeLoadVersionRef.current + 1;
    welcomeLoadVersionRef.current = loadVersion;
    const initialData = await fetchWelcomeData(
      0,
      false,
      false,
      true,
      false,
      loadVersion,
    );
    if (!initialData || loadVersion !== welcomeLoadVersionRef.current) {
      return;
    }
    const sectionsData = await fetchWelcomeData(
      0,
      false,
      true,
      false,
      true,
      loadVersion,
    );
    if (!sectionsData || loadVersion !== welcomeLoadVersionRef.current) {
      return;
    }
    void fetchWelcomeData(0, false, true, true, true, loadVersion);
  }, [fetchWelcomeData]);

  useEffect(() => {
    void fetchInitialWelcomeData();
  }, [fetchInitialWelcomeData]);

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
      }).then(() => fetchInitialWelcomeData()),
    [fetchInitialWelcomeData],
  );

  const hasMoreDashboards =
    section?.count != null && section.count > sectionDashboards.length;

  const topSectionDescription = useMemo(() => {
    if (!welcomeData) {
      return t(
        '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 ' +
          '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u043e\u0432',
      );
    }
    if (
      welcomeData.top_mode === 'recent_views' ||
      welcomeData.top_mode === 'personal_recent_views'
    ) {
      return t(
        '\u041d\u0430 \u043e\u0441\u043d\u043e\u0432\u0435 \u0432\u0430\u0448\u0438\u0445 ' +
          '\u043f\u043e\u0441\u0435\u0449\u0435\u043d\u0438\u0439 \u0437\u0430 ' +
          '\u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0435 ' +
          '%s \u0434\u043d\u0435\u0439',
        welcomeData.top_lookback_days,
      );
    }
    if (welcomeData.top_mode === 'manual_config') {
      return t(
        '\u0421\u0435\u043a\u0446\u0438\u044f \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0430 ' +
          '\u0438\u0437 \u0440\u0435\u0437\u0435\u0440\u0432\u043d\u043e\u0433\u043e ' +
          '\u0441\u043f\u0438\u0441\u043a\u0430 dashboard ID ' +
          '\u0432 \u043a\u043e\u043d\u0444\u0438\u0433\u0443\u0440\u0430\u0446\u0438\u0438 Superset',
      );
    }
    if (welcomeData.top_mode === 'default_order') {
      return t(
        '\u041f\u043e\u0434\u0431\u043e\u0440\u043a\u0430 ' +
          '\u0441\u0444\u043e\u0440\u043c\u0438\u0440\u043e\u0432\u0430\u043d\u0430 ' +
          '\u0438\u0437 \u0430\u043a\u0442\u0443\u0430\u043b\u044c\u043d\u044b\u0445 ' +
          '\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0445 ' +
          '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u043e\u0432',
      );
    }
    return t(
      '\u041f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c ' +
        '\u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c ' +
        '\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0435 ' +
        '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b',
    );
  }, [welcomeData]);

  const renderCards = useCallback(
    (
      dashboards: Dashboard[],
      currentFavoriteStatus: FavoriteStatus,
      layout: 'default' | 'top' = 'default',
    ) => {
      const Container =
        layout === 'top' ? TopCardContainer : WelcomeCardContainer;
      return (
        <Container showThumbnails={showThumbnails}>
          {dashboards.map(dashboard => (
            <DashboardCard
              key={dashboard.id}
              dashboard={{
                ...dashboard,
                thumbnail_url: `/api/v1/dashboard/${dashboard.id}/welcome-thumbnail/`,
              }}
              description={getRecentlyViewedDescription(
                welcomeData?.recently_viewed_at?.[String(dashboard.id)],
              )}
              showPublishedLabel={false}
              hasPerm={hasPerm}
              bulkSelectEnabled={false}
              showThumbnails={showThumbnails}
              thumbnailLoadBehavior="deferred"
              thumbnailLoadDelayMs={layout === 'top' ? 0 : 600}
              userId={user.userId}
              loading={false}
              openDashboardEditModal={setDashboardToEdit}
              saveFavoriteStatus={saveFavoriteStatus}
              favoriteStatus={currentFavoriteStatus[dashboard.id]}
              handleBulkDashboardExport={handleBulkDashboardExport}
              onDelete={setDashboardToDelete}
            />
          ))}
        </Container>
      );
    },
    [
      handleBulkDashboardExport,
      hasPerm,
      saveFavoriteStatus,
      showThumbnails,
      user.userId,
      welcomeData?.recently_viewed_at,
    ],
  );

  const topDashboards = useMemo(
    () => welcomeData?.top_dashboards ?? [],
    [welcomeData?.top_dashboards],
  );

  const handleCollapseChange = useCallback(
    (activeKeys: string | string[]) => {
      const nextKeys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
      setSectionExpanded(nextKeys.includes('all_dashboards'));
    },
    [],
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
        <h2>
          {t(
            '\u041f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0439 ' +
              '\u0442\u043e\u043f \u0434\u0430\u0448\u0431\u043e\u0440\u0434\u043e\u0432',
          )}
        </h2>
        <p>{topSectionDescription}</p>
      </SectionIntro>

      {loading && !welcomeData ? (
        <TopCardContainer showThumbnails={showThumbnails}>
          {[...new Array(loadingCardCount)].map((_, index) => (
            <ListViewCard
              key={index}
              cover={showThumbnails ? undefined : <></>}
              description=""
              loading
            />
          ))}
        </TopCardContainer>
      ) : topDashboards.length ? (
        renderCards(topDashboards, favoriteStatus, 'top')
      ) : (
        <EmptySection>
          {t(
            '\u0412 \u0441\u0435\u043a\u0446\u0438\u0438 \u0422\u041e\u041f ' +
              '\u043f\u043e\u043a\u0430 \u043d\u0435\u0442 ' +
              '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u043e\u0432 ' +
              '\u0434\u043b\u044f \u043e\u0442\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u044f',
          )}
        </EmptySection>
      )}

      <Collapse
        activeKey={sectionExpanded ? ['all_dashboards'] : []}
        onChange={handleCollapseChange}
        ghost
        items={[
          {
            key: 'all_dashboards',
            forceRender: true,
            label:
              section?.count == null
                ? t(
                    '\u041f\u0440\u043e\u0447\u0438\u0435 ' +
                      '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u044b',
                  )
                : `${t(
                    '\u041f\u0440\u043e\u0447\u0438\u0435 ' +
                      '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u044b',
                  )} (${section.count})`,
            children:
              loading && sectionExpanded && !sectionDashboards.length ? (
                <WelcomeCardContainer showThumbnails={showThumbnails}>
                  {[...new Array(loadingCardCount)].map((_, index) => (
                    <ListViewCard
                      key={index}
                      cover={showThumbnails ? undefined : <></>}
                      description=""
                      loading
                    />
                  ))}
                </WelcomeCardContainer>
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
                            void fetchWelcomeData(
                              section.page + 1,
                              true,
                              true,
                              true,
                            );
                          }
                        }}
                      >
                        {t('\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0435\u0449\u0451')}
                      </Button>
                    </LoadMoreRow>
                  )}
                </>
              ) : sectionExpanded ? (
                <EmptySection>
                  {t(
                    '\u041f\u043e \u0442\u0435\u043a\u0443\u0449\u0438\u043c ' +
                      '\u0444\u0438\u043b\u044c\u0442\u0440\u0430\u043c ' +
                      '\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0435 ' +
                      '\u0434\u0430\u0448\u0431\u043e\u0440\u0434\u044b ' +
                      '\u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b',
                  )}
                </EmptySection>
              ) : null,
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
                void fetchInitialWelcomeData();
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
