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
import { isString, isBoolean } from 'lodash';
import { isBlank } from '@apache-superset/core/utils';
import { addAlpha, DataRecord } from '@superset-ui/core';
import tinycolor from 'tinycolor2';
import {
  ColorFormatters,
  Comparator,
  ConditionalFormattingConfig,
  CustomConditionalFormattingColorScheme,
  MultipleValueComparators,
  ResolvedColorFormatterResult,
} from '../types';

export const round = (num: number, precision = 0) =>
  Number(`${Math.round(Number(`${num}e+${precision}`))}e-${precision}`);

const MIN_OPACITY_BOUNDED = 0.05;
const MIN_OPACITY_UNBOUNDED = 0;
const MAX_OPACITY = 1;
const READABLE_TEXT_COLORS = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
];
const DEFAULT_TWO_LEVELS_COLORS = ['#D14343', '#2E8B57'] as const;
const DEFAULT_THREE_LEVELS_COLORS = ['#D14343', '#F0B429', '#2E8B57'] as const;
const DEFAULT_REVERSE_TWO_LEVELS_COLORS = ['#2E8B57', '#D14343'] as const;
const DEFAULT_REVERSE_THREE_LEVELS_COLORS = ['#2E8B57', '#F0B429', '#D14343'] as const;
const DEFAULT_RED_WHITE_GREEN_COLORS = ['#D14343', '#FFFFFF', '#2E8B57'] as const;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

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
  value: number | string | boolean | null,
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

  if (isNaN(numCutoffPoint) || isNaN(numExtremeValue)) {
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
    useGradient,
  }: ConditionalFormattingConfig,
  columnValues: number[] | string[] | (boolean | null)[],
  alpha?: boolean,
  theme?: Record<string, any>,
) => {
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY;

  let comparatorFunction: (
    value: number | string | boolean | null,
    allValues: number[] | string[] | (boolean | null)[],
  ) => false | { cutoffValue: number | string; extremeValue: number | string };
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
      comparatorFunction = (value: number | string, allValues: number[]) => {
        if (typeof value !== 'number') {
          return { cutoffValue: value!, extremeValue: value! };
        }
        const cutoffValue = Math.min(...allValues);
        const extremeValue = Math.max(...allValues);
        return value >= cutoffValue && value <= extremeValue
          ? { cutoffValue, extremeValue }
          : false;
      };
      break;
    case Comparator.GreaterThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value > targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.max(...allValues),
            }
          : false;
      break;
    case Comparator.LessThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value < targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.min(...allValues),
            }
          : false;
      break;
    case Comparator.GreaterOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value >= targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.max(...allValues),
            }
          : false;
      break;
    case Comparator.LessOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value <= targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.min(...allValues),
            }
          : false;
      break;
    case Comparator.Equal:
      comparatorFunction = (value: number | string) =>
        value === targetValue!
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotEqual:
      comparatorFunction = (value: number, allValues: number[]) => {
        if (typeof targetValue === 'number') {
          if (value === targetValue!) {
            return false;
          }
          const max = Math.max(...allValues);
          const min = Math.min(...allValues);
          return {
            cutoffValue: targetValue!,
            extremeValue:
              Math.abs(targetValue! - min) > Math.abs(max - targetValue!)
                ? min
                : max,
          };
        }
        return false;
      };

      break;
    case Comparator.Between:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrLeftEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrRightEqual:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BeginsWith:
      comparatorFunction = (value: string) =>
        isString(value) && value?.startsWith(targetValue as string)
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.EndsWith:
      comparatorFunction = (value: string) =>
        isString(value) && value?.endsWith(targetValue as string)
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.Containing:
      comparatorFunction = (value: string) =>
        isString(value) &&
        value?.toLowerCase().includes((targetValue as string).toLowerCase())
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotContaining:
      comparatorFunction = (value: string) =>
        isString(value) &&
        !value?.toLowerCase().includes((targetValue as string).toLowerCase())
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;

      break;
    case Comparator.IsTrue:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && value
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsFalse:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && !value
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsNull:
      comparatorFunction = (value: boolean | null) =>
        value === null
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsNotNull:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && value !== null
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    default:
      comparatorFunction = () => false;
      break;
  }

  return (value: number | string | boolean | null) => {
    if (isBlank(value) && operator !== Comparator.IsNull) {
      return undefined;
    }
    const compareResult = comparatorFunction(value, columnValues);
    if (compareResult === false) return undefined;
    const { cutoffValue, extremeValue } = compareResult;
    const gradientColors = getGradientColors(colorScheme, theme);

    if (
      gradientColors &&
      typeof value === 'number' &&
      typeof cutoffValue === 'number' &&
      typeof extremeValue === 'number'
    ) {
      return getGradientColor(
        value,
        cutoffValue,
        extremeValue,
        gradientColors,
        midpoint,
      );
    }

    // If useGradient is explicitly false, return solid color.
    if (useGradient === false) {
      return colorScheme;
    }

    // Otherwise apply the legacy alpha gradient for backward compatibility.
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
            toAllRow: config?.toAllRow,
            toTextColor: config?.toTextColor,
            columnFormatting: config?.columnFormatting,
            objectFormatting: config?.objectFormatting,
            getColorFromValue: getColorFunction(
              { ...config, colorScheme: resolvedColorScheme },
              data.map(row => row[config.column!] as number),
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

export const getReadableTextColor = (
  backgroundColor: string | undefined,
  surfaceColor: string,
): string | undefined => {
  if (!backgroundColor) {
    return undefined;
  }

  const background = tinycolor(backgroundColor);
  const surface = tinycolor(surfaceColor);

  if (!background.isValid() || !surface.isValid()) {
    return undefined;
  }

  const { r: bgR, g: bgG, b: bgB, a: bgAlpha } = background.toRgb();
  const { r: surfaceR, g: surfaceG, b: surfaceB } = surface.toRgb();
  const alpha = bgAlpha;

  const compositeColor = tinycolor({
    r: bgR * alpha + surfaceR * (1 - alpha),
    g: bgG * alpha + surfaceG * (1 - alpha),
    b: bgB * alpha + surfaceB * (1 - alpha),
  });

  return tinycolor
    .mostReadable(compositeColor, READABLE_TEXT_COLORS, {
      includeFallbackColors: true,
      level: 'AA',
      size: 'small',
    })
    .toRgbString();
};

export const getNormalizedTextColor = (
  color: string | undefined,
): string | undefined => {
  if (!color) {
    return undefined;
  }

  const parsedColor = tinycolor(color);
  if (!parsedColor.isValid()) {
    return color;
  }

  return parsedColor.setAlpha(1).toRgbString();
};

export const getTextColorForBackground = (
  result: ResolvedColorFormatterResult,
  surfaceColor: string,
): string | undefined =>
  getNormalizedTextColor(result.color) ??
  getReadableTextColor(result.backgroundColor, surfaceColor);
