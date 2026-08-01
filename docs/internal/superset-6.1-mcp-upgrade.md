# Обновление Superset до 6.1.0 и интеграция MCP

Последнее обновление: 2026-07-15

## Цель

Обновить корпоративный форк до Superset 6.1.0, развернуть отдельный MCP-сервис и подключить Codex по принципу минимальных привилегий: сначала только чтение и preview, операции записи — только после явного подтверждения.

## План программы

1. Зафиксировать текущий production: image/tag/digest, runtime commit и реальные кастомизации форка.
2. Обновить форк до Superset 6.1.0 в отдельной ветке, разрешить конфликты, прогнать миграции и тесты.
3. Развернуть staging: Superset 6.1.0 и отдельный MCP-сервис.
4. Настроить безопасный доступ: отдельный `codex-agent`, JWT, минимальный RBAC, без прямого доступа к БД.
5. Подключить Codex к MCP: сначала чтение и preview; записи — только с подтверждением.
6. Провести пилот: dataset → три chart → проверка → сохранение → draft dashboard.
7. После успешного пилота добавить SQL/virtual datasets, аудит действий и контролируемый rollout в production.

## Статус

| Этап | Статус на 2026-07-15 | Результат / следующий gate |
|---|---|---|
| 1. Снимок production | В работе | Репозиторий и кастомизации описаны; live image/tag/digest/runtime SHA ещё не подтверждены. |
| 2. Upgrade branch | Не начат | Начинать только после закрытия live production snapshot. |
| 3. Staging | Не начат | Нужны отдельные Superset metadata DB, Redis/Celery и MCP deployment boundary. |
| 4. Безопасный доступ | Не начат | Нужны отдельный service identity, JWT lifecycle и минимальный RBAC. |
| 5. Codex → MCP | Не начат | Первая версия должна запрещать запись по умолчанию. |
| 6. Пилот | Не начат | Dataset → 3 chart → validation → save → draft dashboard. |
| 7. Rollout | Не начат | Только после результатов пилота, аудита и rollback plan. |

## Подтверждённый снимок репозитория

Remote: `https://github.com/IcoverLLC/superset.git`.

Состояние после `git fetch origin --prune`:

| Ref | Commit | Что подтверждено |
|---|---|---|
| `origin/prod` | `e6b3d5f561b0a97dae86199deb71dd231f1d095d` | Локальная `prod` совпадает с remote; commit от 2026-04-07. |
| `origin/dev` | `f37d9dcb84ebbad68c19ccca17ad1d247087e473` | Локальная `dev` совпадает с remote; default branch; commit от 2026-06-24. |
| `origin/6.0.0` | `6a1c30e5e7c3e28d0549c9c2ac0ff61607f26a2f` | Входит в историю `prod` и `dev`; version в frontend package — `6.0.0`, subject commit упоминает `6.0.0rc4`. |
| `origin/master` | `70b95ca1b98d6b8b2d6f591cd9a79795abd38ba6` | Отдельная устаревшая upstream-линия форка, не база текущих веток. |

Отношения веток:

- `prod` целиком входит в историю `dev`.
- `dev` опережает `prod` на 12 коммитов.
- `origin/6.0.0` входит в историю `prod`; `prod` опережает его на 482 коммита.
- `origin/6.0.0` входит в историю `dev`; `dev` опережает его на 494 коммита.
- В clone нет Git tags.

`dev` отличается от `prod` на 27 файлов (`1633` добавления, `139` удалений). Основные dev-only темы: дальнейшие исправления календарного фильтра, новый `TimeGrainV2`, collapsible dashboard rows и локальный `AGENTS.md`.

Важно: имя ветки `origin/6.0.0` и version `6.0.0` в package не доказывают, что база соответствует официальному финальному release 6.0.0. Для upgrade нужно отдельно зафиксировать официальный tag/commit 6.1.0 и проверить lineage.

Практическая интерпретация: имена и topology поддерживают гипотезу «`prod` — production-кандидат, `dev` — разработка», но реальный deploy этой гипотезой не доказывается.

## Кастомизации форка

Authoritative карта находится в [prod-customizations.md](prod-customizations.md).

Крупные активные блоки:

1. Отдельный chart plugin `Table V2_icover` / `ag-grid-table-custom`.
2. Правки штатных table, pivot, ECharts и BigNumber.
3. Кастомный welcome/dashboard catalog и UI списков.
4. Snapshot-модель top dashboards, migration и Celery-задачи.
5. Управление thumbnails и доработки screenshot pipeline.
6. `Dockerfile.prod`, локальные Python requirements и frontend build wiring.
7. `TimeV2`, календарные/monthly диапазоны и исправления Explore data table.

Текущий итоговый diff `origin/6.0.0...prod`:

- 144 файла
- 14 748 добавлений
- 613 удалений
- 482 коммита, включая 169 merge-коммитов и 54 revert-коммита

## Что не подтверждено

Репозиторий не содержит достаточных данных, чтобы доказать:

- какая ветка реально развернута на `bi.icover.ru`
- точное имя production image и registry
- image tag и immutable digest
- runtime commit SHA
- какой pipeline собирает и публикует image

Публичная проверка `https://bi.icover.ru/health` 2026-07-15 вернула `200 OK`. Неавторизованная login-страница не раскрыла `version_string`, `version_sha` или `build_number`. Авторизованный браузер и production host в текущей сессии недоступны.

## Gate для завершения этапа 1

До создания upgrade branch нужно получить и записать один согласованный production snapshot:

1. Имя запущенного image, tag и digest из orchestrator/container runtime.
2. Runtime `Version` и `SHA` из Superset About либо из `superset/static/version_info.json` внутри запущенного image.
3. Соответствие runtime SHA commit в репозитории и ветке.
4. Ссылку на build/deploy pipeline или описание ручной процедуры сборки.
5. Дату снимка, окружение и ответственного, который подтвердил соответствие.

Не следует начинать миграции, менять production, выполнять DDL/DML или считать `origin/prod` доказанным production source до закрытия этого gate.

## Следующий технический шаг после gate

Создать отдельную upgrade branch от подтверждённого production commit и добавить официальный Superset 6.1.0 как явно зафиксированную upstream base. После этого построить новую трёхстороннюю карту:

- upstream 6.0.0 → upstream 6.1.0
- upstream 6.0.0 → текущий fork production
- итоговый fork production → upgrade candidate

Для каждого блока из `prod-customizations.md` принять одно решение: `перенести`, `заменить upstream-реализацией`, `удалить как неактуальный`.
