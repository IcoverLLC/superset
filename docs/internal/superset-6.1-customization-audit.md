# Аудит переноса кастомизаций на Superset 6.1.0

Последнее обновление: 2026-07-15

## Назначение

Этот документ фиксирует состояние новой предрелизной ветки Superset 6.1.0 и служит стартовой точкой для staging и будущего обновления production. Он дополняет историческую карту `prod-customizations.md`: старая карта объясняет состав форка 6.0, а здесь записаны результаты переноса и обязательные проверки перед rollout.

## Зафиксированные Git-ссылки

| Роль | Ссылка | Commit |
| --- | --- | --- |
| Чистая база Apache Superset 6.1.0 | `upstream-6.1.0` | `c83fb2bb1dcf` |
| Старый `dev` до обновления | `origin/backup/dev-before-6.1-20260715` | `f37d9dcb84eb` |
| Первая сборка 6.1 + кастомизации | `origin/dev` | `be3379adecaf` |
| Ветка углублённого аудита | `audit/6.1-customization-hardening` | основана на `be3379adecaf` |

Старый fork-diff относительно `origin/6.0.0` содержит 158 путей. Первая 6.1-сборка отличается от чистой 6.1 по 155 путям; 145 путей совпали напрямую. Остальные пути проверены отдельно как переименования, перенос логики или реальные пропуски. Обнаруженный реальный пропуск `DefaultValue.tsx` для `filter_time_v2` восстановлен.

## Итог по основным блокам

| Блок | Состояние | Что проверено или исправлено | Что осталось для staging |
| --- | --- | --- | --- |
| `filter_time_v2` и календарь | Перенесён, исправлен пропуск | Plugin/DateFilterLabel/date utils на месте; восстановлена ширина default value; зависимость на новый ещё не сохранённый time-фильтр теперь разрешается из формы | Ручной сценарий создания зависимых фильтров и визуальная проверка CalendarRangeFrame |
| Custom AG Grid (`Table V2_icover`) | Исправлена BigInt-ошибка и прямые расхождения с 6.1, требуется staging QA | Убрана передача `bigint` в числовую математику; exact integer не теряет точность; добавлены raw temporal, UTC date, page clamp, row-limit guard и восстановление column state | Проверка на исходном датасете; отдельно решить целостный перенос server-pagination filtering из 6.1 |
| Welcome/dashboard catalog | Перенесён, backend fallback усилен | Feature flag, UI, API, snapshot model и task сохранены; после optional read error выполняется rollback сессии | API/RBAC/MSW тесты, план beat schedule, нагрузочная оценка snapshot/log запросов |
| Alembic migration | Исправлен критичный дефект истории | Published revision `8f4c1b1c2d3e` возвращён к исходному parent `c233f5365c9e`; добавлен отдельный merge revision с официальной веткой 6.1 | Read-only проверка текущей revision production, затем dry-run миграций на копии metadata DB |
| Upstream `AGENTS.md` | Исправлено | Полная инструкция 6.1 сохранена, локальные правила форка добавлены отдельным разделом | Нет |
| Frontend build blockers | Исправлены локально | Устранены duplicate import и локальные lint-проблемы; восстановлены owner filter, data column types, Pivot dark theme и Home extension contract | Полный CI в поддерживаемом Node/npm и браузерный smoke |
| Docker/dependencies | Частично исправлено | ClickHouse client ограничен актуальным диапазоном; manifest/lock custom plugin синхронизированы с 6.1 | Проверить двухступенчатую сборку `Dockerfile.prod` и зафиксировать базовый image digest |

## `filter_time_v2`

Кастомный тип фильтра присутствует в registry, plugin, control panel, transform props, label/date utilities и dashboard filter configuration. При сравнении старого fork-diff с 6.1 был найден один фактический пропуск: `DefaultValue` учитывал только стандартный `filter_time`, из-за чего кастомный календарь получал неверную ширину редактора. Теперь оба time-типа используют ширину 350 px.

Дополнительно исправлена зависимость от нового фильтра, который ещё находится только в форме и отсутствует в сохранённой `filtersConfig`. До исправления такой `filter_time_v2` мог ошибочно считаться недоступной зависимостью.

Перед production обязательно вручную пройти сценарии:

1. Создать `filter_time_v2`, настроить диапазон и сохранить dashboard.
2. Создать второй фильтр с зависимостью от ещё не сохранённого первого.
3. Открыть существующий dashboard со старой конфигурацией фильтра.
4. Проверить timezone, preset ranges, очистку значения и reload dashboard.

## BigInt в `Table V2_icover`

### Причина

ClickHouse/JSON path может вернуть большие целые как native JavaScript `bigint`. Кастомная таблица определяла тип диапазона по первой строке, а затем применяла `Math.abs` ко всему столбцу. В смешанном столбце `number + bigint` это приводило к ошибке `TypeError: Cannot convert a BigInt value to a number`. Аналогичный риск был в renderer bars, d3/currency formatter, conditional formatting и cross-filter serialization.

### Исправление

- cell bars и числовые extrema строятся только по конечным значениям типа `number`;
- `bigint` отображается точной десятичной строкой без преобразования в `number`;
- BigInt-колонки используют text semantics и exact string filter value;
- условное форматирование не передаёт `bigint` в числовую математику;
- cross-filter payload нормализует `bigint` в JSON-сериализуемую точную строку.

Есть focused regression tests для смешанного столбца, очень большого целого, renderer, conditional formatting и cross-filter payload. Финальное подтверждение всё равно нужно выполнить на том же датасете и мерах, где наблюдалась ошибка.

В рамках безопасного прямого паритета с 6.1 также добавлены merge `extra_form_data`, корректное поведение Raw temporal и raw timestamp cross-filter, UTC date comparator, null getter, boolean renderer, page clamp, защита `row_limit` от `NaN` и согласование сохранённого column state с изменившимся набором колонок.

### Отдельный риск server pagination

Это не часть BigInt-исправления. В custom plugin фильтры AG Grid при server pagination могут применяться только к загруженной странице. Официальный plugin 6.1 содержит связанный pipeline server filter/chart state, которого нет в кастомной реализации. Его нельзя переносить частично: текстовый фильтр, exact integer SQL, query state, sort mapping и CSV должны быть согласованы как один staging change set.

## Безопасность миграций

Нельзя изменять `down_revision` уже опубликованной и потенциально применённой миграции. В первой 6.1-сборке revision `8f4c1b1c2d3e` была перепривязана с `c233f5365c9e` прямо к head 6.1. Если production уже хранит `8f4c1b1c2d3e` в `alembic_version`, это меняет смысл существующей истории и может пропустить официальные миграции.

Исправленная схема:

```text
c233f5365c9e ── official 6.1 chain ── 4b2a8c9d3e1f ──┐
              └─ 8f4c1b1c2d3e (welcome rank) ─────────┴─ 9a7b6c5d4e3f
```

Перед любым upgrade production:

1. Снять backup metadata DB.
2. Read-only способом зафиксировать содержимое `alembic_version` и наличие `welcome_dashboard_rank`.
3. На восстановленной копии выполнить `superset db upgrade` и проверить единственный head.
4. Проверить downgrade/restore strategy без выполнения downgrade на production.
5. Только после staging smoke планировать production maintenance window.

Никакие DDL/DML или реальные миграции production в рамках этого аудита не выполнялись.

## Найденные интеграционные риски

Следующие пункты не следует скрывать общим «тесты прошли»:

- исправлено: dashboard owner filter снова использует upstream rich owner label/email behavior;
- исправлено: оба data-pane path сохраняют исходный индекс `coltypes` при исключении `__inherit`;
- исправлено: dark-theme conditional background в Pivot снова применяется после upstream выбора formatter, сохраняя explicit text color;
- welcome UI и DashboardCard требуют API/race/unmount/RBAC тестов;
- исправлено: Home сохраняет upstream контракт Top/Main extensions, а catalog flag выбирает только fallback;
- alt multi-select, pivot pin rows, row collapse и context-menu autoclose перенесены, но нуждаются в дополнительных interaction tests;
- welcome aggregation по логам и thumbnails необходимо проверить на объёме staging;
- custom Docker image зависит от локального базового image и пока не является полностью воспроизводимым артефактом.

## Проверки и ограничения среды

После объединения всех исправлений единый focused Jest запуск дал 21 suite / 177 tests / 2 snapshots без ошибок. В него вошли custom AG Grid, BigInt, `filter_time_v2`, dependency hook, shared conditional formatting, Pivot, Home extension contract, owner/data-column regressions. Отдельный календарный batch ранее дал 6 suites / 32 tests. Python-файлы проверялись статически, а граф миграций — на дубли, отсутствующие parents и число heads.

Изолированный backend pytest не стартует в текущей локальной среде из-за отсутствующего `flask_migrate`; поэтому rollback-before-fallback покрыт unit-логикой, но PostgreSQL `InFailedSqlTransaction` ещё нужно воспроизвести интеграционно на staging.

Локальная среда не эквивалентна release CI: установлен Node 24/npm 11, тогда как проект требует Node 22/npm 10; полный frontend typecheck также зависит от заранее собранных composite projects. Поэтому release-решение нельзя принимать только по локальным targeted tests.

## Stop gates перед production

Production rollout запрещён, пока не выполнены все пункты:

- audit-ветка прошла CI в поддерживаемом toolchain;
- миграции успешно выполнены на восстановленной копии production metadata DB;
- staging стартует на том же image и конфигурации, что планируются для production;
- исходный BigInt-датасет открывается, фильтруется, экспортируется и cross-filter работает без потери точности;
- вручную пройдены `filter_time_v2`, welcome catalog, стандартная Table/Pivot/ECharts и dashboard edit/save;
- проверены permissions/RBAC и отсутствие прямого доступа агента/MCP к БД;
- согласованы известные отложенные риски либо они исправлены отдельными reviewable changes;
- есть backup, rollback plan и зафиксированная production revision.

## Рекомендуемый следующий шаг

Не сливать audit-ветку вслепую в `dev`. Сначала завершить её локальные проверки, сделать review diff относительно `be3379adecaf`, затем отдельным подтверждённым действием обновить `dev` и развернуть staging. Push без явного подтверждения не выполнять.
