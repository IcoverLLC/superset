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
import memoizeOne from 'memoize-one';
import { addAlpha, DataRecord } from '@superset-ui/core';
import {
  ColorFormatters,
  Comparator,
  ConditionalFormattingConfig,
  CustomConditionalFormattingColorScheme,
  MultipleValueComparators,
} from '../types';

export const round = (num: number, precision = 0) =>
  Number(`${Math.round(Number(`${num}e+${precision}`))}e-${precision}`);

const MIN_OPACITY_BOUNDED = 0.05;
const MIN_OPACITY_UNBOUNDED = 0;
const MAX_OPACITY = 1;
const DEFAULT_TWO_LEVELS_COLORS = ['#D14343', '#2E8B57'] as const;
const DEFAULT_THREE_LEVELS_COLORS = ['#D14343', '#F0B429', '#2E8B57'] as const;
const DEFAULT_REVERSE_TWO_LEVELS_COLORS = ['#2E8B57', '#D14343'] as const;
const DEFAULT_REVERSE_THREE_LEVELS_COLORS = ['#2E8B57', '#F0B429', '#D14343'] as const;
const DEFAULT_RED_WHITE_GREEN_COLORS = ['#D14343', '#FFFFFF', '#2E8B57'] as const;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (typeof value === 'number' && Number.isNaN(value));

const getNumericValues = (values: Array<number | string>) =>
  values.filter(
    (value): value is number => typeof value === 'number' && !Number.isNaN(value),
  );

const normalizeHexColor = (color: string) => {
  if (!color.startsWith('#')) {
    return null;
  }

  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  if (color.length === 7) {
    return color;
  }

  if (color.length === 9) {
    return color.slice(0, 7);
  }

  return null;
};

const interpolateChannel = (start: number, end: number, ratio: number) =>
  Math.round(start + (end - start) * ratio);

const interpolateHexColor = (
  startColor: string,
  endColor: string,
  ratio: number,
) => {
  const normalizedStart = normalizeHexColor(startColor);
  const normalizedEnd = normalizeHexColor(endColor);

  if (!normalizedStart || !normalizedEnd) {
    return endColor;
  }

  const safeRatio = clamp(ratio);
  const startRed = parseInt(normalizedStart.slice(1, 3), 16);
  const startGreen = parseInt(normalizedStart.slice(3, 5), 16);
  const startBlue = parseInt(normalizedStart.slice(5, 7), 16);
  const endRed = parseInt(normalizedEnd.slice(1, 3), 16);
  const endGreen = parseInt(normalizedEnd.slice(3, 5), 16);
  const endBlue = parseInt(normalizedEnd.slice(5, 7), 16);

  return `#${interpolateChannel(startRed, endRed, safeRatio)
    .toString(16)
    .padStart(2, '0')}${interpolateChannel(startGreen, endGreen, safeRatio)
    .toString(16)
    .padStart(2, '0')}${interpolateChannel(startBlue, endBlue, safeRatio)
    .toString(16)
    .padStart(2, '0')}`.toUpperCase();
};

const getGradientColors = (
  colorScheme: string | undefined,
  theme?: Record<string, any>,
) => {
  if (colorScheme === CustomConditionalFormattingColorScheme.TwoLevels) {
    return [
      theme?.colorError ?? DEFAULT_TWO_LEVELS_COLORS[0],
      theme?.colorSuccess ?? DEFAULT_TWO_LEVELS_COLORS[1],
    ];
  }

  if (colorScheme === CustomConditionalFormattingColorScheme.ThreeLevels) {
    return [
      theme?.colorError ?? DEFAULT_THREE_LEVELS_COLORS[0],
      theme?.colorWarning ?? DEFAULT_THREE_LEVELS_COLORS[1],
      theme?.colorSuccess ?? DEFAULT_THREE_LEVELS_COLORS[2],
    ];
  }

  if (colorScheme === CustomConditionalFormattingColorScheme.ReverseTwoLevels) {
    return [
      theme?.colorSuccess ?? DEFAULT_REVERSE_TWO_LEVELS_COLORS[0],
      theme?.colorError ?? DEFAULT_REVERSE_TWO_LEVELS_COLORS[1],
    ];
  }

  if (
    colorScheme === CustomConditionalFormattingColorScheme.ReverseThreeLevels
  ) {
    return [
      theme?.colorSuccess ?? DEFAULT_REVERSE_THREE_LEVELS_COLORS[0],
      theme?.colorWarning ?? DEFAULT_REVERSE_THREE_LEVELS_COLORS[1],
      theme?.colorError ?? DEFAULT_REVERSE_THREE_LEVELS_COLORS[2],
    ];
  }

  if (colorScheme === CustomConditionalFormattingColorScheme.RedWhiteGreen) {
    return [
      theme?.colorError ?? DEFAULT_RED_WHITE_GREEN_COLORS[0],
      DEFAULT_RED_WHITE_GREEN_COLORS[1],
      theme?.colorSuccess ?? DEFAULT_RED_WHITE_GREEN_COLORS[2],
    ];
  }

  return null;
};

const getGradientPosition = (
  value: number,
  lowerBound: number,
  upperBound: number,
) => {
  if (upperBound === lowerBound) {
    return 1;
  }

  return clamp((value - lowerBound) / (upperBound - lowerBound));
};

const getGradientColor = (
  value: number,
  cutoffValue: number,
  extremeValue: number,
  colors: string[],
  midpoint?: number,
) => {
  const lowerBound = Math.min(cutoffValue, extremeValue);
  const upperBound = Math.max(cutoffValue, extremeValue);

  if (upperBound === lowerBound) {
    return colors[colors.length - 1];
  }

  if (colors.length === 2) {
    return interpolateHexColor(
      colors[0],
      colors[1],
      getGradientPosition(value, lowerBound, upperBound),
    );
  }

  const resolvedMidpoint =
    midpoint === undefined
      ? lowerBound + (upperBound - lowerBound) / 2
      : Math.min(upperBound, Math.max(lowerBound, midpoint));

  if (value <= resolvedMidpoint) {
    if (resolvedMidpoint === lowerBound) {
      return colors[0];
    }

    return interpolateHexColor(
      colors[0],
      colors[1],
      getGradientPosition(value, lowerBound, resolvedMidpoint),
    );
  }

  if (resolvedMidpoint === upperBound) {
    return colors[2];
  }

  return interpolateHexColor(
    colors[1],
    colors[2],
    getGradientPosition(value, resolvedMidpoint, upperBound),
  );
};

export const getOpacity = (
  value: number | string,
  cutoffPoint: number | string,
  extremeValue: number | string,
  minOpacity = MIN_OPACITY_BOUNDED,
  maxOpacity = MAX_OPACITY,
) => {
  if (extremeValue === cutoffPoint || typeof value !== 'number') {
    return maxOpacity;
  }
  const numCutoffPoint =
    typeof cutoffPoint === 'string' ? parseFloat(cutoffPoint) : cutoffPoint;
  const numExtremeValue =
    typeof extremeValue === 'string' ? parseFloat(extremeValue) : extremeValue;

  if (Number.isNaN(numCutoffPoint) || Number.isNaN(numExtremeValue)) {
    return maxOpacity;
  }

  return Math.min(
    maxOpacity,
    round(
      Math.abs(
        ((maxOpacity - minOpacity) / (numExtremeValue - numCutoffPoint)) *
          (value - numCutoffPoint),
      ) + minOpacity,
      2,
    ),
  );
};

export const getColorFunction = (
  {
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
    midpoint,
    colorScheme,
  }: ConditionalFormattingConfig,
  columnValues: Array<number | string>,
  alpha?: boolean,
  theme?: Record<string, any>,
) => {
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY;

  let comparatorFunction: (
    value: number | string,
    allValues: Array<number | string>,
  ) => false | { cutoffValue: number | string; extremeValue: number | string };
  const numericColumnValues = getNumericValues(columnValues);

  if (operator === undefined || colorScheme === undefined) {
    return () => undefined;
  }
  if (
    MultipleValueComparators.includes(operator) &&
    (targetValueLeft === undefined || targetValueRight === undefined)
  ) {
    return () => undefined;
  }
  if (
    operator !== Comparator.None &&
    !MultipleValueComparators.includes(operator) &&
    targetValue === undefined
  ) {
    return () => undefined;
  }
  switch (operator) {
    case Comparator.None:
      minOpacity = MIN_OPACITY_UNBOUNDED;
      comparatorFunction = (
        value: number | string,
        allValues: Array<number | string>,
      ) => {
        if (isEmptyValue(value)) {
          return false;
        }
        if (typeof value === 'string') {
          return { cutoffValue: value, extremeValue: value };
        }
        const numericValues = getNumericValues(allValues);
        if (!numericValues.length) {
          return false;
        }
        const cutoffValue = Math.min(...numericValues);
        const extremeValue = Math.max(...numericValues);
        return value >= cutoffValue && value <= extremeValue
          ? { cutoffValue, extremeValue }
          : false;
      };
      break;
    case Comparator.GreaterThan:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        typeof targetValue === 'number' &&
        value > targetValue
          ? {
              cutoffValue: targetValue,
              extremeValue: Math.max(...numericColumnValues),
            }
          : false;
      break;
    case Comparator.LessThan:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        typeof targetValue === 'number' &&
        value < targetValue
          ? {
              cutoffValue: targetValue,
              extremeValue: Math.min(...numericColumnValues),
            }
          : false;
      break;
    case Comparator.GreaterOrEqual:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        typeof targetValue === 'number' &&
        value >= targetValue
          ? {
              cutoffValue: targetValue,
              extremeValue: Math.max(...numericColumnValues),
            }
          : false;
      break;
    case Comparator.LessOrEqual:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        typeof targetValue === 'number' &&
        value <= targetValue
          ? {
              cutoffValue: targetValue,
              extremeValue: Math.min(...numericColumnValues),
            }
          : false;
      break;
    case Comparator.Equal:
      comparatorFunction = (value: number | string) =>
        !isEmptyValue(value) && value === targetValue
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotEqual:
      comparatorFunction = (
        value: number | string,
        allValues: Array<number | string>,
      ) => {
        if (isEmptyValue(value) || value === targetValue) {
          return false;
        }
        if (typeof value === 'string' || typeof targetValue === 'string') {
          return {
            cutoffValue: targetValue!,
            extremeValue: targetValue!,
          };
        }
        const numericValues = getNumericValues(allValues);
        const max = Math.max(...numericValues);
        const min = Math.min(...numericValues);
        return {
          cutoffValue: targetValue!,
          extremeValue:
            Math.abs(targetValue! - min) > Math.abs(max - targetValue!)
              ? min
              : max,
        };
      };
      break;
    case Comparator.Between:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        value > targetValueLeft! &&
        value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrEqual:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        value >= targetValueLeft! &&
        value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrLeftEqual:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        value >= targetValueLeft! &&
        value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrRightEqual:
      comparatorFunction = (value: number | string) =>
        typeof value === 'number' &&
        value > targetValueLeft! &&
        value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    default:
      comparatorFunction = () => false;
      break;
  }

  return (value: number | string) => {
    const compareResult = comparatorFunction(value, columnValues);
    if (compareResult === false) return undefined;
    const { cutoffValue, extremeValue } = compareResult;
    const numericValue = typeof value === 'number' ? value : null;
    const numericCutoffValue =
      typeof cutoffValue === 'number' ? cutoffValue : null;
    const numericExtremeValue =
      typeof extremeValue === 'number' ? extremeValue : null;
    const gradientColors =
      numericValue !== null &&
      numericCutoffValue !== null &&
      numericExtremeValue !== null
        ? getGradientColors(colorScheme, theme)
        : null;

    if (gradientColors) {
      return getGradientColor(
        numericValue!,
        numericCutoffValue!,
        numericExtremeValue!,
        gradientColors,
        midpoint,
      );
    }

    if (alpha === undefined || alpha) {
      return addAlpha(
        colorScheme,
        getOpacity(value, cutoffValue, extremeValue, minOpacity, maxOpacity),
      );
    }
    return colorScheme;
  };
};

export const getColorFormatters = memoizeOne(
  (
    columnConfig: ConditionalFormattingConfig[] | undefined,
    data: DataRecord[],
    theme?: Record<string, any>,
    alpha?: boolean,
  ) =>
    columnConfig?.reduce(
      (acc: ColorFormatters, config: ConditionalFormattingConfig) => {
        let resolvedColorScheme = config.colorScheme;
        if (
          theme &&
          typeof config.colorScheme === 'string' &&
          config.colorScheme.startsWith('color') &&
          theme[config.colorScheme]
        ) {
          resolvedColorScheme = theme[config.colorScheme] as string;
        }

        if (
          config?.column !== undefined &&
          (config?.operator === Comparator.None ||
            (config?.operator !== undefined &&
              (MultipleValueComparators.includes(config?.operator)
                ? config?.targetValueLeft !== undefined &&
                  config?.targetValueRight !== undefined
                : config?.targetValue !== undefined)))
        ) {
          acc.push({
            column: config?.column,
            getColorFromValue: getColorFunction(
              { ...config, colorScheme: resolvedColorScheme },
              data.map(row => row[config.column!] as number | string),
              alpha,
              theme,
            ),
          });
        }
        return acc;
      },
      [],
    ) ?? [],
);
