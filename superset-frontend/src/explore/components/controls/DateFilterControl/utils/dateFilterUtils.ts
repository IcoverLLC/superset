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
import {
  NO_TIME_RANGE,
  JsonObject,
  customTimeRangeDecode,
} from '@superset-ui/core';
import { useSelector } from 'react-redux';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Dayjs } from 'dayjs';
import {
  COMMON_RANGE_VALUES_SET,
  CALENDAR_RANGE_VALUES_SET,
  CURRENT_RANGE_VALUES_SET,
  DAYJS_FORMAT,
} from '.';
import {
  DateFilterControlCalendarFormat,
  DateFilterControlVariant,
  FrameType,
} from '../types';

const MONTHLY_TIME_RANGE_VALUES = new Set([
  'previous calendar month',
  'previous calendar quarter',
  'previous calendar year',
]);

export const guessFrame = (
  timeRange: string,
  variant: DateFilterControlVariant = 'default',
): FrameType => {
  if (variant === 'v2') {
    if (timeRange === NO_TIME_RANGE) {
      return 'CalendarV2';
    }
    if (parseCalendarRange(timeRange).matchedFlag) {
      return 'CalendarV2';
    }
  }
  if (COMMON_RANGE_VALUES_SET.has(timeRange)) {
    return 'Common';
  }
  if (CALENDAR_RANGE_VALUES_SET.has(timeRange)) {
    return 'Calendar';
  }
  if (CURRENT_RANGE_VALUES_SET.has(timeRange)) {
    return 'Current';
  }
  if (timeRange === NO_TIME_RANGE) {
    return 'No filter';
  }
  if (customTimeRangeDecode(timeRange).matchedFlag) {
    return 'Custom';
  }
  return 'Advanced';
};

export function useDefaultTimeFilter() {
  return (
    useSelector(
      (state: JsonObject) => state?.common?.conf?.DEFAULT_TIME_FILTER,
    ) ?? NO_TIME_RANGE
  );
}

export type CalendarRangeValue = {
  start: Dayjs;
  end: Dayjs;
  matchedFlag: boolean;
};

export const getDefaultCalendarRange = () => {
  const end = extendedDayjs().startOf('day').subtract(1, 'day');
  const start = end.subtract(6, 'day');
  return { start, end };
};

export const getDefaultCalendarRangeValue = () => {
  const { start, end } = getDefaultCalendarRange();
  return encodeCalendarRange(start, end);
};

export const getDefaultMonthlyRangeValue = () => 'previous calendar month';

export const parseCalendarRange = (timeRange: string): CalendarRangeValue => {
  const { customRange, matchedFlag } = customTimeRangeDecode(timeRange);

  if (
    !matchedFlag ||
    customRange.sinceMode !== 'specific' ||
    customRange.untilMode !== 'specific'
  ) {
    return {
      start: extendedDayjs().startOf('day'),
      end: extendedDayjs().startOf('day'),
      matchedFlag: false,
    };
  }

  const start = extendedDayjs(customRange.sinceDatetime).startOf('day');
  const until = extendedDayjs(customRange.untilDatetime).startOf('day');
  const end = until.subtract(1, 'day').startOf('day');

  if (
    !start.isValid() ||
    !until.isValid() ||
    !until.isAfter(start) ||
    end.isBefore(start)
  ) {
    return {
      start: extendedDayjs().startOf('day'),
      end: extendedDayjs().startOf('day'),
      matchedFlag: false,
    };
  }

  return { start, end, matchedFlag: true };
};

export const encodeCalendarRange = (start: Dayjs, end: Dayjs): string =>
  `${start.startOf('day').format(DAYJS_FORMAT)} : ${end
    .startOf('day')
    .add(1, 'day')
    .format(DAYJS_FORMAT)}`;

const capitalize = (value: string) =>
  value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const MONTH_LABELS_SHORT_RU = [
  '\u042f\u043d\u0432',
  '\u0424\u0435\u0432',
  '\u041c\u0430\u0440',
  '\u0410\u043f\u0440',
  '\u041c\u0430\u0439',
  '\u0418\u044e\u043d',
  '\u0418\u044e\u043b',
  '\u0410\u0432\u0433',
  '\u0421\u0435\u043d',
  '\u041e\u043a\u0442',
  '\u041d\u043e\u044f',
  '\u0414\u0435\u043a',
];

const formatRussianShortDate = (value: Dayjs) =>
  `${value.date()} ${MONTH_LABELS_SHORT_RU[value.month()]} ${value.year()}`;

const formatRussianDateTime = (value: Dayjs) =>
  value.hour() === 0 && value.minute() === 0 && value.second() === 0
    ? value.format('DD.MM.YYYY')
    : value.format('DD.MM.YYYY HH:mm:ss');

export const formatCalendarRangeLabel = (
  start: Dayjs,
  end: Dayjs,
): string => {
  const startLabel = capitalize(formatRussianShortDate(start));
  const endLabel = capitalize(formatRussianShortDate(end));

  return start.isSame(end, 'day') ? startLabel : `${startLabel} - ${endLabel}`;
};

export const formatActualRangeForTooltip = (actualRange?: string): string => {
  if (!actualRange) {
    return '';
  }

  return actualRange.replace(
    /\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2})?/g,
    match => {
      const parsed = extendedDayjs(match);
      return parsed.isValid() ? formatRussianDateTime(parsed) : match;
    },
  );
};

export const isFullMonthCalendarRange = (timeRange: string): boolean => {
  const parsedRange = parseCalendarRange(timeRange);

  return (
    parsedRange.matchedFlag &&
    parsedRange.start.isSame(parsedRange.start.startOf('month'), 'day') &&
    parsedRange.end.isSame(parsedRange.end.endOf('month').startOf('day'), 'day')
  );
};

export const isMonthlyCompatibleTimeRange = (timeRange: string): boolean => {
  if (timeRange === NO_TIME_RANGE) {
    return true;
  }

  return (
    MONTHLY_TIME_RANGE_VALUES.has(timeRange) || isFullMonthCalendarRange(timeRange)
  );
};

export const getDefaultV2CalendarRangeValue = (
  calendarFormat: DateFilterControlCalendarFormat = 'standard',
) =>
  calendarFormat === 'monthly'
    ? getDefaultMonthlyRangeValue()
    : getDefaultCalendarRangeValue();

export const normalizeTimeRangeForCalendarFormat = (
  timeRange: string,
  calendarFormat: DateFilterControlCalendarFormat = 'standard',
) => {
  if (calendarFormat !== 'monthly' || isMonthlyCompatibleTimeRange(timeRange)) {
    return timeRange;
  }

  return getDefaultMonthlyRangeValue();
};
