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

import { ColorFormatters } from '@superset-ui/chart-controls';
import { getContrastingColor } from '@superset-ui/core';
import { CellClassParams } from '@superset-ui/core/components/ThemedAgGridReact';
import tinycolor from 'tinycolor2';
import { BasicColorFormatterType, InputColumn } from '../types';

type CellStyleParams = CellClassParams & {
  hasColumnColorFormatters: boolean | undefined;
  columnColorFormatters: ColorFormatters;
  hasBasicColorFormatters: boolean | undefined;
  basicColorFormatters?: {
    [Key: string]: BasicColorFormatterType;
  }[];
  col: InputColumn;
  isDarkTheme?: boolean;
  themeBackgroundColor?: string;
};

const DARK_THEME_CONDITIONAL_FORMATTING_MIX = 72;

const getAdaptiveConditionalFormattingBackground = ({
  backgroundColor,
  isDarkTheme,
  themeBackgroundColor,
}: {
  backgroundColor?: string;
  isDarkTheme?: boolean;
  themeBackgroundColor?: string;
}) => {
  if (
    !backgroundColor?.startsWith('#') ||
    !isDarkTheme ||
    !themeBackgroundColor
  ) {
    return backgroundColor;
  }

  return tinycolor
    .mix(
      themeBackgroundColor,
      backgroundColor,
      DARK_THEME_CONDITIONAL_FORMATTING_MIX,
    )
    .toHex8String();
};

const getConditionalFormattingTextColor = ({
  backgroundColor,
  isDarkTheme,
}: {
  backgroundColor?: string;
  isDarkTheme?: boolean;
}) => {
  if (!isDarkTheme || !backgroundColor?.startsWith('#')) {
    return '';
  }

  return getContrastingColor(
    backgroundColor.length === 9
      ? backgroundColor.slice(0, 7)
      : backgroundColor,
  );
};

const getCellStyle = (params: CellStyleParams) => {
  const {
    value,
    colDef,
    rowIndex,
    hasBasicColorFormatters,
    basicColorFormatters,
    hasColumnColorFormatters,
    columnColorFormatters,
    col,
    node,
    isDarkTheme,
    themeBackgroundColor,
  } = params;
  let backgroundColor;
  if (hasColumnColorFormatters && node?.rowPinned !== 'bottom') {
    columnColorFormatters!
      .filter(formatter => {
        const colTitle = formatter?.column?.includes('Main')
          ? formatter?.column?.replace('Main', '').trim()
          : formatter?.column;
        return colTitle === colDef.field;
      })
      .forEach(formatter => {
        const formatterResult =
          value || value === 0 ? formatter.getColorFromValue(value) : false;
        if (formatterResult) {
          backgroundColor = formatterResult;
        }
      });
  }

  if (
    hasBasicColorFormatters &&
    col?.metricName &&
    node?.rowPinned !== 'bottom'
  ) {
    backgroundColor =
      basicColorFormatters?.[rowIndex]?.[col.metricName]?.backgroundColor;
  }

  const textAlign =
    col?.config?.horizontalAlign || (col?.isNumeric ? 'right' : 'left');
  const adaptiveBackgroundColor =
    getAdaptiveConditionalFormattingBackground({
      backgroundColor,
      isDarkTheme,
      themeBackgroundColor,
    }) || backgroundColor;

  return {
    backgroundColor: adaptiveBackgroundColor || '',
    color: getConditionalFormattingTextColor({
      backgroundColor: adaptiveBackgroundColor,
      isDarkTheme,
    }),
    textAlign,
  };
};

export default getCellStyle;
