# Superset 6.1: аудит известных исправлений и кастомизаций, итерация 2

Дата проверки: 2026-07-16.

## Зафиксированный baseline

- рабочая ветка аудита: `audit/6.1-known-fixes-round2`;
- исходный `origin/dev`: `9facd2bd9a96`;
- официальный tag `6.1.0`: `c83fb2bb1dcf`;
- официальная maintenance-ветка `apache/6.1`: `39f9611ebbe0`;
- между tag `6.1.0` и `apache/6.1` — 17 официальных commits;
- на дату проверки релиза `6.1.1` нет.

Проверка baseline:

```bash
git rev-list --count upstream-6.1.0..apache/6.1
git log --reverse --oneline upstream-6.1.0..apache/6.1
```

Локальный checkpoint исправлений форка: `5749673e17`. Официальная maintenance-ветка объединена merge-коммитом `5dda9b9661`. В `origin` изменения этой итерации пока не отправлены.

## Что получено из официальной ветки 6.1

Ветка `apache/6.1` включена целиком, а не набором несвязанных cherry-pick. Это сохраняет официальный порядок зависимостей и тестов.

Важные исправления:

- SQL Lab estimate action;
- cache headers и асинхронная загрузка extensions;
- разбор больших чисел в scientific notation;
- корректное имя owner;
- `MCP_DISABLED_TOOLS`;
- Save/Overwrite после изменения chart properties;
- восстановление chart description;
- `remove_filter=True` для Jinja drill-to-detail;
- приведение типов adhoc/cross-filter, включая BIGINT;
- embedded `hideTab`, filter bar и event logging;
- CI/Playwright fixes.

Официальные источники:

- [Superset releases](https://github.com/apache/superset/releases)
- [BIGINT/adhoc cross-filter, PR #41936](https://github.com/apache/superset/pull/41936)
- [Save Overwrite, PR #41602](https://github.com/apache/superset/pull/41602)
- [Jinja remove_filter, PR #41934](https://github.com/apache/superset/pull/41934)
- [Embedded filter bar/hideTab, PR #42008](https://github.com/apache/superset/pull/42008)
- [Embedded event logging, PR #41938](https://github.com/apache/superset/pull/41938)
- [Strict embedded route regex, PR #42048](https://github.com/apache/superset/pull/42048)

## Исправления кастомного форка в этой итерации

### Calendar и native time filters

- восстановленное/default значение синхронизируется в `DataMask` один раз при mount;
- явная очистка time filter хранится как `null`, поэтому configured default не появляется снова;
- TimeGrainV2 нормализует несовместимое значение один раз без цикла обновлений;
- календарь переводит в whole-day range только диапазоны, действительно заданные полными днями;
- точные datetime ranges больше не расширяются до границ суток.

### BigInt и Table/AG Grid

- standard Table и custom AG Grid сохраняют exact `bigint` для totals и comparison differences;
- смешанные safe integer/`bigint` значения также считаются без потери разрядов;
- проценты остаются конечными `number`;
- drill/context-menu payload рекурсивно преобразует `bigint` в точную decimal string перед JSON serialization;
- исправлена исходная ошибка `TypeError: Cannot convert a BigInt value to a number`;
- callbacks custom AG Grid больше не используют устаревший `serverPaginationData`;
- server pagination соблюдает configured `row_limit` в Table, standard AG Grid и custom AG Grid;
- out-of-range controlled page синхронизируется с реально запрошенной страницей.

### Dashboard и Explore

- partial save chart customizations/native filters больше не удаляет соседний тип конфигурации;
- зависимый native filter ждёт инициализации parent с `defaultToFirstItem`;
- comparison formatting в standard и custom AG Grid привязано к объекту строки и не съезжает после сортировки;
- Results Pane строит отдельный metric-to-SQL mapping для каждого query result, поэтому одинаковые custom labels не перезаписывают друг друга.

### Безопасные fixes из более новой master

Перенесены только небольшие изменения с понятным контрактом и focused tests:

- ClickHouse UTC datetime literals — [PR #41579](https://github.com/apache/superset/pull/41579);
- query cancellation только владельцем — официальный commit `ffa32414ef`;
- guards для отсутствующего dashboard filter scope — [PR #41746](https://github.com/apache/superset/pull/41746);
- исключение runtime `metricSqlExpressions` из form data — [PR #41555](https://github.com/apache/superset/pull/41555);
- `row_limit` для Table server pagination — [PR #41024](https://github.com/apache/superset/pull/41024);
- использование `tbl_column.type` при построении SQLAlchemy column — commit `9d167dfada`;
- `fast-uri` `3.1.3` для CVE-2026-13676 — [PR #41631](https://github.com/apache/superset/pull/41631).
- сохранение native filters после display controls — [PR #42032](https://github.com/apache/superset/pull/42032);
- каскадный `defaultToFirstItem` — [PR #40978](https://github.com/apache/superset/pull/40978);
- AG Grid conditional formatting после сортировки — [PR #41390](https://github.com/apache/superset/pull/41390).

Полная `apache/master` не объединяется: она ушла более чем на 2 000 commits и содержит несовместимые крупные обновления, включая AG Grid 36 и Ant Design 6.

## MCP: обязательные блокеры до пилота

Само наличие JWT transport validation пока не создаёт безопасную пользовательскую сессию Superset. До запуска staging pilot обязательны:

1. JWT identity должна преобразовываться в конкретного активного Superset user; `MCP_DEV_USERNAME` нельзя использовать как fallback при JWT.
2. При `MCP_AUTH_ENABLED=True` отсутствие рабочего auth provider должно останавливать сервис.
3. Shared response cache должен оставаться выключенным, пока cache key не включает identity/tenant.
4. Audit middleware должен получать identity до логирования и рекурсивно удалять SQL, template params и credentials.
5. `instance://metadata` требует отдельного privacy/RBAC gate.
6. Permission metadata должна быть fail-closed; исключение допустимо только для явно публичного health check.

Для первого read-only/preview пилота:

```python
MCP_DISABLED_TOOLS = [
    "execute_sql",
    "save_sql_query",
    "create_virtual_dataset",
    "generate_chart",
    "update_chart",
    "update_chart_preview",
    "generate_dashboard",
    "add_chart_to_existing_dashboard",
]

MCP_CACHE_CONFIG = {"enabled": False}
```

Preview допускается через `generate_explore_link`, `get_chart_data` и `get_chart_preview`. `ToolAnnotations` и инструкции prompt не являются security boundary.

Официальные post-6.1 MCP commits `e25d708197`, `817a35f445`, `ca8855dc03` и `a9df2c7e5e` зависят от более новой архитектуры и не должны cherry-pick-иться вслепую. Их требования используются как acceptance criteria для отдельной MCP-задачи.

## Найденные, но отложенные работы

### P1

- custom AG Grid должен перейти от поиска строк `Main`/`includes('Main')` к явным `comparisonRole` и `sourceKey`;
- NULL-only cross-filter лучше явно преобразовывать в `IS NULL`; смешанные `[null, value]` backend 6.1 уже обрабатывает корректно;
- async Results Pane effect требует отдельной задачи на полный dependency list и cancellation/stale-response guard;
- Welcome snapshot full refresh должен делать SQL `row_number()` до загрузки данных в Python;
- Welcome snapshot требует Celery beat schedule, distributed lock, retention cleanup и проверки индекса по `logs.dttm`.

### P2

- Welcome UI выполняет лишний повторный запрос и заранее рендерит скрытые sections;
- контракт временного окна snapshot нужно явно определить: rolling N days или завершённые календарные дни в `Europe/Moscow`.

## Обязательные staging gates

Перед production rollout:

1. чистая установка frontend dependencies из lock и production build;
2. полный frontend unit suite в поддерживаемой Node-среде;
3. Python unit/integration suite с полным Superset dev environment;
4. `superset db upgrade` и проверка migration graph на копии metadata DB;
5. smoke-test: login, datasets, Explore, dashboards, native filters, embedded mode;
6. пилотный датасет с safe и unsafe BIGINT, `NULL`, totals, comparison и server pagination;
7. отдельная проверка custom AG Grid с исходным проблемным датасетом/мерами;
8. MCP JWT/RBAC negative tests: inactive user, expired/no-exp token, forbidden tool, cross-user cache isolation;
9. backup metadata DB и проверенный rollback plan;
10. только после прохождения gates — решение о переносе ветки в `dev` и push с отдельным подтверждением.

## Локальная валидация

До merge maintenance-ветки:

- focused frontend: 16 suites, 240 tests — passed;
- отдельные AG Grid pagination tests: 2 suites, 70 tests — passed;
- Python `compileall` изменённых модулей — passed;
- `git diff --check` — passed.

После merge maintenance-ветки и адаптации post-6.1 fixes:

- targeted frontend regression pack: 34 suites, 389 tests — passed;
- Prettier check всех изменённых TS/TSX — passed;
- oxlint изменённых TS/TSX — 0 errors;
- `fast-uri` dependency tree — только `3.1.3`;
- Python `compileall` — passed;
- `git diff --check` — passed;
- `apache/6.1` является ancestor текущей ветки — confirmed.

Локальный backend pytest пока не является валидным gate: окружение не содержит `flask_migrate`, поэтому collection останавливается до выполнения тестов. Это проблема локального dev environment, а не успешный или проваленный тест кода.
