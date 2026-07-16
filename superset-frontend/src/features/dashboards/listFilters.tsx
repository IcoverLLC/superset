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
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import {
  type ListViewFilter,
  type ListViewFilters,
  ListViewFilterOperator as FilterOperator,
} from 'src/components';
import { WIDER_DROPDOWN_WIDTH } from 'src/components/ListView/utils';
import { loadTags } from 'src/components/Tag/utils';
import {
  createFetchRelated,
  createFetchOwners,
  createErrorHandler,
} from 'src/views/CRUD/utils';
import { OWNER_OPTION_FILTER_PROPS } from 'src/features/owners/OwnerSelectLabel';

interface DashboardFilterArgs {
  addDangerToast: (msg: string) => void;
  canReadTag: boolean;
  user?: {
    userId: string | number;
    firstName: string;
    lastName: string;
  };
}

export function getDashboardListFilters({
  addDangerToast,
  canReadTag,
  user,
}: DashboardFilterArgs): ListViewFilters {
  const favoritesFilter: ListViewFilter = {
    Header: t('Favorite'),
    key: 'favorite',
    id: 'id',
    urlDisplay: 'favorite',
    input: 'select',
    operator: FilterOperator.DashboardIsFav,
    unfilteredLabel: t('Any'),
    selects: [
      { label: t('Yes'), value: true },
      { label: t('No'), value: false },
    ],
  };

  return [
    {
      Header: t('Name'),
      key: 'search',
      id: 'dashboard_title',
      input: 'search',
      operator: FilterOperator.TitleOrSlug,
    },
    {
      Header: t('Status'),
      key: 'published',
      id: 'published',
      input: 'select',
      operator: FilterOperator.Equals,
      unfilteredLabel: t('Any'),
      selects: [
        { label: t('Published'), value: true },
        { label: t('Draft'), value: false },
      ],
    },
    ...(isFeatureEnabled(FeatureFlag.TaggingSystem) && canReadTag
      ? [
          {
            Header: t('Tag'),
            key: 'tags',
            id: 'tags',
            input: 'select',
            operator: FilterOperator.DashboardTagById,
            unfilteredLabel: t('All'),
            fetchSelects: loadTags,
          } satisfies ListViewFilter,
        ]
      : []),
    {
      Header: t('Owner'),
      key: 'owner',
      id: 'owners',
      input: 'select',
      operator: FilterOperator.RelationManyMany,
      unfilteredLabel: t('All'),
      fetchSelects: createFetchOwners(
        'dashboard',
        createErrorHandler(errMsg =>
          addDangerToast(
            t(
              'An error occurred while fetching dashboard owner values: %s',
              errMsg,
            ),
          ),
        ),
        user,
      ),
      optionFilterProps: OWNER_OPTION_FILTER_PROPS,
      paginate: true,
      dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
    },
    ...(user?.userId ? [favoritesFilter] : []),
    {
      Header: t('Certified'),
      key: 'certified',
      id: 'id',
      urlDisplay: 'certified',
      input: 'select',
      operator: FilterOperator.DashboardIsCertified,
      unfilteredLabel: t('Any'),
      selects: [
        { label: t('Yes'), value: true },
        { label: t('No'), value: false },
      ],
    },
    {
      Header: t('Modified by'),
      key: 'changed_by',
      id: 'changed_by',
      input: 'select',
      operator: FilterOperator.RelationOneMany,
      unfilteredLabel: t('All'),
      fetchSelects: createFetchRelated(
        'dashboard',
        'changed_by',
        createErrorHandler(errMsg =>
          addDangerToast(
            t(
              'An error occurred while fetching dashboard modifier values: %s',
              errMsg,
            ),
          ),
        ),
        user,
      ),
      paginate: true,
      dropdownStyle: { minWidth: WIDER_DROPDOWN_WIDTH },
    },
  ];
}
