# Known Issues

Date: Tuesday, July 21, 2026

| Issue | Severity | Module | Workaround | Target Milestone |
|---|---|---|---|---|
| Docker CLI is not installed in the current environment, so `docker compose config` and `docker compose build` could not be validated here | Medium | DevOps / Release | Validate Docker assets on a machine with Docker Desktop or Docker Engine installed | Feature freeze / staging |
| Google Workspace and Zoom integrations were implemented but not exercised against live credentials in this environment | Medium | Interview Scheduling | Use provider mocks for automated tests and complete manual QA in staging with real credentials | Feature freeze / UAT |
| Initial setup currently supports an optional logo URL rather than direct binary logo upload | Low | Setup Wizard | Use an existing hosted image URL during bootstrap, then update branding later through organization settings | Future polish |
| Dedicated interviewer-only UI remains lighter than recruiter and candidate surfaces; core access is present but polish is limited | Low | Interview Scheduling UI | Use `/recruiter/interviews` plus existing feedback workflows until a deeper interviewer workspace polish pass | Future polish |
| `Application` and `JobApplication` model overlap still increases future ATS and analytics maintenance complexity | Medium | Database / ATS | Extend current models carefully and avoid parallel systems | Future schema consolidation |
| Prisma generate on Windows can still fail transiently if local processes hold Prisma engine DLLs | Medium | Tooling / Prisma | Stop repo-local dev processes and rerun `npx prisma generate` from `backend` | Operational discipline |
| Frontend test output still emits jsdom canvas warnings | Low | Testing | Warning only; the suite passes | Future test-environment cleanup |
| Public footer encoding still needs cosmetic cleanup | Low | Public Website | Cosmetic only; no workflow impact | Future polish |
