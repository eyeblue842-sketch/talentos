# Known Issues

Date: Tuesday, July 21, 2026

| Issue | Severity | Module | Workaround | Target Milestone |
|---|---|---|---|---|
| Admin module remains placeholder-oriented and not backend-complete | High | Admin | Limit use to access/path validation only | Milestone 5 |
| Candidate onboarding page remains placeholder-oriented | Medium | Candidate Journey | Use profile, settings, applications, and offer pages directly | Milestone 5 |
| Resume Builder still behaves as a demo/local-save experience | Medium | Candidate Resume | Use resume upload/assets flow for real workflows | Milestone 5 |
| Footer encoding issue still needs cleanup | Low | Public Website | Cosmetic only | Milestone 5 |
| `Application` and `JobApplication` model overlap still increases future ATS/offer maintenance complexity | Medium | Database / ATS | Extend current models carefully and avoid parallel systems | Milestone 5 |
| Prisma generate on Windows can still fail transiently if local processes hold Prisma engine DLLs | Medium | Tooling / Prisma | Retry `npx prisma generate` from the backend workspace after stopping repo-local dev processes | Milestone 5 |
| Frontend test output still emits jsdom canvas warnings | Low | Testing | Warning only; current suite still passes | Milestone 6 |
| Interview reminders are emitted safely when a round is scheduled inside the 24-hour or 1-hour window, but there is still no background reminder worker for future scheduled dispatch | Medium | Interview / Notifications | Reschedule close-to-now rounds during manual QA to validate reminder emission | Milestone 5 |
| Offer expiry and reminder automation currently resolve on access rather than through a scheduled worker | Medium | Offer / Notifications | Validate expiry through manual access flows until worker automation exists | Milestone 5 |
| Offer template management is still a default-template baseline rather than a multi-template designer | Medium | Offer | Use the current default organization template and versioned PDF output | Milestone 5 |
