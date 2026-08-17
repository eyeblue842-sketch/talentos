# Backend Test Database

Backend tests require an explicit PostgreSQL test target.

## Environment loading

`backend/env-bootstrap.js` loads, in order (first one to set a variable wins):

1. `backend/.env.test.local` — **private, git-ignored.** This is the only place a real `TEST_DATABASE_URL`/`TEST_DIRECT_URL` should live on a developer machine. Create this file yourself; it is never committed.
2. `backend/.env.test` — tracked in git, contains only non-operational placeholders (`REPLACE_WITH_...`). It must never hold a real, working credential.
3. `backend/.env`

The test runner requires `TEST_DATABASE_URL` and uses it as `DATABASE_URL`.
`TEST_DIRECT_URL` is optional and falls back to `TEST_DATABASE_URL`.

If `TEST_DATABASE_URL`/`TEST_DIRECT_URL` are missing, or are still the tracked `REPLACE_WITH_...` placeholders, backend tests fail at startup with a clear configuration error instead of silently running against a placeholder or falling back to any shared/production credential.

Alternatively, export `TEST_DATABASE_URL`/`TEST_DIRECT_URL` directly as process environment variables (e.g. in CI secrets) instead of using `.env.test.local` — an already-set environment variable also takes precedence over both tracked files.

## Recommended setup

Use a dedicated database or an isolated schema such as `careeriz_test`.

Create `backend/.env.test.local` (git-ignored) with:

```env
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=careeriz_test
TEST_DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=careeriz_test
```

Do not point these variables at a production database. Do not add real values to `backend/.env.test` — that file is tracked in git.

## Commands

Run from `backend/`:

```bash
npm run db:test:status
npm run db:test:migrate
npm run test:integration
```

Reset only an isolated test target:

```bash
npm run db:test:reset
```
