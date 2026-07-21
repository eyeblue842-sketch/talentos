# Known Issues

Date: Tuesday, July 21, 2026

| Issue | Severity | Module | Workaround | Target Milestone |
|---|---|---|---|---|
| Public footer encoding still needs cosmetic cleanup | Low | Public Website | Cosmetic only; no workflow impact | Future polish |
| `Application` and `JobApplication` model overlap still increases future ATS and analytics maintenance complexity | Medium | Database / ATS | Extend the current models carefully and avoid parallel systems | Future schema consolidation |
| Prisma generate on Windows can still fail transiently if local processes hold Prisma engine DLLs | Medium | Tooling / Prisma | Retry `npx prisma generate` from the backend workspace after stopping repo-local dev processes | Operational discipline |
| Frontend test output still emits jsdom canvas warnings | Low | Testing | Warning only; the current suite still passes | Future test-environment cleanup |
| Interview reminders still lack a general scheduled worker and remain limited to current immediate or near-term behavior | Medium | Interview / Notifications | Validate reminder behavior through close-to-now schedules during manual QA | Future worker automation |
| Offer expiry and reminder automation still resolve on access or service invocation rather than a scheduled worker | Medium | Offer / Notifications | Validate expiry through manual access flows until worker automation exists | Future worker automation |
| Worker processing is operational, but long-term queue throughput, retention tuning, and back-pressure behavior still need staging and production observation | Medium | Workers / Operations | Use the current persisted task model, Redis wakeups, and dead-letter visibility while tuning with real traffic | Post-Milestone 8 operations |
| Only the disabled intelligence provider and one configurable OpenAI-compatible adapter are implemented today | Medium | Intelligence / Providers | Use the current provider abstraction and enable additional adapters later without changing feature services | Future provider expansion |
| CI/CD staging deployment remains a documented placeholder until environment-specific credentials, registries, and hosts are finalized | Medium | CI/CD | Use the validation pipeline and documented deployment guide until staging secrets are wired | Post-Milestone 8 operations |
| Enterprise admin role definitions support central permissions, but unified field-level enforcement is not yet applied across every older recruiter workflow | Medium | Enterprise Admin / RBAC | Use the central permission layer for new/admin intelligence work and preserve existing organisation checks elsewhere | Future authorization consolidation |
| Intelligence prompt registry is code-based and read-only; no safe prompt-editing UI exists | Low | Intelligence Governance | Use versioned code prompts and admin visibility only | Future governance tooling |
| Resume Builder integration remains deep-link based only; SSO, API sync, and webhook callbacks are intentionally deferred until the standalone Resume Builder SaaS exists | Medium | Resume Builder Integration | Use configured deep links and uploaded resume assets for current workflows | Future integration phase |
| Candidate account deletion remains a deactivation request workflow, not destructive deletion | Low | Candidate Account | Use deactivation requests and data export until retention and compliance policy is expanded | Future compliance phase |
