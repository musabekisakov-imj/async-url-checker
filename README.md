# URL Checker

Тестовое fullstack-приложение: асинхронно проверяет доступность списка URL через HTTP `HEAD`.

**Live demo:** https://async-url-checker-web.vercel.app

**API:** https://async-url-checker-api.vercel.app

## Возможности

- Создание заданий со списком URL.
- Фоновая проверка URL; до 5 одновременных `HEAD`-запросов внутри одного задания.
- Параллельная обработка разных заданий.
- Искусственная задержка 0–10 секунд перед сохранением каждого результата.
- Список заданий, детальный прогресс, HTTP-коды и ошибки.
- Отмена задания: новые URL не стартуют; уже начатые запросы завершаются, но статус задания остаётся `cancelled`.
- React-интерфейс с Zustand, корректным polling и защитой от устаревших ответов.

## Архитектура

`apps/api` — Express + TypeScript. Локально хранит задания в памяти. В Vercel использует Upstash Redis и запускает обработку через `waitUntil`; данные живут 7 дней, список ограничен последними 50 заданиями.

`apps/web` — React + TypeScript + Zustand. API-слой изолирован от компонентов. Polling активного задания останавливается при выборе другого/создании нового; ответ старого `jobId` игнорируется.

Production-развёртывание состоит из двух Vercel-проектов. Frontend проксирует `/api/*` в Express API, поэтому браузер работает с одним origin.

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

Одно задание принимает от 1 до 50 URL. Лимит нужен, чтобы худший сценарий с таймаутами и искусственной задержкой укладывался в длительность фоновой Vercel Function.

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

При локальном запуске данные хранятся только в памяти и удаляются после перезапуска API. Production использует Redis, но не имеет авторизации, retry-механизма и полноценной персистентной очереди. Для реального production также нужны rate limiting и SSRF-защита от обращений к приватным сетям.

Отмена не прерывает уже отправленный `HEAD`-запрос. Она помечает задание отменённым, прекращает запуск URL со статусом `pending` и помечает их `cancelled`. Уже стартовавшие URL завершаются, но не переводят задание обратно в активное состояние.

## Структура

```text
.
├── apps/
│   ├── api/       # Express API, memory/Redis store, background worker
│   └── web/       # React UI, Zustand store, API client
├── docker-compose.yml
├── package.json
└── tsconfig.base.json
```
