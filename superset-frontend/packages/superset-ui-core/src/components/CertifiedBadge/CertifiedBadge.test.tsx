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
import { render, screen, userEvent, waitFor } from '@superset-ui/core/spec';
import { CertifiedBadge } from '.';
import type { CertifiedBadgeProps } from './types';

const asyncRender = (props?: CertifiedBadgeProps) =>
  waitFor(() => render(<CertifiedBadge {...props} />));

test('renders with default props', async () => {
  await asyncRender();
  expect(screen.getByRole('img')).toBeInTheDocument();
});

test('renders a tooltip when hovered', async () => {
  await asyncRender();
  await userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
});

test('renders with certified by', async () => {
  const certifiedBy = 'Trusted Authority';
  await asyncRender({ certifiedBy });
  await userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(certifiedBy);
});

test('renders with details', async () => {
  const details = 'All requirements have been met.';
  await asyncRender({ details });
  await userEvent.hover(screen.getByRole('img'));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(details);
});

test('renders headline instead of certified by when provided', async () => {
  await asyncRender({
    certifiedBy: 'Trusted Authority',
    headline: 'Запасы. Отчет по запасам',
    showCertifiedBy: false,
  });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Запасы. Отчет по запасам');
  expect(tooltip).not.toHaveTextContent('Trusted Authority');
});

test('preserves line breaks in details', async () => {
  await asyncRender({ details: 'Первая строка\nВторая строка' });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Первая строка');
  expect(tooltip).toHaveTextContent('Вторая строка');
});

test('applies a wider tooltip width for certification details', async () => {
  await asyncRender({
    details: 'Длинное описание для проверки ширины тултипа',
  });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.closest('.ant-tooltip')).toHaveStyle({
    minWidth: '320px',
    maxWidth: '420px',
  });
});
test('renders markdown and html line breaks in details', async () => {
  await asyncRender({ details: 'Первая строка<br />**жирный**' });
  await userEvent.hover(screen.getByRole('img'));
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('Первая строка');
  expect(tooltip).toHaveTextContent('жирный');
  expect(tooltip).not.toHaveTextContent('<br />');
});
