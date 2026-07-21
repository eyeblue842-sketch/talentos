# API Reference

Base backend URL: `http://localhost:5000/api`

## Auth

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/email-verification/request`
- `POST /auth/email-verification/confirm`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/session`
- `POST /auth/password-reset/confirm`

## Public

- `GET /public/jobs`
- `GET /public/jobs/:slug`
- `GET /public/companies/:slug`

## Candidate

- `GET /candidate/profile`
- `PATCH /candidate/profile`
- `GET /candidate/resumes`
- `POST /candidate/resumes`
- `GET /candidate/resumes/:assetId/download`
- `POST /candidate/applications`
- `POST /candidate/applications/validate`
- `GET /candidate/applications`
- `GET /candidate/applications/:applicationId`
- candidate notifications, saved jobs, export, recent jobs, and related self-service routes

## Recruiter Core

- jobs CRUD and screening routes under `/jobs`
- recruiter ATS routes under `/ats`
- recruiter resume search routes under `/resumes/search`
- requisition, members, notifications, and recruiter dashboard routes under existing recruiter APIs

## Enterprise Admin

- admin routes under `/admin/**`
- organization profile and unit management
- users and invitations
- role definitions
- settings and workflow administration
- audit
- notification templates
- feature flags
- background-job visibility
- analytics

## Intelligence

- `GET /intelligence/health`
- `GET /intelligence/governance`
- `POST /intelligence/feedback`
- `POST /intelligence/resume`
- `POST /intelligence/match`
- `POST /intelligence/match/batch`
- `POST /intelligence/job`
- `POST /intelligence/interview`
- `POST /intelligence/search/parse`
- `POST /intelligence/analytics/insight`

## Health

- `GET /health`

## Worker and Operations Notes

- background workers are internal runtime processes and do not expose a public worker-control API in this milestone
- admin background-job visibility remains available through existing admin routes

## Notes

- All recruiter, admin, ATS, offer, and intelligence routes are organization-scoped through server-side authorization helpers.
- Intelligence routes require both permission and feature gating where configured.
- Candidate-facing routes enforce candidate ownership and do not expose recruiter-private data.
