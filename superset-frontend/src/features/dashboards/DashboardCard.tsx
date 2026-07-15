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
import { useEffect, useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import {
  isFeatureEnabled,
  FeatureFlag,
  SupersetClient,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import { CardStyles } from 'src/views/CRUD/utils';
import {
  Dropdown,
  Button,
  CertifiedBadge,
  FaveStar,
  PublishedLabel,
  ListViewCard,
} from '@superset-ui/core/components';
import { MenuItem } from '@superset-ui/core/components/Menu';
import { Icons } from '@superset-ui/core/components/Icons';
import { Dashboard } from 'src/views/CRUD/types';
import { FacePile, TagsList, type TagType } from 'src/components';
import { TagTypeEnum } from 'src/components/Tag/TagType';

const DashboardCardStyles = styled(CardStyles)`
  && .ant-card.ant-card-bordered {
    border: 1px solid ${({ theme }) => theme.colorTextLabel};
    background-color: ${({ theme }) => theme.colorBgContainer};
    box-shadow: 0 1px 2px ${({ theme }) => theme.colorBorderSecondary};
    transition:
      border-color ${({ theme }) => theme.motionDurationMid} ease,
      box-shadow ${({ theme }) => theme.motionDurationMid} ease;
  }

  &:hover .ant-card.ant-card-bordered {
    border-color: ${({ theme }) => theme.colorPrimaryBorderHover};
    box-shadow:
      0 0 0 1px ${({ theme }) => theme.colorPrimaryBorderHover},
      0 8px 24px -8px ${({ theme }) => theme.colorPrimaryBgHover};
  }
`;

const DeferredThumbnailCover = styled.div`
  ${({ theme }) => `
    height: 264px;
    border-bottom: 1px solid ${theme.colorSplit};
    background:
      linear-gradient(
        180deg,
        ${theme.colorFillTertiary} 0%,
        ${theme.colorBgLayout} 100%
      );
  `}
`;

const DASHBOARD_CARD_FALLBACK_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 400'%3E%3Crect width='600' height='400' fill='%23f3f4f6'/%3E%3C/svg%3E";

interface DashboardCardProps {
  isChart?: boolean;
  dashboard: Dashboard;
  description?: string;
  showPublishedLabel?: boolean;
  hasPerm: (name: string) => boolean;
  bulkSelectEnabled: boolean;
  loading: boolean;
  openDashboardEditModal?: (d: Dashboard) => void;
  saveFavoriteStatus: (id: number, isStarred: boolean) => void;
  favoriteStatus: boolean;
  userId?: string | number;
  showThumbnails?: boolean;
  thumbnailLoadBehavior?: 'eager' | 'deferred';
  thumbnailLoadDelayMs?: number;
  handleBulkDashboardExport: (dashboardsToExport: Dashboard[]) => void;
  onDelete: (dashboard: Dashboard) => void;
}

function DashboardCard({
  dashboard,
  description,
  showPublishedLabel = true,
  hasPerm,
  bulkSelectEnabled,
  userId,
  openDashboardEditModal,
  favoriteStatus,
  saveFavoriteStatus,
  showThumbnails,
  thumbnailLoadBehavior = 'eager',
  thumbnailLoadDelayMs = 0,
  handleBulkDashboardExport,
  onDelete,
}: DashboardCardProps) {
  const history = useHistory();
  const canEdit = hasPerm('can_write');
  const canDelete = hasPerm('can_write');
  const canExport = hasPerm('can_export');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    dashboard.thumbnail_url || null,
  );
  const [fetchingThumbnail, setFetchingThumbnail] = useState<boolean>(false);
  const [thumbnailLoadEnabled, setThumbnailLoadEnabled] = useState(
    thumbnailLoadBehavior === 'eager',
  );
  const thumbnailsFeatureEnabled =
    isFeatureEnabled(FeatureFlag.Thumbnails) && !!showThumbnails;

  useEffect(() => {
    setThumbnailUrl(dashboard.thumbnail_url || null);
    setFetchingThumbnail(false);
  }, [dashboard.id, dashboard.thumbnail_url]);

  useEffect(() => {
    if (!thumbnailsFeatureEnabled) {
      setThumbnailLoadEnabled(false);
      return undefined;
    }

    if (thumbnailLoadBehavior === 'eager') {
      setThumbnailLoadEnabled(true);
      return undefined;
    }

    setThumbnailLoadEnabled(false);
    const enableThumbnailLoading = () => setThumbnailLoadEnabled(true);
    let idleHandle: number | null = null;
    let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

    const scheduleIdleLoading = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleHandle = window.requestIdleCallback(enableThumbnailLoading, {
          timeout: 1200,
        });
        return;
      }

      timeoutHandle = globalThis.setTimeout(enableThumbnailLoading, 0);
    };

    if (thumbnailLoadDelayMs > 0) {
      timeoutHandle = globalThis.setTimeout(
        scheduleIdleLoading,
        thumbnailLoadDelayMs,
      );
    } else {
      scheduleIdleLoading();
    }

    return () => {
      if (idleHandle !== null) {
        window.cancelIdleCallback?.(idleHandle);
      }
      if (timeoutHandle !== null) {
        globalThis.clearTimeout(timeoutHandle);
      }
    };
  }, [
    dashboard.id,
    thumbnailLoadBehavior,
    thumbnailLoadDelayMs,
    thumbnailsFeatureEnabled,
  ]);

  useEffect(() => {
    // fetch thumbnail only if it's not already fetched
    if (
      !fetchingThumbnail &&
      dashboard.id &&
      thumbnailLoadEnabled &&
      thumbnailsFeatureEnabled &&
      (thumbnailUrl === undefined || thumbnailUrl === null)
    ) {
      // fetch thumbnail
      if (dashboard.thumbnail_url) {
        // set to empty string if null so that we don't
        // keep fetching the thumbnail
        setThumbnailUrl(dashboard.thumbnail_url || '');
        return;
      }
      setFetchingThumbnail(true);
      SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboard.id}`,
      }).then(({ json = {} }) => {
        setThumbnailUrl(json.result?.thumbnail_url || '');
        setFetchingThumbnail(false);
      });
    }
  }, [
    dashboard,
    fetchingThumbnail,
    thumbnailLoadEnabled,
    thumbnailUrl,
    thumbnailsFeatureEnabled,
  ]);

  const shouldRenderThumbnail = Boolean(
    thumbnailsFeatureEnabled && thumbnailLoadEnabled && thumbnailUrl,
  );

  const menuItems: MenuItem[] = [];
  const customTags = (dashboard.tags || []).filter(
    (tag: TagType) =>
      tag.type === 'TagTypes.custom' || tag.type === TagTypeEnum.Custom,
  );

  if (canEdit && openDashboardEditModal) {
    menuItems.push({
      key: 'edit',
      label: (
        <div
          role="button"
          tabIndex={0}
          className="action-button"
          onClick={() => openDashboardEditModal(dashboard)}
          data-test="dashboard-card-option-edit-button"
        >
          <Icons.EditOutlined iconSize="l" data-test="edit-alt" /> {t('Edit')}
        </div>
      ),
    });
  }

  if (canExport) {
    menuItems.push({
      key: 'export',
      label: (
        <div
          role="button"
          tabIndex={0}
          onClick={() => handleBulkDashboardExport([dashboard])}
          className="action-button"
          data-test="dashboard-card-option-export-button"
        >
          <Icons.UploadOutlined iconSize="l" /> {t('Export')}
        </div>
      ),
    });
  }

  if (canDelete) {
    menuItems.push({
      key: 'delete',
      label: (
        <div
          role="button"
          tabIndex={0}
          className="action-button"
          onClick={() => onDelete(dashboard)}
          data-test="dashboard-card-option-delete-button"
        >
          <Icons.DeleteOutlined iconSize="l" /> {t('Delete')}
        </div>
      ),
    });
  }

  return (
    <DashboardCardStyles
      onClick={() => {
        if (!bulkSelectEnabled) {
          history.push(dashboard.url);
        }
      }}
    >
      <ListViewCard
        loading={dashboard.loading || false}
        title={dashboard.dashboard_title}
        titleRight={
          showPublishedLabel ? (
            <PublishedLabel isPublished={dashboard.published} />
          ) : null
        }
        cover={
          !thumbnailsFeatureEnabled ? (
            <></>
          ) : !shouldRenderThumbnail ? (
            <DeferredThumbnailCover />
          ) : null
        }
        url={bulkSelectEnabled ? undefined : dashboard.url}
        linkComponent={Link}
        imgURL={shouldRenderThumbnail ? thumbnailUrl : ''}
        imgFallbackURL={DASHBOARD_CARD_FALLBACK_DATA_URI}
        description={
          description ?? t('Modified %s', dashboard.changed_on_delta_humanized)
        }
        coverLeft={<FacePile users={dashboard.owners || []} />}
        coverRight={
          customTags.length ? <TagsList tags={customTags} maxTags={2} /> : null
        }
        actions={
          <ListViewCard.Actions
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            {userId && (
              <FaveStar
                itemId={dashboard.id}
                saveFaveStar={saveFavoriteStatus}
                isStarred={favoriteStatus}
              />
            )}
            {dashboard.certified_by && (
              <CertifiedBadge
                certifiedBy={dashboard.certified_by}
                details={dashboard.certification_details}
                headline={dashboard.dashboard_title}
                showCertifiedBy={false}
              />
            )}
            <Dropdown menu={{ items: menuItems }} trigger={['hover', 'click']}>
              <Button buttonSize="xsmall" buttonStyle="link">
                <Icons.MoreOutlined iconSize="xl" />
              </Button>
            </Dropdown>
          </ListViewCard.Actions>
        }
      />
    </DashboardCardStyles>
  );
}

export default DashboardCard;
