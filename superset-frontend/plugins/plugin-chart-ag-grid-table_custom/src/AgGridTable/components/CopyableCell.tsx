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
import { CopyOutlined } from '@ant-design/icons';
import { styled, t } from '@superset-ui/core';
import copyTextToClipboard from 'src/utils/copy';
import { MouseEvent, ReactNode } from 'react';

const CellWrapper = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.sizeUnit}px;
    width: 100%;
    height: 100%;
  `}
`;

const CellContent = styled.div`
  flex: 1;
  min-width: 0;
`;

const CopyButton = styled.button`
  ${({ theme }) => `
    background: transparent;
    border: none;
    padding: 0;
    color: ${theme.colorTextBase};
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: color 0.2s ease, opacity 0.2s ease;

    ${CellWrapper}:hover &,
    &:focus-visible {
      opacity: 1;
      color: ${theme.colorPrimary};
    }
  `}
`;

type CopyableCellProps = {
  displayNode: ReactNode;
  textToCopy: string;
};

export const CopyableCell = ({
  displayNode,
  textToCopy,
}: CopyableCellProps) => {
  const handleCopy = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    copyTextToClipboard(() => Promise.resolve(textToCopy));
  };

  return (
    <CellWrapper>
      <CellContent>{displayNode}</CellContent>
      <CopyButton
        type="button"
        aria-label={t('Copy')}
        onClick={handleCopy}
      >
        <CopyOutlined />
      </CopyButton>
    </CellWrapper>
  );
};
