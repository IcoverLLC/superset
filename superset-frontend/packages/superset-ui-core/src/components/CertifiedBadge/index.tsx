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
import { styled, t, useTheme } from '@superset-ui/core';
import { Icons } from '@superset-ui/core/components/Icons';
import { SafeMarkdown } from '../SafeMarkdown/SafeMarkdown';
import { Tooltip } from '../Tooltip';
import type { CertifiedBadgeProps } from './types';

const BadgeTrigger = styled.span`
  display: inline-flex;
  align-items: center;
  line-height: 0;
`;

const TooltipContent = styled.div`
  white-space: normal;

  p:last-child {
    margin-bottom: 0;
  }
`;

const normalizeDetails = (details: string) =>
  details.replace(/<br\s*\/?>(\r)?/gi, '\n').replace(/\n/g, '  \n');

export function CertifiedBadge({
  certifiedBy,
  details,
  headline,
  showCertifiedBy = true,
  size = 'l',
}: CertifiedBadgeProps) {
  const theme = useTheme();

  return (
    <Tooltip
      id="certified-details-tooltip"
      overlayStyle={{ minWidth: '320px', maxWidth: '420px' }}
      title={
        <TooltipContent>
          {headline && (
            <div>
              <strong>{headline}</strong>
            </div>
          )}
          {!headline && showCertifiedBy && certifiedBy && (
            <div>
              <strong>{t('Certified by %s', certifiedBy)}</strong>
            </div>
          )}
          {details && <SafeMarkdown source={normalizeDetails(details)} />}
        </TooltipContent>
      }
    >
      <BadgeTrigger>
        <Icons.InfoCircleFilled
          iconColor={theme.colorPrimary}
          iconSize={size}
        />
      </BadgeTrigger>
    </Tooltip>
  );
}
