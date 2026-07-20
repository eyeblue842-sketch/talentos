# Known Issues

Date: July 20, 2026

| Issue | Severity | Module | Workaround | Target Milestone |
|---|---|---|---|---|
| Offer module is still missing | Critical | ATS / Offer | Stop workflow at ATS and interview-ready stages | Milestone 3 |
| Admin module remains placeholder-oriented and not backend-complete | High | Admin | Limit use to access/path validation only | Milestone 5 |
| Candidate onboarding page remains placeholder-oriented | Medium | Candidate Journey | Use profile, settings, and existing candidate workspace flows directly | Milestone 4 |
| Resume Builder still behaves as a demo/local-save experience | Medium | Candidate Resume | Use resume upload/assets flow for real workflows | Milestone 4 |
| Footer encoding issue still needs cleanup | Low | Public Website | Cosmetic only | Milestone 4 |
| `Application` and `JobApplication` model overlap still increases future ATS/offer maintenance complexity | Medium | Database / ATS | Extend current models carefully and avoid parallel systems | Milestone 3 |
| Prisma generate on Windows can still fail if repo-local dev processes hold Prisma engine DLLs | Medium | Tooling / Prisma | Stop repo-local `next dev` and `nodemon` before `npx prisma generate` | Milestone 3 |
| Frontend test output still emits jsdom canvas warnings | Low | Testing | Warning only; current suite still passes | Milestone 6 |
| Invitation acceptance for recruiters with multiple active organisations needs broader manual QA | Medium | Recruiter Workspace | Use the invite flow, then verify the active workspace context explicitly | Milestone 3 |
