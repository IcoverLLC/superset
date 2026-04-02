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
import { Button, Loading, Select } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { Dayjs } from 'dayjs';
import { useLocale } from 'src/hooks/useLocale';
import {
  DateFilterTestKey,
} from '../utils';
import { FrameComponentProps, SelectOptionType } from '../types';
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
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
`;

const NavButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
`;

const HeaderTitle = styled.div`
  justify-self: center;
`;

const HeaderActions = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const PanelToggleButton = styled(Button)`
  padding: 0;
  min-width: auto;
  height: auto;
`;

const CalendarLayout = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: flex-start;
    gap: ${theme.sizeUnit * 5}px;
    width: fit-content;
  `}
`;

const CalendarContent = styled.div`
  width: fit-content;
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
    height: 32px;
    justify-content: center;
    line-height: 20px;
    padding: 0;
    width: 34px;

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
  height: 32px;
  width: 34px;
`;

const SidePanel = styled.aside`
  ${({ theme }) => css`
    border-left: 1px solid ${theme.colorBorder};
    min-height: 100%;
    padding-left: ${theme.sizeUnit * 3}px;
    width: 196px;
  `}
`;

const SidePanelLabel = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    line-height: 20px;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

const SidePanelSelect = styled(Select)`
  width: 100%;
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

type QuickFrameType = 'Common' | 'Calendar' | 'Current';

const QUICK_FRAME_OPTIONS: SelectOptionType[] = [
  { value: 'Common', label: t('Last') },
  { value: 'Calendar', label: t('Previous') },
  { value: 'Current', label: t('Current') },
];

const QUICK_RANGE_OPTIONS: Record<
  QuickFrameType,
  Array<{ value: string; label: string }>
> = {
  Common: [
    { value: 'Last day', label: t('Day') },
    { value: 'Last week', label: t('Week') },
    { value: 'Last month', label: t('Month') },
    { value: 'Last quarter', label: t('Quarter') },
    { value: 'Last year', label: t('Year') },
  ],
  Calendar: [
    { value: 'previous calendar week', label: t('Week') },
    { value: 'previous calendar month', label: t('Month') },
    { value: 'previous calendar quarter', label: t('Quarter') },
    { value: 'previous calendar year', label: t('Year') },
  ],
  Current: [
    { value: 'Current day', label: t('Day') },
    { value: 'Current week', label: t('Week') },
    { value: 'Current month', label: t('Month') },
    { value: 'Current quarter', label: t('Quarter') },
    { value: 'Current year', label: t('Year') },
  ],
};

const QUICK_FRAME_DEFAULT_VALUES: Record<QuickFrameType, string> = {
  Common: 'Last week',
  Calendar: 'previous calendar week',
  Current: 'Current week',
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

  useEffect(() => {
    setQuickFrame(getQuickFrame(props.value));
  }, [props.value]);

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
  const selectedQuickValue = getQuickValue(quickFrame, props.value);

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

  const onQuickFrameChange = (value: string) => {
    const nextFrame = value as QuickFrameType;
    setQuickFrame(nextFrame);
    props.onChange(QUICK_FRAME_DEFAULT_VALUES[nextFrame]);
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
        <HeaderTitle className="section-title">
          {t('\u041a\u0430\u043b\u0435\u043d\u0434\u0430\u0440\u044c')}
        </HeaderTitle>
        <HeaderActions>
          <PanelToggleButton
            buttonStyle="link"
            onClick={() => setShowSidePanel(current => !current)}
          >
            {showSidePanel
              ? t('\u0421\u043a\u0440\u044b\u0442\u044c \u0411\u044b\u0441\u0442\u0440\u044b\u0435')
              : t('\u0411\u044b\u0441\u0442\u0440\u044b\u0435')}
          </PanelToggleButton>
          <NavButton
            buttonStyle="link"
            onClick={() => setLeftMonth(leftMonth.add(1, 'month'))}
          >
            <Icons.RightOutlined />
          </NavButton>
        </HeaderActions>
      </Header>
      <CalendarLayout>
        <CalendarContent>
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
        </CalendarContent>
        {showSidePanel && (
          <SidePanel>
            <SidePanelLabel>{t('Range type')}</SidePanelLabel>
            <SidePanelSelect
              ariaLabel={t('Range type')}
              options={QUICK_FRAME_OPTIONS}
              value={quickFrame}
              onChange={onQuickFrameChange}
            />
            <QuickOptions>
              {QUICK_RANGE_OPTIONS[quickFrame].map(option => (
                <QuickOptionButton
                  key={option.value}
                  type="button"
                  selected={option.value === selectedQuickValue}
                  onClick={() => props.onChange(option.value)}
                >
                  {option.label}
                </QuickOptionButton>
              ))}
            </QuickOptions>
          </SidePanel>
        )}
      </CalendarLayout>
    </Wrapper>
  );
}
