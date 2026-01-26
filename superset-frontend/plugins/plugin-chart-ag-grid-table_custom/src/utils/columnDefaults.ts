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
import { ColDef } from '@superset-ui/core/components/ThemedAgGridReact';
import { PIVOT_COL_ID } from '../gridHeader/constants';

type DefaultColumnState = {
  hidden: Set<string>;
  pinnedLeft: Set<string>;
  pinnedRight: Set<string>;
};

export const getColKey = (colDef: ColDef): string =>
  colDef.colId || colDef.field || colDef.headerName || '';

export const isServiceColumnKey = (colKey?: string) =>
  colKey === PIVOT_COL_ID;

export const normalizeDefaultColumnKeys = (
  hidden: string[] = [],
  pinnedLeft: string[] = [],
  pinnedRight: string[] = [],
) => {
  const hiddenSet = new Set(hidden.filter(Boolean));
  const leftSet = new Set(pinnedLeft.filter(Boolean));
  const rightSet = new Set(pinnedRight.filter(Boolean));

  leftSet.forEach(key => rightSet.delete(key));

  return {
    hidden: [...hiddenSet],
    pinnedLeft: [...leftSet],
    pinnedRight: [...rightSet],
  };
};

export const buildDefaultColumnState = (
  hidden: string[] = [],
  pinnedLeft: string[] = [],
  pinnedRight: string[] = [],
): DefaultColumnState => {
  const normalized = normalizeDefaultColumnKeys(
    hidden,
    pinnedLeft,
    pinnedRight,
  );

  return {
    hidden: new Set(normalized.hidden),
    pinnedLeft: new Set(normalized.pinnedLeft),
    pinnedRight: new Set(normalized.pinnedRight),
  };
};

export const applyDefaultColumnState = (
  colDefs: ColDef[],
  defaultState: DefaultColumnState,
): ColDef[] =>
  colDefs.map(colDef => {
    if ('children' in colDef && Array.isArray(colDef.children)) {
      return {
        ...colDef,
        children: applyDefaultColumnState(
          colDef.children as ColDef[],
          defaultState,
        ),
      };
    }

    const colKey = getColKey(colDef);
    if (!colKey || isServiceColumnKey(colKey)) {
      return colDef;
    }

    const updatedColDef: ColDef = { ...colDef };

    if (defaultState.hidden.has(colKey)) {
      updatedColDef.hide = true;
    }

    if (defaultState.pinnedLeft.has(colKey)) {
      updatedColDef.pinned = 'left';
    } else if (defaultState.pinnedRight.has(colKey)) {
      updatedColDef.pinned = 'right';
    }

    return updatedColDef;
  });
