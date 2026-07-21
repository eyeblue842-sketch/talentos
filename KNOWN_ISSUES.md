# Known Issues

Date: Tuesday, July 21, 2026

| Issue | Severity | Module | Workaround | Target Milestone |
|---|---|---|---|---|
| Offer module is still missing | Critical | ATS / Offer | Stop workflow after interview decision and use `READY_FOR_OFFER` as the handoff state | Milestone 4 |
| Admin module remains placeholder-oriented and not backend-complete | High | Admin | Limit use to access/path validation only | Milestone 5 |
| Candidate onboarding page remains placeholder-oriented | Medium | Candidate Journey | Use profile, settings, and existing candidate workspace flows directly | Milestone 4 |
| Resume Builder still behaves as a demo/local-save experience | Medium | Candidate Resume | Use resume upload/assets flow for real workflows | Milestone 4 |
| Footer encoding issue still needs cleanup | Low | Public Website | Cosmetic only | Milestone 4 |
| `Application` and `JobApplication` model overlap still increases future ATS/offer maintenance complexity | Medium | Database / ATS | Extend current models carefully and avoid parallel systems | Milestone 4 |
| Prisma generate on Windows can still fail transiently if local processes hold Prisma engine DLLs | Medium | Tooling / Prisma | Retry `npx prisma generate` from the backend workspace after stopping repo-local dev processes | Milestone 4 |
| Frontend test output still emits jsdom canvas warnings | Low | Testing | Warning only; current suite still passes | Milestone 6 |
| Interview reminders are emitted safely when a round is scheduled inside the 24-hour or 1-hour window, but there is still no background reminder worker for future scheduled dispatch | Medium | Interview / Notifications | Reschedule close-to-now rounds during manual QA to validate reminder emission | Milestone 4 |
