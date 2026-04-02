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
import { useEffect, useMemo, useState } from 'react';
import { css, styled, t } from '@superset-ui/core';
import { Button, Loading } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Dayjs } from 'dayjs';
import { useLocale } from 'src/hooks/useLocale';
import { DateFilterTestKey } from '../utils';
import { FrameComponentProps } from '../types';
import {
  encodeCalendarRange,
  parseCalendarRange,
} from '../utils/dateFilterUtils';

const Wrapper = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 4}px;
  `}
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const NavButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
`;

const MonthsGrid = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const MonthSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const MonthTitle = styled.div`
  ${({ theme }) => css`
    font-size: 15px;
    font-weight: ${theme.fontWeightStrong};
    line-height: 24px;
    margin-bottom: ${theme.sizeUnit * 2}px;
    text-align: center;
  `}
`;

const WeekdaysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 24px);
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
  grid-template-columns: repeat(7, 24px);
  justify-content: center;
  gap: 1px;
`;

const getDayBorderRadius = (
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
  muted: boolean;
  selected: boolean;
  inRange: boolean;
  rangeStart: boolean;
  rangeEnd: boolean;
  weekend: boolean;
}>`
  ${({ theme, muted, selected, inRange, rangeStart, rangeEnd, weekend }) => css`
    align-items: center;
    appearance: none;
    background: ${selected
      ? theme.colorPrimary
      : inRange
        ? theme.colorFillSecondary
        : 'transparent'};
    border: 0;
    border-radius: ${getDayBorderRadius(
      theme.borderRadius,
      selected,
      inRange,
      rangeStart,
      rangeEnd,
    )};
    color: ${selected
      ? theme.colorWhite
      : muted
        ? theme.colorTextDisabled
        : weekend
          ? theme.colorError
          : theme.colorText};
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    height: 28px;
    justify-content: center;
    line-height: 20px;
    padding: 0;
    width: 24px;

    &:hover {
      background: ${selected
        ? theme.colorPrimaryHover
        : inRange
          ? theme.colorFill
          : theme.colorFillTertiary};
    }
  `}
`;

const EmptyDayCell = styled.div`
  height: 28px;
  width: 24px;
`;

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

const capitalize = (value: string) =>
  value.length ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const normalizeRange = (start: Dayjs, end: Dayjs) =>
  start.isAfter(end, 'day') ? [end, start] : [start, end];

export function CalendarRangeFrame(props: FrameComponentProps) {
  const datePickerLocale = useLocale();
  const today = useMemo(() => extendedDayjs().startOf('day'), []);
  const parsedRange = useMemo(() => parseCalendarRange(props.value), [props.value]);
  const [rangeStart, setRangeStart] = useState<Dayjs | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Dayjs | null>(null);
  const [isSelectingEnd, setIsSelectingEnd] = useState(false);
  const [leftMonth, setLeftMonth] = useState(
    today.startOf('month').subtract(1, 'month'),
  );

  useEffect(() => {
    if (
      isSelectingEnd &&
      rangeStart &&
      parsedRange.matchedFlag &&
      parsedRange.start.isSame(rangeStart, 'day') &&
      parsedRange.end.isSame(rangeStart, 'day')
    ) {
      return;
    }

    if (parsedRange.matchedFlag) {
      setRangeStart(parsedRange.start);
      setRangeEnd(parsedRange.end);
      setIsSelectingEnd(false);
      setLeftMonth(parsedRange.end.startOf('month').subtract(1, 'month'));
    } else {
      setRangeStart(null);
      setRangeEnd(null);
      setIsSelectingEnd(false);
      setLeftMonth(today.startOf('month').subtract(1, 'month'));
    }
  }, [isSelectingEnd, parsedRange, rangeStart, today]);

  const weekdays = useMemo(() => {
    const monday = extendedDayjs('2024-01-01');
    return Array.from({ length: 7 }, (_, index) =>
      monday.add(index, 'day').format('dd'),
    );
  }, [datePickerLocale]);

  const rightMonth = leftMonth.add(1, 'month');
  const months = [leftMonth, rightMonth];

  const onSelectDay = (day: Dayjs) => {
    if (!rangeStart || (!isSelectingEnd && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
      setIsSelectingEnd(true);
      props.onChange(encodeCalendarRange(day, day));
      return;
    }

    const [start, end] = normalizeRange(rangeStart, day);
    setRangeStart(start);
    setRangeEnd(end);
    setIsSelectingEnd(false);
    props.onChange(encodeCalendarRange(start, end));
  };

  if (datePickerLocale === null) {
    return <Loading position="inline-centered" />;
  }

  return (
    <Wrapper data-test={DateFilterTestKey.CalendarV2Frame}>
      <Header>
        <NavButton
          buttonStyle="link"
          onClick={() => setLeftMonth(leftMonth.subtract(1, 'month'))}
        >
          <Icons.CaretLeftOutlined />
        </NavButton>
        <div className="section-title">{t('Calendar')}</div>
        <NavButton
          buttonStyle="link"
          onClick={() => setLeftMonth(leftMonth.add(1, 'month'))}
        >
          <Icons.RightOutlined />
        </NavButton>
      </Header>
      <MonthsGrid>
        {months.map(month => (
          <MonthSection key={month.format('YYYY-MM')}>
            <MonthTitle>{capitalize(month.format('MMMM YYYY'))}</MonthTitle>
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

                return (
                  <DayCell
                    key={day.format('YYYY-MM-DD')}
                    type="button"
                    muted={false}
                    selected={selected}
                    inRange={inRange}
                    rangeStart={!!rangeStart && day.isSame(rangeStart, 'day')}
                    rangeEnd={!!rangeEnd && day.isSame(rangeEnd, 'day')}
                    weekend={day.day() === 0 || day.day() === 6}
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
    </Wrapper>
  );
}
