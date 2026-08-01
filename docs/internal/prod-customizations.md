# `prod` vs `origin/6.0.0`: карта кастомизаций

Последнее обновление: 2026-07-15

## Назначение

Этот документ фиксирует, чем ветка `prod` отличается от базы `origin/6.0.0`, и нужен для двух сценариев:

1. Быстро понять, какие доработки реально живут в форке сейчас.
2. Упростить будущий апгрейд Superset: что надо сохранить, что можно заменить штатной реализацией новой версии, а что уже было экспериментом и давно откатилось.

Общий план перехода на Superset 6.1.0 и интеграции MCP зафиксирован в [superset-6.1-mcp-upgrade.md](superset-6.1-mcp-upgrade.md).

## Текущий снимок веток

Состояние после `git fetch origin --prune` от 2026-07-15:

| Ref | Commit | Дата commit | Наблюдаемая роль |
|---|---|---|---|
| `origin/prod` / локальная `prod` | `e6b3d5f561b0a97dae86199deb71dd231f1d095d` | 2026-04-07 | Кандидат на production source; соответствие реальному deploy пока не подтверждено. |
| `origin/dev` / локальная `dev` | `f37d9dcb84ebbad68c19ccca17ad1d247087e473` | 2026-06-24 | Ветка разработки и default branch (`origin/HEAD -> origin/dev`). |
| `origin/6.0.0` | `6a1c30e5e7c3e28d0549c9c2ac0ff61607f26a2f` | 2025-12-04 | База сравнения; commit входит в историю `prod` и `dev`. Subject упоминает `6.0.0rc4`. |
| `origin/master` | `70b95ca1b98d6b8b2d6f591cd9a79795abd38ba6` | 2026-01-31 | Старая синхронизация upstream-линии форка; не является базой текущих `prod`/`dev`. |

Дополнительные факты:

- `prod` целиком входит в историю `dev`; `dev` опережает `prod` на 12 коммитов и не имеет собственного отставания относительно `prod`.
- `superset-frontend/package.json` в `origin/6.0.0`, `prod` и `dev` содержит версию `6.0.0`.
- Это не доказывает соответствие официальному финальному release 6.0.0: subject базового commit содержит `6.0.0rc4`, а release tag в clone отсутствует.
- локальный clone не содержит Git tags, поэтому tag нельзя использовать как доказательство версии или deploy.
- `origin/master` и `prod` разошлись после commit `1f482b42eb20cf77b42e9acaed7e9b77a9cf9d18`: относительно друг друга в `origin/master` 1228 собственных коммитов, в `prod` 729.
- Имя production image, registry tag, digest и runtime SHA в репозитории не зафиксированы. `Dockerfile.prod` начинается с `FROM superset:prod-base`, но не определяет финальное имя image.

## База сравнения и методика

- База: `origin/6.0.0`
- Целевая ветка: `prod`
- На момент фиксации:
  - `git diff --stat origin/6.0.0...prod` показывает `144 files changed, 14748 insertions(+), 613 deletions(-)`
  - `git log origin/6.0.0..prod` содержит `482` коммита
  - из них `154` merge PR, `15` merge branch, `54` revert-коммита
  - `313` коммитов не являются merge-коммитами

Для этой карты использовались:

- итоговый diff между `origin/6.0.0` и `prod`
- история коммитов `prod`
- названия локальных задач Codex, которые совпадают по датам и тематике с изменениями

Важно: при апгрейде authoritative source всегда является итоговый diff, а не вся история коммитов. История нужна в первую очередь для понимания намерения и для отсева уже откатанных экспериментов.

Ниже документ сделан в двух уровнях детализации:

1. Смысловая карта изменений по крупным блокам.
2. Полный реестр файлов из diff, чтобы покрытие было буквальным, без пропусков.

Рабочая предпосылка для этого документа такая: финальный diff `prod` считаем в целом осмысленным и нужным. Даже если в истории были промежуточные откаты и эксперименты, в реестр ниже всё равно включены вообще все файлы, которые реально отличаются от `origin/6.0.0`.

## Где смотреть в первую очередь

При следующем переходе на новую версию удобный порядок такой:

1. Прочитать этот документ.
2. Снять свежий diff относительно новой базы.
3. Для каждого блока ниже принять решение: `оставить`, `выбросить`, `заменить штатной реализацией новой версии`.
4. После merge обновить этот файл, а не начинать анализ заново с нуля.
5. До любых миграций подтвердить реальный production image/tag/digest и runtime SHA по запущенному окружению.

Полезные команды:

```bash
git diff --stat origin/6.0.0...prod
git diff --name-only origin/6.0.0...prod
git log --first-parent --oneline origin/6.0.0..prod
git log --no-merges --oneline origin/6.0.0..prod
```

## Активные кастомизации

### 1. Кастомный плагин `Table V2_icover`

Это крупнейшее отличие форка. В `prod` добавлен отдельный chart plugin `ag-grid-table-custom`, зарегистрированный как новый `VizType`, а не как patch поверх штатного table plugin.

Что реально осталось в ветке:

- новый тип визуализации `TableAgGridCustom`
- регистрация плагина в `MainPreset`
- собственный пакет `superset-frontend/plugins/plugin-chart-ag-grid-table_custom`
- отдельный `controlPanel`, `buildQuery`, `transformProps`, renderers и styles
- per-column настройки:
  - `Hide by default`
  - `Pin by default`
  - `Hide summary value`
  - `Header background color`
- поддержка `percent_metrics`
- базовое и кастомное conditional formatting
- кастомный header/menu:
  - reset filters
  - hide column
  - unhide hidden columns
  - autosize
  - copy/export actions
- UX-доработки:
  - `Alt + click` скрывает колонку
  - numeric filter понимает проценты и учитывает форматирование числа
  - локализация blank-значений в фильтрах
  - pagination/control row перенесены вверх
  - увеличены и переработаны sort/filter indicators
  - добавлены вертикальные разделители колонок
  - сохраняется порядок колонок при cross-filter
  - таблица лучше заполняет высоту chart container

Ключевые файлы:

- `superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts`
- `superset-frontend/src/visualizations/presets/MainPreset.js`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/`

Контекст задач, который удалось восстановить:

- `Перенести блок Page size вверх`
- `Применить CSS для заголовков ag grid`
- `Удалить фильтр из заголовка`
- `Добавить сброс фильтров в Table v2`

Что проверять при апгрейде:

- не появился ли в новой версии Superset/Table V2 штатный аналог нужных вам фич
- можно ли часть логики вернуть в upstream plugin вместо поддержки отдельного `Table V2_icover`
- не изменился ли API AG Grid, от которого зависят кастомный header, menu и filter behavior

Практический вывод:

- этот блок почти наверняка нужно проверять вручную при каждом апгрейде
- это не временный эксперимент, а полноценная форковая функциональность

### 2. Доработки штатных table/pivot/chart компонентов

Помимо кастомного AG Grid плагина, в `prod` есть изменения в штатных визуализациях.

Что осталось:

- `plugin-chart-table`
  - правка локализованного main comparison column
  - корректировка truncate/hover поведения
  - восстановление ширины при повторном показе колонок
- `plugin-chart-pivot-table`
  - pin rows block / sticky first columns
  - row hover/select highlighting
  - перенос и расширение conditional formatting
  - midpoint для conditional formatting
  - адаптация conditional formatting под dark theme
- `plugin-chart-echarts`
  - точечные layout fixes для extra controls / area chart
- `BigNumber`
  - точечные scrollbar/dark theme fixes

Ключевые файлы:

- `superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx`
- `superset-frontend/plugins/plugin-chart-table/src/transformProps.ts`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/react-pivottable/TableRenderers.jsx`
- `superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/`

Контекст задач:

- `Добавить закрепление колонок Pivot`
- `Перенести conditional formatting`

Что проверять при апгрейде:

- не появились ли аналогичные sticky/pinned возможности в upstream pivot renderer
- не изменилась ли модель conditional formatting в новой версии
- не закрыты ли upstream уже ваши fixes по localized comparison columns

Практический вывод:

- это важные UX-правки, но часть из них имеет шанс стать неактуальной в более новой версии
- именно этот блок надо первым сравнивать с upstream release notes и текущей реализацией новой версии

### 3. Новый welcome/dashboard catalog и UI списков

Ветка `prod` серьёзно меняет домашнюю страницу и список дашбордов.

Что осталось:

- новый feature flag `WELCOME_DASHBOARD_CATALOG`
- новый frontend screen `DashboardWelcome`
- новый backend endpoint `GET /api/v1/dashboard/welcome/`
- фильтруемый каталог дашбордов на welcome-странице
- top dashboards с несколькими стратегиями выбора:
  - personal recent views из snapshot-таблицы
  - global recent views из snapshot-таблицы
  - manual config через `WELCOME_DASHBOARD_TOP_IDS`
  - fallback по default order
- отдельный блок list filters для dashboard list
- доработанные `DashboardCard`
- переработанный `CertifiedBadge`
- визуальные правки карточек, границ, tooltip и поведения approved/certified badge

Ключевые файлы:

- `superset-frontend/src/features/home/DashboardWelcome.tsx`
- `superset-frontend/src/pages/Home/index.tsx`
- `superset-frontend/src/pages/DashboardList/index.tsx`
- `superset-frontend/src/features/dashboards/DashboardCard.tsx`
- `superset-frontend/src/features/dashboards/listFilters.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/CertifiedBadge/index.tsx`
- `superset/dashboards/api.py`

Контекст задач:

- `Добавить фильтры и топ дашборды`

Что проверять при апгрейде:

- не изменилась ли структура dashboard list API и `DashboardGetResponseSchema`
- не появилось ли в новой версии штатное решение для dashboard catalog на welcome page
- не конфликтует ли ваш `WELCOME_DASHBOARD_CATALOG` с новыми home/welcome feature flags

Практический вывод:

- блок достаточно изолирован feature flag-ом, и это хорошо для merge
- если новая версия Superset предложит приемлемый home/dashboard experience, этот блок можно будет частично сократить

### 4. Snapshot-хранилище top dashboards и фоновые thumbnail-задачи

Для welcome catalog добавлен отдельный backend-слой, который хранит ранжированные top dashboards и подогревает thumbnail cache.

Что осталось:

- новая модель `WelcomeDashboardRank`
- новая миграция `8f4c1b1c2d3e_add_welcome_dashboard_rank_snapshot`
- модуль `superset/dashboards/welcome_top.py`
- celery-задачи:
  - `welcome_dashboard_top.refresh_snapshots`
- конфиги:
  - `WELCOME_DASHBOARD_TOP_LIMIT`
  - `WELCOME_DASHBOARD_TOP_LOOKBACK_DAYS`
  - `WELCOME_DASHBOARD_TOP_IDS`
  - `WELCOME_DASHBOARD_TOP_SNAPSHOT_LIMIT`

Ключевые файлы:

- `superset/models/welcome_dashboard_rank.py`
- `superset/migrations/versions/2026-03-21_11-30_8f4c1b1c2d3e_add_welcome_dashboard_rank_snapshot.py`
- `superset/dashboards/welcome_top.py`
- `superset/tasks/scheduler.py`
- `superset/config.py`

Что проверять при апгрейде:

- не поменялись ли внутренние модели `Log`, `Dashboard`, thumbnail executors и screenshot cache
- не изменился ли celery beat config format
- не появилось ли в upstream собственное snapshot/cache решение для welcome/top dashboards

Практический вывод:

- это отдельный backend feature, который надо переносить осознанно
- если сам welcome catalog больше не нужен, весь этот блок можно удалить целиком вместе с миграцией и задачами

### 5. Управление thumbnails

В `prod` есть отдельные правки вокруг thumbnails, не только для welcome page.

Что осталось:

- новый backend config `DISABLE_CHART_THUMBNAILS`
- если флаг включён:
  - chart thumbnail endpoints возвращают `404`
  - авто-триггер генерации chart thumbnail после изменения chart отключается
  - dashboard thumbnails при этом не ломаются
- `WebDriverPlaywright` доработан под более устойчивое построение dashboard screenshot:
  - ждёт видимый `.chart-container`, а если не дождался, пробует `.grid-container`
  - для dashboard screenshot ждёт не только исчезновения loading-state, но и стабилизации DOM через quiet-window на `MutationObserver`
- `ImageLoader` умеет повторять загрузку thumbnail после `202 Accepted`
- `DashboardCard` умеет deferred loading thumbnails

Ключевые файлы:

- `superset/charts/api.py`
- `superset/models/slice.py`
- `superset/utils/webdriver.py`
- `superset-frontend/packages/superset-ui-core/src/components/ListViewCard/ImageLoader.tsx`
- `superset-frontend/src/features/dashboards/DashboardCard.tsx`
- `tests/integration_tests/thumbnails_tests.py`
- `tests/unit_tests/models/slice_test.py`

Контекст задач:

- `Добавить флаг отключения thumbnail`
- `Добавить автозаполнение thumbnail`

Что проверять при апгрейде:

- не изменилась ли логика async screenshot endpoints
- не появился ли upstream способ отключать chart thumbnails без локального patch
- не сломается ли повторная загрузка при изменении response semantics `202`
- не поменялись ли в upstream CSS-селекторы/этапы рендера dashboard page, от которых зависит `superset/utils/webdriver.py`

### 6. Docker/build и инфраструктурные правки

Есть и чисто инфраструктурный слой изменений.

Что осталось:

- `Dockerfile.prod`
- `docker/requirements-local.txt`
- обновления `package.json` / `package-lock.json`, нужные для сборки кастомного plugin package
- точечные TypeScript/build fixes, чтобы кастомный plugin проходил сборку

Ключевые файлы:

- `Dockerfile.prod`
- `docker/requirements-local.txt`
- `superset-frontend/package.json`
- `superset-frontend/package-lock.json`

Практический вывод:

- это не бизнес-функциональность, а техническая поддержка форка
- при апгрейде сравнивать вручную с новой docker/frontend сборкой

### 7. `Time V2`, календарные диапазоны и Explore data table

После предыдущего снимка в `prod` закрепился ещё один крупный frontend-блок:

- отдельный native filter `TimeV2` с ключом `filter_time_v2`
- `DateFilterControlV2` и календарный режим выбора диапазона
- отдельный `monthly`-формат, который ограничивает выбор полными календарными периодами
- быстрые диапазоны для предыдущей календарной недели, месяца, квартала и года
- настройка `calendarFormat` и default value в редакторе native filters
- исправления отображения временных колонок в Explore / View as table
- backend-исправление выбора физических и adhoc-колонок в `ExploreMixin`

Ключевые файлы:

- `superset-frontend/src/filters/components/TimeV2/`
- `superset-frontend/src/filters/components/Time/BaseTimeFilterPlugin.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/DateFilterControlV2.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/components/CalendarRangeFrame.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/`
- `superset-frontend/src/explore/components/DataTablesPane/`
- `superset/models/helpers.py`

Что проверять при апгрейде:

- не появился ли эквивалентный календарный UI и monthly-only режим в Superset 6.1.0
- сохранились ли ключи `filter_time` / `filter_time_v2` и контракт `setDataMask`
- корректно ли мигрируют сохранённые native filter configs и default values
- не закрыты ли upstream исправления View as table и `ExploreMixin`

## Полный реестр файлов из итогового diff

Ниже перечислены все файлы из `git diff --name-only origin/6.0.0...prod`.
Этот раздел нужен именно для полноты: если файл есть в diff, он должен быть назван здесь явно.

### A. Регистрация и реализация кастомного `Table V2_icover`

Эта группа покрывает все файлы, которые создают и подключают отдельный custom AG Grid plugin.

- `superset-frontend/packages/superset-ui-core/src/chart/types/VizType.ts`
- `superset-frontend/src/visualizations/presets/MainPreset.js`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/package.json`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/CustomHeader.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/CustomPopover.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/Filter.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/KebabMenu.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/Pagination.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/SearchSelectDropdown.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/components/TimeComparisonVisibility.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTable/index.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/AgGridTableChart.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/buildQuery.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/consts.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/controlPanel.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/gridHeader/Header.test.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/gridHeader/Header.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/gridHeader/HeaderMenu.test.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/gridHeader/HeaderMenu.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/gridHeader/constants.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/Table.jpg`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/Table2.jpg`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/Table3.jpg`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/thumbnail-dark.png`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/thumbnail.png`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/images/thumbnailLarge.png`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/index.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/renderers/NumericCellRenderer.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/renderers/TextCellRenderer.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/styles/index.tsx`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/transformProps.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/types.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/DateWithFormatter.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/dateFilterComparator.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/extent.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/externalAPIs.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/filterValueGetter.test.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/filterValueGetter.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/formatValue.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/getAggFunc.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/getCellClass.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/getCellStyle.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/getCrossFilterDataMask.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/getInitialSortState.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/headerColors.test.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/headerColors.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/isEqualColumns.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/isValidCssColor.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/parseNumericFilterValue.test.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/parseNumericFilterValue.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/useColDefs.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/src/utils/useTableTheme.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/tsconfig.json`
- `superset-frontend/plugins/plugin-chart-ag-grid-table_custom/types/external.d.ts`

### B. Общая инфраструктура conditional formatting и поддерживающие правки штатного AG Grid

Эта группа покрывает общие механизмы цветовых схем, midpoint, dark-theme adaptive formatting и вспомогательные изменения, которые не лежат внутри custom plugin, но напрямую его поддерживают.

- `superset-frontend/packages/superset-ui-chart-controls/src/types.ts`
- `superset-frontend/packages/superset-ui-chart-controls/src/utils/getColorFormatters.ts`
- `superset-frontend/packages/superset-ui-chart-controls/test/utils/getColorFormatters.test.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/getCellStyle.ts`
- `superset-frontend/plugins/plugin-chart-ag-grid-table/src/utils/useColDefs.ts`
- `superset-frontend/src/explore/components/controls/ConditionalFormattingControl/FormattingPopoverContent.tsx`
- `superset-frontend/src/explore/components/controls/ConditionalFormattingControl/types.ts`

### C. Правки штатных визуализаций и chart interaction

Эта группа покрывает изменения в уже существующих table/pivot/echarts-компонентах и в общем context menu графиков.

- `superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberPeriodOverPeriod/PopKPI.tsx`
- `superset-frontend/plugins/plugin-chart-echarts/src/BigNumber/BigNumberViz.tsx`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/PivotTableChart.tsx`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/controlPanel.tsx`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/plugin/transformProps.ts`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/react-pivottable/Styles.js`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/react-pivottable/TableRenderers.jsx`
- `superset-frontend/plugins/plugin-chart-pivot-table/src/types.ts`
- `superset-frontend/plugins/plugin-chart-pivot-table/test/plugin/transformProps.test.ts`
- `superset-frontend/plugins/plugin-chart-table/src/Styles.tsx`
- `superset-frontend/plugins/plugin-chart-table/src/TableChart.tsx`
- `superset-frontend/plugins/plugin-chart-table/src/transformProps.ts`
- `superset-frontend/plugins/plugin-chart-table/test/TableChart.test.tsx`
- `superset-frontend/src/components/Chart/ChartContextMenu/ChartContextMenu.tsx`

### D. Правки shell/dashboard runtime, nested tabs, markdown и vertical filter bar

Эта группа покрывает не каталог дашбордов, а сам runtime существующих dashboard pages.

- `superset-frontend/src/dashboard/actions/dashboardState.js`
- `superset-frontend/src/dashboard/components/PropertiesModal/index.tsx`
- `superset-frontend/src/dashboard/components/gridComponents/Markdown/Markdown.jsx`
- `superset-frontend/src/dashboard/components/gridComponents/Tab/Tab.jsx`
- `superset-frontend/src/dashboard/components/gridComponents/Tab/Tab.test.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/FilterBar/Vertical.tsx`

### E. Welcome/catalog/list UI, карточки, badge-логика и фронтенд thumbnails UX

Эта группа покрывает все файлы, связанные с новым welcome/catalog experience, карточками, loading thumbnails, фильтрами и связанными UI-типами.

- `superset-frontend/packages/superset-ui-core/src/components/CertifiedBadge/CertifiedBadge.test.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/CertifiedBadge/index.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/CertifiedBadge/types.ts`
- `superset-frontend/packages/superset-ui-core/src/components/ListViewCard/ImageLoader.test.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/ListViewCard/ImageLoader.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/ListViewCard/index.tsx`
- `superset-frontend/packages/superset-ui-core/src/components/ListViewCard/types.ts`
- `superset-frontend/packages/superset-ui-core/src/utils/featureFlags.ts`
- `superset-frontend/src/features/dashboards/DashboardCard.test.tsx`
- `superset-frontend/src/features/dashboards/DashboardCard.tsx`
- `superset-frontend/src/features/dashboards/listFilters.tsx`
- `superset-frontend/src/features/home/DashboardWelcome.tsx`
- `superset-frontend/src/pages/DashboardList/index.tsx`
- `superset-frontend/src/pages/Home/index.tsx`
- `superset-frontend/src/pages/SavedQueryList/index.tsx`
- `superset-frontend/src/views/CRUD/types.ts`
- `superset-frontend/src/views/CRUD/utils.tsx`

### F. Backend welcome catalog, snapshot storage и scheduler

Эта группа покрывает backend-часть welcome/catalog режима, включая API, storage, celery и конфигурацию.

- `superset/config.py`
- `superset/dashboards/api.py`
- `superset/dashboards/welcome_top.py`
- `superset/migrations/versions/2026-03-21_11-30_8f4c1b1c2d3e_add_welcome_dashboard_rank_snapshot.py`
- `superset/models/__init__.py`
- `superset/models/welcome_dashboard_rank.py`
- `superset/tasks/scheduler.py`

### G. Backend thumbnails, endpoint behavior и тесты

Эта группа покрывает то, как форк управляет chart/dashboard thumbnail generation на backend-стороне.

- `superset/charts/api.py`
- `superset/models/slice.py`
- `superset/utils/webdriver.py`
- `tests/integration_tests/thumbnails_tests.py`
- `tests/unit_tests/models/slice_test.py`

### H. Инфраструктура, сборка, локальные зависимости и минимальные служебные diff

Эта группа покрывает все оставшиеся файлы из diff, включая технические и почти тривиальные изменения.

- `Dockerfile.prod`
- `UPDATING.md`
- `docker/requirements-local.txt`
- `superset-frontend/package-lock.json`
- `superset-frontend/package.json`
- `superset/translations/ru/LC_MESSAGES/messages.po`

### I. Минимальные и почти служебные изменения, которые тоже входят в diff

Чтобы не было ощущения, что реестр замалчивает мелочи, отдельно фиксирую файлы с минимальными или неочевидными изменениями:

- `UPDATING.md`
  - в diff ветки есть минимальное whitespace-изменение
- `superset/translations/ru/LC_MESSAGES/messages.po`
  - в diff есть изменение вокруг перевода `Main`
- `superset-frontend/src/pages/SavedQueryList/index.tsx`
  - из списка сохранённых запросов убрано действие копирования permalink
- `superset-frontend/src/dashboard/components/PropertiesModal/index.tsx`
  - `certification_details` переключены с single-line input на textarea с markdown/line-break hint

### J. Time V2, native filter config и Explore data table

Эти файлы вошли в итоговый diff после снимка от 2026-03-23 и дополняют реестр до текущих 144 файлов:

- `docs/internal/prod-customizations.md`
- `superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/EchartsTimeseries.tsx`
- `superset-frontend/src/constants.ts`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/DefaultValue.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/FiltersConfigForm.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigForm/constants.ts`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal.test.tsx`
- `superset-frontend/src/dashboard/components/nativeFilters/FiltersConfigModal/FiltersConfigModal.tsx`
- `superset-frontend/src/explore/components/DataTableControl/index.tsx`
- `superset-frontend/src/explore/components/DataTablesPane/components/SingleQueryResultPane.tsx`
- `superset-frontend/src/explore/components/DataTablesPane/components/useResultsPane.tsx`
- `superset-frontend/src/explore/components/DataTablesPane/types.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/DateFilterControlV2.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/DateFilterLabel.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/components/CalendarRangeFrame.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/components/index.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/index.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/tests/DateFilterLabel.test.tsx`
- `superset-frontend/src/explore/components/controls/DateFilterControl/tests/utils.test.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/types.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/utils/constants.ts`
- `superset-frontend/src/explore/components/controls/DateFilterControl/utils/dateFilterUtils.ts`
- `superset-frontend/src/filters/components/Time/BaseTimeFilterPlugin.tsx`
- `superset-frontend/src/filters/components/Time/TimeFilterPlugin.tsx`
- `superset-frontend/src/filters/components/TimeV2/TimeFilterPlugin.tsx`
- `superset-frontend/src/filters/components/TimeV2/index.ts`
- `superset-frontend/src/filters/components/index.ts`
- `superset/models/helpers.py`

Таким образом, в документе теперь покрыты:

- все крупные смысловые блоки
- все supporting files
- все тесты
- все assets
- все минимальные diff из итогового состояния ветки

## Что история коммитов говорит дополнительно

По истории видно, что в процессе разработки было много промежуточных решений, но для практической работы с форком главным остаётся именно финальный diff. История ниже нужна не для того, чтобы объявить её “мусором”, а чтобы при будущем merge не перепутать активные изменения с уже откатанными попытками.

Это важно помнить: не всё, что есть в `git log`, надо сохранять в новой версии.

### Явно экспериментальные темы, которые уже были откатаны

- AG Grid state persistence в URL / permalinks / sessionStorage
- row grouping в кастомном AG Grid plugin
- несколько подходов к row buffer и smooth scroll в марте 2026
- несколько промежуточных вариантов dark theme/header fixes
- несколько промежуточных вариантов empty footer gap fixes
- ранние попытки переноса pagination toolbar, которые потом были заменены другой реализацией

Вывод:

- если этих изменений нет в финальном diff, их не нужно специально переносить при апгрейде
- они полезны только как исторический контекст

### Коммиты, похожие на backport/upstream sync, а не на вашу кастомную бизнес-логику

- `fix(Tabs): prevent infinite rerenders with nested tabs` и связанные тесты
- merge из `dev` в `prod` и обратно
- технические `.gitignore` / build / local requirements правки

Вывод:

- такие изменения сначала стоит искать уже в целевой версии Superset
- если они там есть, свои старые патчи можно не тащить

## Быстрый чек-лист перед следующим апгрейдом

### Обязательно проверить и классифицировать

- `Table V2_icover` custom plugin
- pivot/table renderer patches
- `WELCOME_DASHBOARD_CATALOG`
- `welcome_dashboard_rank` + celery snapshot/warmup задачи
- `DISABLE_CHART_THUMBNAILS` и deferred thumbnail loading
- `TimeV2`, calendar/monthly range behavior и совместимость сохранённых native filters
- `Dockerfile.prod` и frontend build wiring

### С высокой вероятностью можно уменьшить или выбросить, если upstream уже покрывает

- отдельные layout/visual fixes для dashboard cards и tooltip
- часть table/pivot fixes
- upstream/backport fixes из `dev`

## Карта задач Codex, которые помогли восстановить смысл

Это не полный список всех задач, а только те, что хорошо совпали с финальным diff:

- `Перенести блок Page size вверх`
- `Применить CSS для заголовков ag grid`
- `Удалить фильтр из заголовка`
- `Добавить сброс фильтров в Table v2`
- `Добавить закрепление колонок Pivot`
- `Перенести conditional formatting`
- `Добавить фильтры и топ дашборды`
- `Добавить флаг отключения thumbnail`
- `Добавить автозаполнение thumbnail`

## Как поддерживать этот документ дальше

После каждой заметной доработки в `prod` желательно обновлять здесь:

- что изменено
- зачем изменено
- где лежит код
- нужно ли это сохранять при апгрейде
- нет ли уже эквивалента в новой версии Superset

Если блок был полностью удалён или заменён upstream-реализацией, не удаляйте запись молча. Лучше перевести её в статус `больше не актуально`, чтобы история решений не потерялась.
