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
import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { css, customTimeRangeDecode, styled, t } from '@superset-ui/core';
import { Button, Input, Loading, Select } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Dayjs } from 'dayjs';
import { useLocale } from 'src/hooks/useLocale';
import { CustomFrame } from './CustomFrame';
import { DateFilterTestKey, customTimeRangeEncode, DAYJS_FORMAT } from '../utils';
import {
  CustomRangeType,
  FrameComponentProps,
  SelectOptionType,
} from '../types';
import { encodeCalendarRange, parseCalendarRange } from '../utils/dateFilterUtils';

type QuickFrameType = 'Common' | 'Calendar' | 'Current';
type CalendarMode = 'day' | 'month' | 'custom';
type SpecificDateTimeRangeValue = {
  start: Dayjs;
  end: Dayjs;
  matchedFlag: boolean;
};

const BASE_CALENDAR_WIDTH = '552px';
const MOSCOW_TIMEZONE = 'Europe/Moscow';
const DATE_INPUT_FORMAT = 'DD.MM.YYYY';
const DATE_TIME_INPUT_FORMAT = 'DD.MM.YYYY HH:mm:ss';
const DATE_INPUT_LENGTH = DATE_INPUT_FORMAT.length;
const DATE_TIME_INPUT_LENGTH = DATE_TIME_INPUT_FORMAT.length;

const WEEKDAY_LABELS_RU = [
  '\u043f\u043d',
  '\u0432\u0442',
  '\u0441\u0440',
  '\u0447\u0442',
  '\u043f\u0442',
  '\u0441\u0431',
  '\u0432\u0441',
];

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

const Wrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
    position: relative;
  `}
`;

const QuickPanel = styled.aside`
  ${({ theme }) => css`
    align-self: stretch;
    border-left: 1px solid ${theme.colorBorder};
    margin-left: ${theme.sizeUnit * 2}px;
    padding-left: ${theme.sizeUnit * 3}px;
    width: 184px;
  `}
`;

const QuickPanelContent = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 3}px;
    height: 100%;
    padding-right: ${theme.sizeUnit * 3}px;
    width: 100%;
  `}
`;

const Header = styled.div<{ $mode: CalendarMode }>`
  ${() => css`
    align-items: center;
    display: grid;
    grid-template-columns: auto 1fr auto;
    width: ${BASE_CALENDAR_WIDTH};
  `}
`;

const HeaderCenter = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const NavButton = styled(Button)<{ $hidden?: boolean }>`
  padding: 0;
  min-width: auto;
  height: auto;
  visibility: ${({ $hidden }) => ($hidden ? 'hidden' : 'visible')};
`;

const HeaderActions = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    position: absolute;
    right: 0;
    top: 0;
  `}
`;

const HeaderActionButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
`;

const ModeButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
`;

const CalendarLayout = styled.div`
  display: flex;
  align-items: stretch;
  width: fit-content;
`;

const CalendarContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 4}px;
  width: fit-content;
`;

const MonthsHeaderRow = styled.div<{ $mode: CalendarMode }>`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns:
      12px
      250px
      250px
      12px;
    align-items: center;
    column-gap: ${theme.sizeUnit * 2}px;
    width: fit-content;
  `}
`;

const MonthsGrid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(2, max-content);
    gap: ${theme.sizeUnit * 5}px;
  `}
`;

const MonthSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 250px;
`;

const MonthTitle = styled.div`
  ${({ theme }) => css`
    font-size: 15px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 24px;
    text-align: center;
    width: 100%;
  `}
`;

const WeekdaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 34px);
  justify-content: center;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
`;

const Weekday = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextSecondary};
    font-size: ${theme.fontSizeSM}px;
    line-height: 20px;
    text-align: center;
  `}
`;

const DaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 34px);
  justify-content: center;
  gap: 2px;
`;

const MonthsOfYearGrid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(3, 76px);
    gap: ${theme.sizeUnit * 2}px;
    justify-content: center;
  `}
`;

const QuickPanelSection = styled.div`
  width: 156px;
`;

const QuickPanelLabel = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    line-height: 20px;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const QuickPanelDivider = styled.div`
  ${({ theme }) => css`
    background: ${theme.colorBorder};
    height: 1px;
    width: 156px;
  `}
`;

const QuickPanelSelect = styled(Select)`
  width: 156px;
`;

const QuickOptions = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 2}px;
    margin-top: ${theme.sizeUnit * 4}px;
  `}
`;

const QuickOptionButton = styled.button<{ selected: boolean }>`
  ${({ theme, selected }) => css`
    background: transparent;
    border: 0;
    color: ${selected ? theme.colorPrimaryHover : theme.colorPrimary};
    cursor: pointer;
    font: inherit;
    font-weight: ${selected ? theme.fontWeightStrong : theme.fontWeightNormal};
    line-height: 20px;
    padding: 0;
    text-align: left;

    &:hover {
      color: ${theme.colorPrimaryHover};
    }
  `}
`;

const getRangeBorderRadius = (
  borderRadius: number,
  selected: boolean,
  inRange: boolean,
  rangeStart: boolean,
  rangeEnd: boolean,
) => {
  if (selected) {
    return `${borderRadius}px`;
  }
  if (rangeStart) {
    return `${borderRadius}px 0 0 ${borderRadius}px`;
  }
  if (rangeEnd) {
    return `0 ${borderRadius}px ${borderRadius}px 0`;
  }
  if (inRange) {
    return '0';
  }
  return `${borderRadius}px`;
};

const DayCell = styled.button<{
  selected: boolean;
  inRange: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  weekend: boolean;
  today: boolean;
}>`
  ${({ theme, selected, inRange, rangeStart, rangeEnd, weekend, today }) => css`
    align-items: center;
    appearance: none;
    background: ${selected
      ? theme.colorPrimary
      : inRange
        ? theme.colorFillSecondary
        : today
          ? theme.colorPrimaryBg
        : 'transparent'};
    border: 0;
    border-radius: ${getRangeBorderRadius(
      theme.borderRadius,
      selected,
      inRange,
      rangeStart,
      rangeEnd,
    )};
    color: ${selected
      ? theme.colorWhite
      : weekend
        ? theme.colorError
        : theme.colorText};
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    height: 32px;
    justify-content: center;
    line-height: 20px;
    padding: 0;
    box-shadow: ${today && !selected && !inRange
      ? `inset 0 0 0 1px ${theme.colorPrimaryBgHover}`
      : 'none'};
    width: 34px;

    &:hover {
      background: ${selected
        ? theme.colorPrimaryHover
        : inRange
          ? theme.colorFill
          : today
            ? theme.colorPrimaryBgHover
          : theme.colorFillTertiary};
    }
  `}
`;

const EmptyDayCell = styled.div`
  height: 32px;
  width: 34px;
`;

const MonthValueCell = styled.button<{
  selected: boolean;
  inRange: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
}>`
  ${({ theme, selected, inRange, rangeStart, rangeEnd }) => css`
    appearance: none;
    background: ${selected
      ? theme.colorPrimary
      : inRange
        ? theme.colorFill
        : theme.colorFillTertiary};
    border: 0;
    border-radius: ${getRangeBorderRadius(
      theme.borderRadius,
      selected,
      inRange,
      rangeStart,
      rangeEnd,
    )};
    color: ${selected ? theme.colorWhite : theme.colorText};
    cursor: pointer;
    font: inherit;
    height: 36px;
    padding: 0 ${theme.sizeUnit * 2}px;

    &:hover {
      background: ${selected
        ? theme.colorPrimaryHover
        : inRange
          ? theme.colorFill
          : theme.colorFill};
    }
  `}
`;

const BottomInputsRow = styled.div<{ $mode: CalendarMode }>`
  ${({ theme }) => css`
    align-items: center;
    display: grid;
    gap: ${theme.sizeUnit * 2}px;
    grid-template-columns: max-content 1fr;
    width: ${BASE_CALENDAR_WIDTH};
  `}
`;

const BottomInputsGrid = styled.div`
  ${({ theme }) => css`
    display: grid;
    gap: ${theme.sizeUnit * 3}px;
    grid-template-columns: repeat(2, 250px);
    width: fit-content;
  `}
`;

const TimeModeToggle = styled.button<{ $active: boolean }>`
  ${({ theme, $active }) => css`
    align-items: center;
    appearance: none;
    background: ${$active ? theme.colorPrimaryBg : 'transparent'};
    border: 1px solid ${$active ? theme.colorPrimary : theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${$active ? theme.colorPrimary : theme.colorTextSecondary};
    cursor: pointer;
    display: inline-flex;
    font-size: ${theme.fontSizeSM}px;
    font-weight: ${theme.fontWeightStrong};
    height: 32px;
    justify-content: center;
    justify-self: end;
    line-height: 20px;
    padding: 0;
    transition: all 0.2s ease;
    width: 32px;

    &:hover {
      border-color: ${theme.colorPrimary};
      color: ${theme.colorPrimary};
    }
  `}
`;

const QUICK_FRAME_OPTIONS: SelectOptionType[] = [
  { value: 'Common', label: t('\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u0439') },
  { value: 'Calendar', label: t('\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0439') },
  { value: 'Current', label: t('\u0422\u0435\u043a\u0443\u0449\u0438\u0439') },
];

const QUICK_RANGE_OPTIONS: Record<
  QuickFrameType,
  Array<{ value: string; label: string }>
> = {
  Common: [
    { value: 'Last day', label: t('\u0414\u0435\u043d\u044c') },
    { value: 'Last week', label: t('\u041d\u0435\u0434\u0435\u043b\u044f') },
    { value: 'Last month', label: t('\u041c\u0435\u0441\u044f\u0446') },
    { value: 'Last quarter', label: t('\u041a\u0432\u0430\u0440\u0442\u0430\u043b') },
    { value: 'Last year', label: t('\u0413\u043e\u0434') },
  ],
  Calendar: [
    { value: 'previous calendar week', label: t('\u041d\u0435\u0434\u0435\u043b\u044f') },
    { value: 'previous calendar month', label: t('\u041c\u0435\u0441\u044f\u0446') },
    { value: 'previous calendar quarter', label: t('\u041a\u0432\u0430\u0440\u0442\u0430\u043b') },
    { value: 'previous calendar year', label: t('\u0413\u043e\u0434') },
  ],
  Current: [
    { value: 'Current day', label: t('\u0414\u0435\u043d\u044c') },
    { value: 'Current week', label: t('\u041d\u0435\u0434\u0435\u043b\u044f') },
    { value: 'Current month', label: t('\u041c\u0435\u0441\u044f\u0446') },
    { value: 'Current quarter', label: t('\u041a\u0432\u0430\u0440\u0442\u0430\u043b') },
    { value: 'Current year', label: t('\u0413\u043e\u0434') },
  ],
};

const QUICK_FRAME_DEFAULT_VALUES: Record<QuickFrameType, string> = {
  Common: 'Last week',
  Calendar: 'previous calendar week',
  Current: 'Current week',
};

const MODE_LINKS: Record<
  CalendarMode,
  Array<{ mode: CalendarMode; label: string }>
> = {
  day: [
    { mode: 'month', label: '\u041c\u0435\u0441\u044f\u0446\u044b' },
    {
      mode: 'custom',
      label: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439',
    },
  ],
  month: [
    { mode: 'day', label: '\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c' },
    {
      mode: 'custom',
      label: '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439',
    },
  ],
  custom: [
    { mode: 'day', label: '\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c' },
    { mode: 'month', label: '\u041c\u0435\u0441\u044f\u0446\u044b' },
  ],
};

const INITIAL_CUSTOM_RANGE: CustomRangeType = {
  sinceMode: 'specific',
  sinceDatetime: extendedDayjs().startOf('day').format('YYYY-MM-DD[T]HH:mm:ss'),
  sinceGrain: 'day',
  sinceGrainValue: 7,
  untilMode: 'specific',
  untilDatetime: extendedDayjs()
    .startOf('day')
    .add(1, 'day')
    .format('YYYY-MM-DD[T]HH:mm:ss'),
  untilGrain: 'day',
  untilGrainValue: 0,
  anchorMode: 'now',
  anchorValue: 'now',
};

const getQuickFrame = (value: string): QuickFrameType => {
  if (QUICK_RANGE_OPTIONS.Common.some(option => option.value === value)) {
    return 'Common';
  }
  if (QUICK_RANGE_OPTIONS.Calendar.some(option => option.value === value)) {
    return 'Calendar';
  }
  if (QUICK_RANGE_OPTIONS.Current.some(option => option.value === value)) {
    return 'Current';
  }
  return 'Current';
};

const getQuickValue = (frame: QuickFrameType, value: string) =>
  QUICK_RANGE_OPTIONS[frame].some(option => option.value === value)
    ? value
    : null;

const startOfIsoWeek = (value: Dayjs) =>
  value.startOf('day').subtract((value.day() + 6) % 7, 'day');

const startOfQuarter = (value: Dayjs) =>
  value
    .startOf('year')
    .add(Math.floor(value.month() / 3) * 3, 'month')
    .startOf('month');

const resolveQuickRange = (
  value: string,
  today: Dayjs,
): { start: Dayjs; end: Dayjs; matchedFlag: boolean } => {
  const yesterday = today.subtract(1, 'day');

  switch (value) {
    case 'Last day':
      return { start: yesterday, end: yesterday, matchedFlag: true };
    case 'Last week':
      return {
        start: yesterday.subtract(6, 'day'),
        end: yesterday,
        matchedFlag: true,
      };
    case 'Last month':
      return {
        start: yesterday.subtract(1, 'month').add(1, 'day'),
        end: yesterday,
        matchedFlag: true,
      };
    case 'Last quarter':
      return {
        start: yesterday.subtract(3, 'month').add(1, 'day'),
        end: yesterday,
        matchedFlag: true,
      };
    case 'Last year':
      return {
        start: yesterday.subtract(1, 'year').add(1, 'day'),
        end: yesterday,
        matchedFlag: true,
      };
    case 'previous calendar week': {
      const currentWeekStart = startOfIsoWeek(today);
      const end = currentWeekStart.subtract(1, 'day');
      return {
        start: startOfIsoWeek(end),
        end,
        matchedFlag: true,
      };
    }
    case 'previous calendar month': {
      const currentMonthStart = today.startOf('month');
      const end = currentMonthStart.subtract(1, 'day');
      return {
        start: end.startOf('month'),
        end,
        matchedFlag: true,
      };
    }
    case 'previous calendar quarter': {
      const currentQuarterStart = startOfQuarter(today);
      const end = currentQuarterStart.subtract(1, 'day');
      return {
        start: startOfQuarter(end),
        end,
        matchedFlag: true,
      };
    }
    case 'previous calendar year': {
      const currentYearStart = today.startOf('year');
      const end = currentYearStart.subtract(1, 'day');
      return {
        start: end.startOf('year'),
        end,
        matchedFlag: true,
      };
    }
    case 'Current day':
      return { start: today, end: today, matchedFlag: true };
    case 'Current week':
      return {
        start: startOfIsoWeek(today),
        end: today,
        matchedFlag: true,
      };
    case 'Current month':
      return {
        start: today.startOf('month'),
        end: today,
        matchedFlag: true,
      };
    case 'Current quarter':
      return {
        start: startOfQuarter(today),
        end: today,
        matchedFlag: true,
      };
    case 'Current year':
      return {
        start: today.startOf('year'),
        end: today,
        matchedFlag: true,
      };
    default:
      return {
        start: today,
        end: today,
        matchedFlag: false,
      };
  }
};

const resolveConcreteRange = (
  value: string,
  today: Dayjs,
): { start: Dayjs; end: Dayjs; matchedFlag: boolean } => {
  const parsedRange = parseCalendarRange(value);
  if (parsedRange.matchedFlag) {
    return parsedRange;
  }
  return resolveQuickRange(value, today);
};

const getCalendarStartOffset = (month: Dayjs) => {
  const firstDayOfMonth = month.startOf('month');
  return (firstDayOfMonth.day() + 6) % 7;
};

const buildMonthDays = (month: Dayjs) => {
  const daysInMonth = month.daysInMonth();
  const startOffset = getCalendarStartOffset(month);
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  return Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - startOffset + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return null;
    }
    return month.date(dayNumber);
  });
};

const formatMonthTitleRu = (value: Dayjs) =>
  `${value.locale('ru').format('MMMM')} ${value.format('YYYY')}`
    .replace(/^./, match => match.toUpperCase());

const normalizeRange = (start: Dayjs, end: Dayjs) =>
  start.isAfter(end, 'day') ? [end, start] : [start, end];

const normalizeDateTimeRange = (start: Dayjs, end: Dayjs) =>
  start.isAfter(end) ? [end, start] : [start, end];

const formatInputDate = (value: Dayjs | null, includeTime = false) =>
  value ? value.format(includeTime ? DATE_TIME_INPUT_FORMAT : DATE_INPUT_FORMAT) : '';

const parseDateTimeParts = (
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Dayjs | null => {
  const candidate = extendedDayjs(
    `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(
      day,
    ).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
      minute,
    ).padStart(2, '0')}:${String(second).padStart(2, '0')}`,
  );

  if (
    !candidate.isValid() ||
    candidate.year() !== year ||
    candidate.month() !== month - 1 ||
    candidate.date() !== day ||
    candidate.hour() !== hour ||
    candidate.minute() !== minute ||
    candidate.second() !== second
  ) {
    return null;
  }

  return candidate;
};

const parseUserDateInput = (value: string): Dayjs | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const russianMatch = trimmed.match(
    /^(\d{1,2})[./](\d{1,2})[./](\d{2,4})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?$/,
  );
  if (russianMatch) {
    const day = Number(russianMatch[1]);
    const month = Number(russianMatch[2]);
    const year = Number(russianMatch[3]);
    const hour = russianMatch[4] ? Number(russianMatch[4]) : 0;
    const minute = russianMatch[5] ? Number(russianMatch[5]) : 0;
    const second = russianMatch[6] ? Number(russianMatch[6]) : 0;
    return parseDateTimeParts(
      year < 100 ? 2000 + year : year,
      month,
      day,
      hour,
      minute,
      second,
    );
  }

  const isoMatch = trimmed.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?$/,
  );
  if (isoMatch) {
    return parseDateTimeParts(
      Number(isoMatch[1]),
      Number(isoMatch[2]),
      Number(isoMatch[3]),
      isoMatch[4] ? Number(isoMatch[4]) : 0,
      isoMatch[5] ? Number(isoMatch[5]) : 0,
      isoMatch[6] ? Number(isoMatch[6]) : 0,
    );
  }

  const fallback = extendedDayjs(trimmed);
  return fallback.isValid() ? fallback : null;
};

const decodeSpecificDateTimeRange = (
  timeRange: string,
): SpecificDateTimeRangeValue => {
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

  const start = extendedDayjs(customRange.sinceDatetime);
  const end = extendedDayjs(customRange.untilDatetime);

  if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
    return {
      start: extendedDayjs().startOf('day'),
      end: extendedDayjs().startOf('day'),
      matchedFlag: false,
    };
  }

  return { start, end, matchedFlag: true };
};

const hasExplicitTime = (value: Dayjs) =>
  value.hour() !== 0 || value.minute() !== 0 || value.second() !== 0;

const sanitizeInputValue = (value: string, includeTime: boolean) =>
  value
    .replace(includeTime ? /[^0-9./\-: ]/g : /[^0-9./\-]/g, '')
    .slice(0, includeTime ? DATE_TIME_INPUT_LENGTH : DATE_INPUT_LENGTH);

const encodeSpecificDateTimeRange = (start: Dayjs, end: Dayjs) =>
  customTimeRangeEncode({
    ...INITIAL_CUSTOM_RANGE,
    sinceMode: 'specific',
    sinceDatetime: start.format(DAYJS_FORMAT),
    untilMode: 'specific',
    untilDatetime: end.format(DAYJS_FORMAT),
  });

const resolveInitialMode = (value: string): CalendarMode => {
  const isCalendarRange = parseCalendarRange(value).matchedFlag;
  const isSpecificDateTimeRange = decodeSpecificDateTimeRange(value).matchedFlag;
  const isCustomRange = customTimeRangeDecode(value).matchedFlag;

  if (!isCalendarRange && !isSpecificDateTimeRange && isCustomRange) {
    return 'custom';
  }
  return 'day';
};

const buildMonthSelectionValue = (start: Dayjs, end: Dayjs) =>
  encodeCalendarRange(start.startOf('month'), end.endOf('month').startOf('day'));

export function CalendarRangeFrame(props: FrameComponentProps) {
  const datePickerLocale = useLocale();
  const today = useMemo(() => extendedDayjs().startOf('day'), []);
  const moscowToday = useMemo(
    () => extendedDayjs().tz(MOSCOW_TIMEZONE).startOf('day'),
    [],
  );
  const concreteRange = useMemo(
    () => resolveConcreteRange(props.value, today),
    [props.value, today],
  );
  const specificDateTimeRange = useMemo(
    () => decodeSpecificDateTimeRange(props.value),
    [props.value],
  );
  const decodedCustomRange = useMemo(
    () => customTimeRangeDecode(props.value),
    [props.value],
  );
  const [mode, setMode] = useState<CalendarMode>(() => resolveInitialMode(props.value));
  const [quickFrame, setQuickFrame] = useState<QuickFrameType>(() =>
    getQuickFrame(props.value),
  );
  const [rangeStart, setRangeStart] = useState<Dayjs | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Dayjs | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [leftMonth, setLeftMonth] = useState(
    today.startOf('month').subtract(1, 'month'),
  );
  const [leftYear, setLeftYear] = useState(today.year());
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [showTimeInputs, setShowTimeInputs] = useState(false);

  useEffect(() => {
    setQuickFrame(getQuickFrame(props.value));
  }, [props.value]);

  useEffect(() => {
    if (
      !concreteRange.matchedFlag &&
      !specificDateTimeRange.matchedFlag &&
      decodedCustomRange.matchedFlag
    ) {
      setMode('custom');
    }
  }, [
    concreteRange.matchedFlag,
    decodedCustomRange.matchedFlag,
    specificDateTimeRange.matchedFlag,
  ]);

  useEffect(() => {
    const hasTimeInValue =
      specificDateTimeRange.matchedFlag &&
      (showTimeInputs ||
        hasExplicitTime(specificDateTimeRange.start) ||
        hasExplicitTime(specificDateTimeRange.end));

    if (
      isSelectingEnd &&
      rangeStart &&
      concreteRange.matchedFlag &&
      ((mode === 'day' &&
        concreteRange.start.isSame(rangeStart, 'day') &&
        concreteRange.end.isSame(rangeStart, 'day')) ||
        (mode === 'month' &&
          concreteRange.start.isSame(rangeStart.startOf('month'), 'month') &&
          concreteRange.end.isSame(
            rangeStart.endOf('month').startOf('day'),
            'day',
          )))
    ) {
      return;
    }

    if (concreteRange.matchedFlag) {
      setRangeStart(concreteRange.start);
      setRangeEnd(concreteRange.end);
      setIsSelectingEnd(false);
      setLeftMonth(concreteRange.end.startOf('month').subtract(1, 'month'));
      setLeftYear(concreteRange.start.year());
      setShowTimeInputs(hasTimeInValue);
      setStartInput(
        formatInputDate(
          hasTimeInValue ? specificDateTimeRange.start : concreteRange.start,
          hasTimeInValue,
        ),
      );
      setEndInput(
        formatInputDate(
          hasTimeInValue ? specificDateTimeRange.end : concreteRange.end,
          hasTimeInValue,
        ),
      );
    } else {
      setRangeStart(null);
      setRangeEnd(null);
      setIsSelectingEnd(false);
      setLeftMonth(today.startOf('month').subtract(1, 'month'));
      setLeftYear(today.year());
      setStartInput('');
      setEndInput('');
      setShowTimeInputs(false);
    }
  }, [
    concreteRange,
    isSelectingEnd,
    mode,
    rangeStart,
    showTimeInputs,
    specificDateTimeRange,
    today,
  ]);

  const weekdays = useMemo(() => WEEKDAY_LABELS_RU, []);

  const visibleMonths = [leftMonth, leftMonth.add(1, 'month')];
  const visibleYears = [leftYear, leftYear + 1];
  const selectedQuickValue = getQuickValue(quickFrame, props.value);

  const onPreviousClick = () => {
    if (mode === 'month') {
      setLeftYear(leftYear - 1);
    } else {
      setLeftMonth(leftMonth.subtract(1, 'month'));
    }
  };

  const onNextClick = () => {
    if (mode === 'month') {
      setLeftYear(leftYear + 1);
    } else {
      setLeftMonth(leftMonth.add(1, 'month'));
    }
  };

  const applyParsedDates = (nextStartText: string, nextEndText: string) => {
    const parsedStartValue = parseUserDateInput(nextStartText) ?? rangeStart;
    const parsedEndValue = parseUserDateInput(nextEndText) ?? rangeEnd;

    if (!parsedStartValue || !parsedEndValue) {
      return;
    }

    const [start, end] = showTimeInputs
      ? normalizeDateTimeRange(parsedStartValue, parsedEndValue)
      : normalizeRange(parsedStartValue, parsedEndValue);
    setMode('day');
    props.onChange(
      showTimeInputs
        ? encodeSpecificDateTimeRange(start, end)
        : encodeCalendarRange(start, end),
    );
  };

  const onInputChange =
    (inputType: 'start' | 'end') =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = sanitizeInputValue(event.target.value, showTimeInputs);

      if (inputType === 'start') {
        setStartInput(nextValue);
      } else {
        setEndInput(nextValue);
      }
    };

  const onToggleTimeInputs = () => {
    const nextShowTimeInputs = !showTimeInputs;
    const parsedStartValue = parseUserDateInput(startInput) ?? rangeStart;
    const parsedEndValue = parseUserDateInput(endInput) ?? rangeEnd;

    setShowTimeInputs(nextShowTimeInputs);

    if (!parsedStartValue || !parsedEndValue) {
      setStartInput(sanitizeInputValue(startInput, nextShowTimeInputs));
      setEndInput(sanitizeInputValue(endInput, nextShowTimeInputs));
      return;
    }

    const [start, end] = nextShowTimeInputs
      ? normalizeDateTimeRange(parsedStartValue, parsedEndValue)
      : normalizeRange(parsedStartValue, parsedEndValue);

    setMode('day');
    setStartInput(formatInputDate(start, nextShowTimeInputs));
    setEndInput(formatInputDate(end, nextShowTimeInputs));
    props.onChange(
      nextShowTimeInputs
        ? encodeSpecificDateTimeRange(start, end)
        : encodeCalendarRange(start, end),
    );
  };

  const onInputKeyDown =
    (nextStartText: string, nextEndText: string) =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        applyParsedDates(nextStartText, nextEndText);
      }
    };

  const onSelectDay = (day: Dayjs) => {
    if (!rangeStart || (!isSelectingEnd && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      setIsSelectingEnd(true);
      props.onChange(
        showTimeInputs
          ? encodeSpecificDateTimeRange(day.startOf('day'), day.startOf('day'))
          : encodeCalendarRange(day, day),
      );
      return;
    }

    const [start, end] = normalizeRange(rangeStart, day);
    setRangeStart(start);
    setRangeEnd(end);
    setIsSelectingEnd(false);
    props.onChange(
      showTimeInputs
        ? encodeSpecificDateTimeRange(start.startOf('day'), end.startOf('day'))
        : encodeCalendarRange(start, end),
    );
  };

  const onSelectMonth = (month: Dayjs) => {
    if (!rangeStart || (!isSelectingEnd && rangeEnd)) {
      const monthStart = month.startOf('month');
      setRangeStart(monthStart);
      setRangeEnd(null);
      setIsSelectingEnd(true);
      props.onChange(
        showTimeInputs
          ? encodeSpecificDateTimeRange(
              monthStart.startOf('day'),
              monthStart.endOf('month').startOf('day'),
            )
          : buildMonthSelectionValue(monthStart, monthStart),
      );
      return;
    }

    const [startMonth, endMonth] = normalizeRange(
      rangeStart.startOf('month'),
      month.startOf('month'),
    );
    setRangeStart(startMonth);
    setRangeEnd(endMonth.endOf('month').startOf('day'));
    setIsSelectingEnd(false);
    props.onChange(
      showTimeInputs
        ? encodeSpecificDateTimeRange(
            startMonth.startOf('day'),
            endMonth.endOf('month').startOf('day'),
          )
        : buildMonthSelectionValue(startMonth, endMonth),
    );
  };

  const onQuickFrameChange = (value: string) => {
    const nextFrame = value as QuickFrameType;
    setQuickFrame(nextFrame);
    setMode('day');
    props.onChange(QUICK_FRAME_DEFAULT_VALUES[nextFrame]);
  };

  const onQuickOptionClick = (value: string) => {
    setMode('day');
    props.onChange(value);
  };

  const onOpenCustomMode = () => {
    setMode('custom');

    if (!decodedCustomRange.matchedFlag) {
      props.onChange(customTimeRangeEncode(INITIAL_CUSTOM_RANGE));
    }
  };

  if (datePickerLocale === null) {
    return <Loading position="inline-centered" />;
  }

  return (
    <Wrapper data-test={DateFilterTestKey.CalendarV2Frame}>
      <Header $mode={mode}>
        <NavButton
          buttonStyle="link"
          $hidden
        >
          <Icons.CaretLeftOutlined />
        </NavButton>
        <HeaderCenter>
          {MODE_LINKS[mode].map(option => (
            <ModeButton
              key={option.mode}
              buttonStyle="link"
              onClick={() => {
                if (option.mode === 'custom') {
                  onOpenCustomMode();
                } else {
                  setMode(option.mode);
                }
              }}
            >
              {t(option.label)}
            </ModeButton>
          ))}
        </HeaderCenter>
        <NavButton
          buttonStyle="link"
          $hidden
        >
          <Icons.CaretLeftOutlined
            css={css`
              transform: rotate(180deg);
            `}
          />
        </NavButton>
        <HeaderActions>
          <HeaderActionButton
            buttonStyle="link"
            onClick={() => setShowSidePanel(current => !current)}
          >
            {showSidePanel
              ? t('\u0421\u043a\u0440\u044b\u0442\u044c \u0411\u044b\u0441\u0442\u0440\u044b\u0435')
              : t('\u0411\u044b\u0441\u0442\u0440\u044b\u0435')}
          </HeaderActionButton>
        </HeaderActions>
      </Header>
      <CalendarLayout>
        <CalendarContent>
          {mode === 'day' && (
            <>
              <MonthsHeaderRow $mode="day">
                <NavButton buttonStyle="link" onClick={onPreviousClick}>
                  <Icons.CaretLeftOutlined />
                </NavButton>
                {visibleMonths.map(month => (
                  <MonthTitle key={`title-${month.format('YYYY-MM')}`}>
                    {formatMonthTitleRu(month)}
                  </MonthTitle>
                ))}
                <NavButton buttonStyle="link" onClick={onNextClick}>
                  <Icons.CaretLeftOutlined
                    css={css`
                      transform: rotate(180deg);
                    `}
                  />
                </NavButton>
              </MonthsHeaderRow>
              <MonthsGrid>
                {visibleMonths.map(month => (
                  <MonthSection key={month.format('YYYY-MM')}>
                    <WeekdaysGrid>
                      {weekdays.map(weekday => (
                        <Weekday key={`${month.format('YYYY-MM')}-${weekday}`}>
                          {weekday}
                        </Weekday>
                      ))}
                    </WeekdaysGrid>
                    <DaysGrid>
                      {buildMonthDays(month).map((day, index) => {
                        if (!day) {
                          return (
                            <EmptyDayCell
                              key={`${month.format('YYYY-MM')}-empty-${index}`}
                            />
                          );
                        }

                        const selected =
                          (!!rangeStart && day.isSame(rangeStart, 'day')) ||
                          (!!rangeEnd && day.isSame(rangeEnd, 'day'));
                        const inRange =
                          !!rangeStart &&
                          !!rangeEnd &&
                          day.isAfter(rangeStart, 'day') &&
                          day.isBefore(rangeEnd, 'day');
                        const isToday = day.isSame(moscowToday, 'day');

                        return (
                          <DayCell
                            key={day.format('YYYY-MM-DD')}
                            type="button"
                            selected={selected}
                            inRange={inRange}
                            rangeStart={
                              !!rangeStart && day.isSame(rangeStart, 'day')
                            }
                            rangeEnd={!!rangeEnd && day.isSame(rangeEnd, 'day')}
                            weekend={day.day() === 0 || day.day() === 6}
                            today={isToday}
                            onClick={() => onSelectDay(day)}
                          >
                            {day.date()}
                          </DayCell>
                        );
                      })}
                    </DaysGrid>
                  </MonthSection>
                ))}
              </MonthsGrid>
            </>
          )}
          {mode === 'month' && (
            <>
              <MonthsHeaderRow $mode="month">
                <NavButton buttonStyle="link" onClick={onPreviousClick}>
                  <Icons.CaretLeftOutlined />
                </NavButton>
                {visibleYears.map(year => (
                  <MonthTitle key={`title-${year}`}>{String(year)}</MonthTitle>
                ))}
                <NavButton buttonStyle="link" onClick={onNextClick}>
                  <Icons.CaretLeftOutlined
                    css={css`
                      transform: rotate(180deg);
                    `}
                  />
                </NavButton>
              </MonthsHeaderRow>
              <MonthsGrid>
                {visibleYears.map(year => (
                  <MonthSection key={year}>
                    <MonthsOfYearGrid>
                      {Array.from({ length: 12 }, (_, index) =>
                        extendedDayjs().year(year).month(index).startOf('month'),
                      ).map(month => {
                        const monthSelected =
                          (!!rangeStart &&
                            month.isSame(rangeStart.startOf('month'), 'month')) ||
                          (!!rangeEnd &&
                            month.isSame(rangeEnd.startOf('month'), 'month'));
                        const monthInRange =
                          !!rangeStart &&
                          !!rangeEnd &&
                          month.isAfter(rangeStart.startOf('month'), 'month') &&
                          month.isBefore(rangeEnd.startOf('month'), 'month');

                        return (
                          <MonthValueCell
                            key={month.format('YYYY-MM')}
                            type="button"
                            selected={monthSelected}
                            inRange={monthInRange}
                            rangeStart={
                              !!rangeStart &&
                              month.isSame(rangeStart.startOf('month'), 'month')
                            }
                            rangeEnd={
                              !!rangeEnd &&
                              month.isSame(rangeEnd.startOf('month'), 'month')
                            }
                            onClick={() => onSelectMonth(month)}
                          >
                            {MONTH_LABELS_SHORT_RU[month.month()]}
                          </MonthValueCell>
                        );
                      })}
                    </MonthsOfYearGrid>
                  </MonthSection>
                ))}
              </MonthsGrid>
            </>
          )}
          {mode === 'custom' && (
            <CustomFrame
              value={props.value}
              onChange={props.onChange}
              isOverflowingFilterBar={props.isOverflowingFilterBar}
            />
          )}
          {mode !== 'custom' && (
            <BottomInputsRow $mode={mode}>
              <BottomInputsGrid>
                <Input
                  value={startInput}
                  maxLength={
                    showTimeInputs ? DATE_TIME_INPUT_LENGTH : DATE_INPUT_LENGTH
                  }
                  placeholder={t('\u0414\u0430\u0442\u0430 \u043d\u0430\u0447\u0430\u043b\u0430')}
                  onChange={onInputChange('start')}
                  onBlur={() => applyParsedDates(startInput, endInput)}
                  onKeyDown={onInputKeyDown(startInput, endInput)}
                />
                <Input
                  value={endInput}
                  maxLength={
                    showTimeInputs ? DATE_TIME_INPUT_LENGTH : DATE_INPUT_LENGTH
                  }
                  placeholder={t('\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f')}
                  onChange={onInputChange('end')}
                  onBlur={() => applyParsedDates(startInput, endInput)}
                  onKeyDown={onInputKeyDown(startInput, endInput)}
                />
              </BottomInputsGrid>
              <TimeModeToggle
                type="button"
                $active={showTimeInputs}
                aria-pressed={showTimeInputs}
                aria-label={t('\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0440\u0435\u0436\u0438\u043c \u0432\u0440\u0435\u043c\u0435\u043d\u0438')}
                onClick={onToggleTimeInputs}
              >
                {t('\u0412')}
              </TimeModeToggle>
            </BottomInputsRow>
          )}
        </CalendarContent>
        {showSidePanel && (
          <QuickPanel>
            <QuickPanelContent>
              <QuickPanelSection>
                <QuickPanelLabel>{t('\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b')}</QuickPanelLabel>
                <QuickPanelSelect
                  ariaLabel={t('\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b')}
                  options={QUICK_FRAME_OPTIONS}
                  value={quickFrame}
                  onChange={onQuickFrameChange}
                />
              </QuickPanelSection>
              <QuickPanelDivider />
              <QuickOptions>
                {QUICK_RANGE_OPTIONS[quickFrame].map(option => (
                  <QuickOptionButton
                    key={option.value}
                    type="button"
                    selected={option.value === selectedQuickValue}
                    onClick={() => onQuickOptionClick(option.value)}
                  >
                    {option.label}
                  </QuickOptionButton>
                ))}
              </QuickOptions>
            </QuickPanelContent>
          </QuickPanel>
        )}
      </CalendarLayout>
    </Wrapper>
  );
}
