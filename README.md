# URL Checker

Тестовое fullstack-приложение: асинхронно проверяет доступность списка URL через HTTP `HEAD`.

## Возможности

- Создание заданий со списком URL.
- Фоновая проверка URL; до 5 одновременных `HEAD`-запросов внутри одного задания.
- Параллельная обработка разных заданий.
- Искусственная задержка 0–10 секунд перед сохранением каждого результата.
- Список заданий, детальный прогресс, HTTP-коды и ошибки.
- Отмена задания: новые URL не стартуют; уже начатые запросы завершаются, но статус задания остаётся `cancelled`.
- React-интерфейс с Zustand, корректным polling и защитой от устаревших ответов.

## Архитектура

`apps/api` — Express + TypeScript. Хранит задания в памяти и запускает worker на каждое новое задание.

`apps/web` — React + TypeScript + Zustand. API-слой изолирован от компонентов. Polling активного задания останавливается при выборе другого/создании нового; ответ старого `jobId` игнорируется.

## API

### Создать задание

```http
POST /api/jobs
Content-Type: application/json

{"urls":["https://example.com","https://httpbin.org/status/404"]}
```

```json
{"jobId":"..."}
```

### Список заданий

```http
GET /api/jobs
```

Возвращает `id`, `createdAt`, статус, число URL и статистику `success` / `error`.

### Детали задания

```http
GET /api/jobs/:id
```

Для каждого URL: `url`, `status`, `httpStatus`, `error`, `startedAt`, `finishedAt`, `durationMs`.

### Отменить задание

```http
DELETE /api/jobs/:id
```

## Статусы

Задание: `pending`, `in_progress`, `completed`, `cancelled`, `failed`.

URL: `pending`, `in_progress`, `success`, `error`, `cancelled`.

`success` означает HTTP-код 200–399. Коды 400–599 и ошибки сети, TLS или timeout дают `error`; HTTP-код сохраняется в `httpStatus`, если ответ получен.

## Локальный запуск

Требования: Node.js 20+ и npm 9+.

```bash
npm install
npm run dev
```

Откройте `http://localhost:5173`. API доступен на `http://localhost:3000`.

## Docker

```bash
docker compose up --build
```

Интерфейс: `http://localhost:8080`. API: `http://localhost:3000`.

## Проверки

```bash
npm run test
npm run typecheck
npm run build
```

## Ограничения и семантика отмены

Данные хранятся только в памяти: перезапуск API удаляет все задания. Нет авторизации, персистентной очереди, retry-механизма и распределённой обработки. Для production также нужны лимиты запросов и SSRF-защита от обращений к приватным сетям.

Отмена не прерывает уже отправленный `HEAD`-запрос. Она помечает задание отменённым, прекращает запуск URL со статусом `pending` и помечает их `cancelled`. Уже стартовавшие URL завершаются, но не переводят задание обратно в активное состояние.

## Структура

```text
.
├── apps/
│   ├── api/       # Express API, in-memory store, worker
│   └── web/       # React UI, Zustand store, API client
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```
