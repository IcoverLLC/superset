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
import { ReactNode, useState, useEffect, useMemo } from 'react';
import {
  css,
  styled,
  t,
  useTheme,
  NO_TIME_RANGE,
  SupersetTheme,
  useCSSTextTruncation,
  fetchTimeRange,
} from '@superset-ui/core';
import {
  Button,
  Constants,
  Divider,
  Tooltip,
  Select,
} from '@superset-ui/core/components';
import ControlHeader from 'src/explore/components/ControlHeader';
import { Icons } from '@superset-ui/core/components/Icons';
import { useDebouncedEffect } from 'src/explore/exploreUtils';
import { noOp } from 'src/utils/common';
import ControlPopover from '../ControlPopover/ControlPopover';

import { DateFilterControlProps, FrameType } from './types';
import {
  DateFilterTestKey,
  FRAME_OPTIONS,
  guessFrame,
  useDefaultTimeFilter,
} from './utils';
import {
  CommonFrame,
  CalendarFrame,
  CalendarRangeFrame,
  CustomFrame,
  AdvancedFrame,
  DateLabel,
} from './components';
import { CurrentCalendarFrame } from './components/CurrentCalendarFrame';
import {
  formatCalendarRangeLabel,
  formatActualRangeForTooltip,
  getDefaultV2CalendarRangeValue,
  normalizeTimeRangeForCalendarFormat,
  parseCalendarRange,
} from './utils/dateFilterUtils';

const StyledRangeType = styled(Select)`
  width: 272px;
`;

const ContentStyleWrapper = styled.div<{ $variant?: 'default' | 'v2' }>`
  ${({ theme, $variant }) => css`
    .ant-row {
      margin-top: 8px;
    }

    .ant-picker {
      padding: 4px 17px 4px;
      border-radius: 4px;
    }

    .ant-divider-horizontal {
      margin: ${$variant === 'v2' ? '12px 0' : '16px 0'};
    }

    .control-label {
      font-size: ${theme.fontSizeSM}px;
      line-height: 16px;
      margin: 8px 0;
    }

    .section-title {
      font-style: normal;
      font-weight: ${theme.fontWeightStrong};
      font-size: 15px;
      line-height: 24px;
      margin-bottom: 8px;
    }

    .control-anchor-to {
      margin-top: 16px;
    }

    .control-anchor-to-datetime {
      width: 217px;
    }

    .footer {
      margin-bottom: ${$variant === 'v2' ? '-4px' : 0};
      margin-top: ${$variant === 'v2' ? '-2px' : 0};
      text-align: right;
    }

    .selected-range {
      display: flex;
      align-items: flex-start;
      gap: ${theme.sizeUnit}px;
    }

    .selected-range-label {
      font-style: normal;
      font-weight: ${theme.fontWeightStrong};
      font-size: 15px;
      line-height: 24px;
      white-space: nowrap;
    }

    .selected-range-value {
      font-size: 15px;
      line-height: 24px;
      word-break: break-word;
    }
  `}
`;

const IconWrapper = styled.span`
  span {
    margin-right: ${({ theme }) => 2 * theme.sizeUnit}px;
    vertical-align: middle;
  }
  .text {
    vertical-align: middle;
  }
  .error {
    color: ${({ theme }) => theme.colorError};
  }
`;

const getTooltipTitle = (
  isLabelTruncated: boolean,
  label: string | undefined,
  range: string | undefined,
) =>
  isLabelTruncated ? (
    <div>
      {label && <strong>{label}</strong>}
      {range && (
        <div
          css={(theme: SupersetTheme) => css`
            margin-top: ${theme.sizeUnit}px;
          `}
        >
          {range}
        </div>
      )}
    </div>
  ) : (
    range || null
  );

export default function DateFilterLabel(props: DateFilterControlProps) {
  const {
    name,
    onChange,
    onOpenPopover = noOp,
    onClosePopover = noOp,
    isOverflowingFilterBar = false,
    variant = 'default',
    calendarFormat = 'standard',
  } = props;
  const defaultTimeFilter = useDefaultTimeFilter();

  const value = normalizeTimeRangeForCalendarFormat(
    props.value ?? defaultTimeFilter,
    calendarFormat,
  );
  const [actualTimeRange, setActualTimeRange] = useState<string>(value);

  const [show, setShow] = useState<boolean>(false);
  const guessedFrame = useMemo(
    () => guessFrame(value, variant),
    [value, variant],
  );
  const [frame, setFrame] = useState<FrameType>(guessedFrame);
  const [lastFetchedTimeRange, setLastFetchedTimeRange] = useState(value);
  const [timeRangeValue, setTimeRangeValue] = useState(value);
  const [validTimeRange, setValidTimeRange] = useState<boolean>(false);
  const [evalResponse, setEvalResponse] = useState<string>(value);
  const [tooltipTitle, setTooltipTitle] = useState<ReactNode | null>(value);
  const theme = useTheme();
  const [labelRef, labelIsTruncated] = useCSSTextTruncation<HTMLSpanElement>();

  useEffect(() => {
    if (value === NO_TIME_RANGE) {
      setActualTimeRange(NO_TIME_RANGE);
      setTooltipTitle(null);
      setValidTimeRange(true);
      return;
    }
    fetchTimeRange(value).then(({ value: actualRange, error }) => {
      if (error) {
        setEvalResponse(error || '');
        setValidTimeRange(false);
        setTooltipTitle(value || null);
      } else {
        const tooltipRange =
          variant === 'v2' ? formatActualRangeForTooltip(actualRange) : actualRange;
        /*
          HRT == human readable text
          ADR == actual datetime range
          +--------------+------+----------+--------+----------+-----------+
          |              | Last | Previous | Custom | Advanced | No Filter |
          +--------------+------+----------+--------+----------+-----------+
          | control pill | HRT  | HRT      | ADR    | ADR      |   HRT     |
          +--------------+------+----------+--------+----------+-----------+
          | tooltip      | ADR  | ADR      | HRT    | HRT      |   ADR     |
          +--------------+------+----------+--------+----------+-----------+
        */
        const calendarRange =
          variant === 'v2' ? parseCalendarRange(value) : undefined;
        if (calendarRange?.matchedFlag) {
          const formattedRange = formatCalendarRangeLabel(
            calendarRange.start,
            calendarRange.end,
          );
          setActualTimeRange(formattedRange);
          setTooltipTitle(
            getTooltipTitle(labelIsTruncated, formattedRange, tooltipRange),
          );
        } else if (
          guessedFrame === 'Common' ||
          guessedFrame === 'Calendar' ||
          guessedFrame === 'Current' ||
          guessedFrame === 'No filter'
        ) {
          setActualTimeRange(value);
          setTooltipTitle(
            getTooltipTitle(labelIsTruncated, value, tooltipRange),
          );
        } else {
          setActualTimeRange(actualRange || '');
          setTooltipTitle(
            getTooltipTitle(labelIsTruncated, tooltipRange, value),
          );
        }
        setValidTimeRange(true);
      }
      setLastFetchedTimeRange(value);
      setEvalResponse(actualRange || value);
    });
  }, [guessedFrame, labelIsTruncated, labelRef, value, variant]);

  useDebouncedEffect(
    () => {
      if (timeRangeValue === NO_TIME_RANGE) {
        setEvalResponse(NO_TIME_RANGE);
        setLastFetchedTimeRange(NO_TIME_RANGE);
        setValidTimeRange(true);
        return;
      }
      if (lastFetchedTimeRange !== timeRangeValue) {
        fetchTimeRange(timeRangeValue).then(({ value: actualRange, error }) => {
          if (error) {
            setEvalResponse(error || '');
            setValidTimeRange(false);
          } else {
            setEvalResponse(actualRange || '');
            setValidTimeRange(true);
          }
          setLastFetchedTimeRange(timeRangeValue);
        });
      }
    },
    Constants.SLOW_DEBOUNCE,
    [timeRangeValue],
  );

  function onSave() {
    onChange(
      normalizeTimeRangeForCalendarFormat(timeRangeValue, calendarFormat),
    );
    setShow(false);
    onClosePopover();
  }

  function onOpen() {
    setTimeRangeValue(
      variant === 'v2' && value === NO_TIME_RANGE
        ? getDefaultV2CalendarRangeValue(calendarFormat)
        : value,
    );
    setFrame(guessedFrame);
    setShow(true);
    onOpenPopover();
  }

  function onHide() {
    setTimeRangeValue(value);
    setFrame(guessedFrame);
    setShow(false);
    onClosePopover();
  }

  const toggleOverlay = () => {
    if (show) {
      onHide();
    } else {
      onOpen();
    }
  };

  function onChangeFrame(value: FrameType) {
    if (value === NO_TIME_RANGE) {
      setTimeRangeValue(NO_TIME_RANGE);
    } else if (value === 'CalendarV2' && timeRangeValue === NO_TIME_RANGE) {
      setTimeRangeValue(getDefaultV2CalendarRangeValue(calendarFormat));
    }
    setFrame(value);
  }

  function onReset() {
    setTimeRangeValue(NO_TIME_RANGE);
    setFrame(variant === 'v2' ? 'CalendarV2' : 'No filter');
    setEvalResponse(NO_TIME_RANGE);
    setLastFetchedTimeRange(NO_TIME_RANGE);
    setValidTimeRange(true);
  }

  const frameOptions = FRAME_OPTIONS;

  const overlayContent = (
    <ContentStyleWrapper $variant={variant}>
      {variant !== 'v2' && (
        <>
          <div className="control-label">
            {t('\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b')}
          </div>
          <StyledRangeType
            ariaLabel={t('\u0418\u043d\u0442\u0435\u0440\u0432\u0430\u043b')}
            options={frameOptions}
            value={frame}
            onChange={onChangeFrame}
          />
        </>
      )}
      {variant !== 'v2' && frame !== 'No filter' && <Divider />}
      {variant === 'v2' && (
        <CalendarRangeFrame
          value={timeRangeValue}
          onChange={setTimeRangeValue}
          isOverflowingFilterBar={isOverflowingFilterBar}
          calendarFormat={calendarFormat}
        />
      )}
      {variant !== 'v2' && frame === 'Common' && (
        <CommonFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {variant !== 'v2' && frame === 'Calendar' && (
        <CalendarFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {variant !== 'v2' && frame === 'Current' && (
        <CurrentCalendarFrame
          value={timeRangeValue}
          onChange={setTimeRangeValue}
        />
      )}
      {variant !== 'v2' && frame === 'Advanced' && (
        <AdvancedFrame value={timeRangeValue} onChange={setTimeRangeValue} />
      )}
      {variant !== 'v2' && frame === 'Custom' && (
        <CustomFrame
          value={timeRangeValue}
          onChange={setTimeRangeValue}
          isOverflowingFilterBar={isOverflowingFilterBar}
        />
      )}
      {variant !== 'v2' && frame === 'No filter' && (
        <div data-test={DateFilterTestKey.NoFilter} />
      )}
      {variant !== 'v2' && <Divider />}
      <div>
        {validTimeRange &&
          variant !== 'v2' && (
            <>
              <div className="section-title">{t('Actual time range')}</div>
              <div>
                {evalResponse === 'No filter' ? t('No filter') : evalResponse}
              </div>
            </>
          )}
        {!validTimeRange && (
          <>
            {variant !== 'v2' && (
              <div className="section-title">{t('Actual time range')}</div>
            )}
            {variant !== 'v2' && (
              <IconWrapper className="warning">
                <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
                <span className="text error">{evalResponse}</span>
              </IconWrapper>
            )}
          </>
        )}
      </div>
      <Divider />
      <div className="footer">
        {variant === 'v2' && (
          <Button
            buttonStyle="secondary"
            cta
            key="reset"
            onClick={onReset}
            data-test={DateFilterTestKey.ResetButton}
        >
          {t('\u0421\u0411\u0420\u041e\u0421\u0418\u0422\u042c')}
        </Button>
      )}
        <Button
          buttonStyle="secondary"
          cta
          key="cancel"
          onClick={onHide}
          data-test={DateFilterTestKey.CancelButton}
        >
          {t('\u041e\u0422\u041c\u0415\u041d\u0418\u0422\u042c')}
        </Button>
        <Button
          buttonStyle="primary"
          cta
          disabled={!validTimeRange}
          key="apply"
          onClick={onSave}
          data-test={DateFilterTestKey.ApplyButton}
        >
          {t('\u041f\u0420\u0418\u041c\u0415\u041d\u0418\u0422\u042c')}
        </Button>
      </div>
    </ContentStyleWrapper>
  );

  const popoverContent = (
    <ControlPopover
      autoAdjustOverflow={false}
      trigger="click"
      placement="right"
      content={overlayContent}
      title={
        variant === 'v2' ? undefined : (
          <IconWrapper>
            <Icons.EditOutlined />
            <span className="text">{t('Edit time range')}</span>
          </IconWrapper>
        )
      }
      defaultOpen={show}
      open={show}
      onOpenChange={toggleOverlay}
      overlayStyle={
        variant === 'v2'
          ? {
              width: 'fit-content',
              maxWidth: 'calc(100vw - 32px)',
            }
          : { width: '600px' }
      }
      destroyTooltipOnHide
      getPopupContainer={nodeTrigger =>
        isOverflowingFilterBar
          ? (nodeTrigger.parentNode as HTMLElement)
          : document.body
      }
      overlayClassName="time-range-popover"
    >
      <Tooltip placement="top" title={tooltipTitle}>
        <DateLabel
          name={name}
          aria-labelledby={`filter-name-${props.name}`}
          aria-describedby={`date-label-${props.name}`}
          label={actualTimeRange}
          isActive={show}
          isPlaceholder={actualTimeRange === NO_TIME_RANGE}
          data-test={DateFilterTestKey.PopoverOverlay}
          ref={labelRef}
        />
      </Tooltip>
    </ControlPopover>
  );

  return (
    <>
      <ControlHeader {...props} />
      {popoverContent}
    </>
  );
}
