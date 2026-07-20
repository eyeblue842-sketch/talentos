# Backend Test Database

Backend tests require an explicit PostgreSQL test target.

## Environment loading

`backend/env-bootstrap.js` loads:

1. `backend/.env.test`
2. `backend/.env`

The test runner then requires `TEST_DATABASE_URL` and uses it as `DATABASE_URL`.
`TEST_DIRECT_URL` is optional and falls back to `TEST_DATABASE_URL`.

If `TEST_DATABASE_URL` is missing, backend tests fail at startup with a clear configuration error.

## Recommended setup

Use a dedicated database or an isolated schema such as `careeriz_test`.

Example placeholders:

```env
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=careeriz_test
TEST_DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=careeriz_test
```

Do not point these variables at a production database.

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
