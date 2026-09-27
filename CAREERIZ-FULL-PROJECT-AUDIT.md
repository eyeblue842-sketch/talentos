# CAREERIZ — FULL PROJECT AUDIT

**Type:** Read-only architecture, product & security review
**Reviewed branch:** `develop` (working tree at time of review)
**Date:** 2026-09-16
**Method:** Repository evidence only — code traced Frontend → Route → Controller → Service → Authorization → DB → Worker. Completion reports, README claims and UI labels were treated as unverified until confirmed in code.

> This document is analysis only. No application source was modified, no migrations generated, no destructive commands run.

---

## A. Executive Summary

Careeriz is a **substantially built, multi-tenant recruitment platform** — far past prototype. It is a Node/Express + Prisma/PostgreSQL backend, a Next.js (App Router) frontend, a dedicated background **worker** process, a separate **document-processor** service, and OpenSearch/Elasticsearch for candidate search. The Prisma schema defines **~100 models and ~75 enums** spanning organisations, memberships, jobs, applications, interviews, offers, resumes, resume-import batches, an AI/"intelligence" subsystem, networking, messaging, notifications, and a full billing/subscription domain.

The engineering quality of the **core infrastructure is high**:

- **Background-task engine** (`backgroundTaskService.js`) has optimistic-lock claiming, leases, lease renewal, expired-lease recovery to retry/dead-letter, idempotency keys, and jittered exponential backoff — genuinely production-grade.
- **Resume Search V2** (`resumeSearchV2/*`) is a real OpenSearch Boolean engine: MUST / SHOULD / MUST_NOT keyword modes, phrase matching, synonyms/concept variants, salary exclusion from `_source`, signed pagination cursors, and entitlement + visibility gating.
- **Serializers** carry an explicit deny-list (`PUBLIC_JOB_PRIVATE_FIELD_NAMES`) that strips AI provider metadata, prompts, diagnostics, token usage and cost from public output — the §11 leak concern is actively defended.
- Tech-debt markers are almost absent (1 TODO/FIXME across the whole app).

The gaps are mostly about **product scope vs. vision**, plus a few real defects:

1. There is **no true central/platform-level resume databank**. Bulk import, dedup, and the resume index are all **scoped to an organisation** (`auth(['RECRUITER','ADMIN'])`, `organisationId` filters everywhere). The "platform admin imports millions of resumes into one shared corpus" vision (§4/§7) is **not** what the code does today.
2. **Two parallel application models** coexist — `Application` (recruiter ATS pipeline) and `JobApplication` (candidate portal V2 submission). This is a genuine architectural fork that risks pipeline/candidate disconnect.
3. **Public job visibility** is centrally enforced, but the `hideFromOwnEmployees` / exclude-specific-companies rule from the vision is **only implemented on the recruiter search side**, not the public portal.
4. **Two search stacks** (V1 `candidateSearchOrchestrator` + V2 OpenSearch) live behind a feature flag — V1 is legacy and should be sunset once V2 is default.
5. A **live-looking OpenAI API key sits in plaintext `.env`** on disk (gitignored, not in history) — rotate it.

**Verdict in one line:** a strong, well-architected **single-tenant-per-organisation ATS + recruiter sourcing product with real AI and search**, that is **not yet** the "central multi-million-resume databank" the vision describes — the databank is per-org, and a few core flows (application model unification, public exclusion rules) need consolidation before it reads as one coherent platform.

---

## B. Intended Product Architecture (the vision)

Careeriz aims to be a full recruitment-technology platform combining a large searchable resume databank, ATS, recruiter sourcing, a candidate portal + professional network + messaging, a public job portal, AI-assisted recruitment (JD generation, parsing, matching), and a **platform administrator** distinct from org recruiters — all multi-tenant with strict client-data isolation, and scalable to millions of resumes. The full lifecycle is Discovery → Search → Shortlist → Screen → Apply → Interview → Evaluate → Offer → Hire.

## C. Current Architecture (as built)

| Layer | Technology / location | Notes |
|---|---|---|
| Frontend | Next.js App Router (`frontend/app`) | Candidate `(workspace)`, `recruiter/*`, `admin/*`, public `jobs`/`companies`, `network`, `offers`, `pricing`, `setup`. Has BFF routes under `app/api/*`. |
| Backend API | Express (`backend/src/app.js`) | 26 route modules mounted under `/api/*`; helmet CSP, CORS allow-list, Razorpay raw-body webhook before `express.json`. |
| Worker | `backend/src/worker.js` | Separate process: scheduler loop + worker loop + heartbeat loop; DB-queue or SQS. |
| Document processor | `document-processor/` service (in compose) | Separate service for resume text/document extraction. |
| DB | PostgreSQL 16 (Prisma, `schema.prisma`, 41 migrations) | ~100 models. |
| Cache/Queue | Redis 7 | Wake-queue for tasks, runtime cache, rate limiting. |
| Search | OpenSearch 3.5 (**V2, live behind flag**) + Elasticsearch 8.15 (**legacy/compose**) | `resumeSearchV2/openSearchAdapter.js`. |
| Storage | Local FS (`STORAGE_PROVIDER=local`, `./storage/resumes`); S3/SQS abstractions present | Not yet object-storage in this env. |
| AI | OpenAI (`INTELLIGENCE_PROVIDER=OPENAI`, model `gpt-5`) via provider abstraction | Providers: openai-compatible, bedrock, mock, disabled. |
| External | Razorpay (payments), meeting providers (Zoom/etc.), SMTP email | |

## D. Module Inventory

| Module | Backend | Frontend | DB models | Tests | Status | Key issue |
|---|---|---|---|---|---|---|
| Auth / RBAC | `authService`, `middleware/auth.js`, `platformAdmin.js` | `auth/*`, `hire/*`, `change-password` | User, AuthToken | Yes | **IMPLEMENTED** | Role-equivalents nuance; verify per-route |
| Organisations / tenancy | `organisationService`, `organisationAccessService` | `recruiter/company`, `members` | Organisation, OrganisationMembership, Units, Settings | Yes | **IMPLEMENTED** | Tenant isolation relies on per-query `organisationId` |
| Jobs | `jobService` | `recruiter/jobs`, `jobs/[slug]` | Job, SavedJob | Yes | **IMPLEMENTED** | Structured Naukri-style schema recently added |
| Applications / ATS | `atsService`, `applicationWorkflowService` | `recruiter/ats`, `jobs/[slug]/apply` | **Application + JobApplication** | Yes | **IMPLEMENTED w/ DEFECTS** | Two application models (see R) |
| Resume databank / search | `resumeSearchV2/*`, `search/*`, `searchService` | `recruiter/database` | CandidateProfile, ResumeAsset, ResumeSearchIndexState | Yes | **IMPLEMENTED (org-scoped)** | Not a central platform databank; V1/V2 duplication |
| Bulk resume import | `resumeImportService`, `resumeImportUtils`, queue | `recruiter/candidates/import` | ResumeImportBatch/Item | Yes | **IMPLEMENTED (org-scoped)** | Recruiter-scoped, not platform-admin |
| Interviews | `interviewService`, meeting providers | `recruiter/interviews` | InterviewProcess/Round/Feedback/Meeting | Yes | **IMPLEMENTED** | Rich; meeting-provider integration |
| Offers | `offerService`, `offerDocumentService` | `offers/*` | Offer, OfferComponent/Approval/Comment/AccessToken | Yes | **IMPLEMENTED** | Token-gated external access |
| AI / Intelligence | `intelligence/*` (23 services) | `admin/intelligence`, JD tools | Intelligence*, CandidateJobMatch*, JobDescription* | Yes | **IMPLEMENTED** | Provider metadata deny-list present |
| Networking | `networkService` | `network/*`, `recruiter/network` | UserConnection, CompanyFollow, Block, PrivacySettings | Partial | **IMPLEMENTED** | Integration into hiring flow thin |
| Messaging | `messagingService` | `recruiter/messages` | DirectConversation, DirectMessage | Partial | **IMPLEMENTED** | No realtime transport (polling/manual) |
| Notifications | `notificationService` | `*/notifications` | Notification, NotificationTemplate | Yes | **IMPLEMENTED** | Single coherent model |
| Public portal | `publicPortalService` | `jobs`, `companies/[slug]` | Job (+visibility) | Partial | **IMPLEMENTED w/ GAP** | No `hideFromOwnEmployees` on public side |
| Billing / subscriptions | `billingService`, `razorpayService`, entitlements | `pricing`, `recruiter/billing`, `admin/billing` | ProductPlan, Purchase, Subscription, Invoice, Ledger | Yes | **IMPLEMENTED** | Sizeable, gates resume/ATS access |
| Platform admin | `adminService`, `requirePlatformAdmin` | `admin/*` | FeatureFlag, AuditLog, PlatformSetupState | Yes | **PARTIAL** | Org-scoped admin ≠ full platform overseer |
| Requisitions | `requisitionService` | `recruiter/requisitions` | JobRequisition | Yes | **IMPLEMENTED** | Approval workflow |
| Resume builder | `resumeBuilderService` | `resume-builder` | ResumeBuilder | Yes | **IMPLEMENTED** | |

## E. Candidate Journey (as built)

Register (`/auth/candidate`, `/api/auth`) → build/edit profile & upload resume (`/api/resumes/upload`, candidate `(workspace)`) → resume parsing (async task) → discover/search public jobs (`/api/public`, `/jobs`) → apply via V2 flow (`/api/candidate/applications` → `JobApplication` + screening answers + resume snapshot, rate-limited) → track applications (`/api/candidate/applications`, withdraw) → interviews (candidate-facing meeting RSVP) → offers (token access page) → networking/messaging where permitted. **Works end-to-end**, but candidate-submitted `JobApplication` and recruiter-side `Application` pipeline are different tables (see R) — verify the bridge in `atsService`.

## F. Recruiter Journey (as built)

Onboard org (`recruiter/onboarding`, org verification gate) → post structured jobs (`/api/jobs`, AI JD generation) → search resume databank (`/api/resumes/search/v2`, OpenSearch Boolean, entitlement + verified-org gated) → save candidates / talent pools / saved searches → add to ATS & shortlist (`/api/ats/resume-search/*`) → manage pipeline stages (`/api/ats/pipeline`, APPLIED→SHORTLISTED→INTERVIEW_SCHEDULED→SELECTED/REJECTED/WITHDRAWN) → recruiter notes/ratings (`AtsNote`) → schedule interviews + collect feedback → offers + approvals → hire. All recruiter surfaces are gated by `auth(['RECRUITER'])` + `requireResumeDatabaseAccess()`/`requireAtsAccess()` (entitlements) + `requireVerifiedOrganisation()`.

## G. Platform Admin Journey (what admin can ACTUALLY do today)

`admin/*` covers analytics, audit, background-jobs, candidates, feature-flags, intelligence, lookups, notifications, organisation, roles, settings, users, workflow. **But**: `/api/admin/*` routes are, per the code comment in `platformAdmin.js`, "internally scoped to the actor's own organisation," and `auth(['ADMIN'])` is also satisfied by `RECRUITER_ADMIN` (an org admin). A **true platform overseer** (`requirePlatformAdmin()` → `ADMIN`/`PLATFORM_ADMIN`) is used **only for billing reconciliation** endpoints. So today the "admin" is effectively an **organisation admin**; a cross-tenant platform administrator who manages all clients and a central databank is **largely aspirational** (see K, Q).

## H. Resume Databank Architecture (current)

Upload (recruiter, `POST /api/resume-imports`, multer memory, ZIP/files, configurable max) → `ResumeImportBatch` + per-file `ResumeImportItem` → `enqueueBackgroundTask('RESUME_IMPORT_PROCESSING')` (idempotency key, Redis wake + optional SQS) → worker claims with per-type concurrency cap (`resumeImportWorkerConcurrency`) so resume parsing is serialized independently of general worker concurrency → document-processor extracts text → AI resume parser (`services/ai/resume-parser.js`, versioned `RESUME_PARSER_VERSION`) → `detectDuplicateCandidate(organisationId, …)`: exact match on normalized **email / phone / LinkedIn** (org-scoped), plus **name + current-employer** heuristic flagged `suggestedOnly` (review) → create `CandidateProfile` (`source: BULK_IMPORT`, `profileVisibility: RECRUITERS_ONLY`, `searchableProfile` gated on minimum identity) + primary `ResumeAsset` → index into OpenSearch (`ResumeSearchIndexState`). Duplicate resolution UI supports ATTACH_TO_EXISTING / CREATE_SEPARATE / REJECT. **Strong per-org pipeline. Dedup is per-organisation, not global.** No intelligent "updated resume → versioned merge" — resolution is attach-or-separate.

## I. Search Architecture (how recruiter search works today)

Two stacks, selected by `env.resumeSearchV2Enabled`:

- **V1 (legacy):** `searchService.js` → `search/candidateSearchOrchestrator.js` (adapter/Postgres-style candidate search + talent pools/saved searches). Still wired at `GET /api/resumes/search`.
- **V2 (live):** `POST /api/resumes/search/v2` → `resumeSearchV2/service.js` → `queryCompiler.js`:
  - **Indexing:** `indexingService.js` + `documentBuilder.js` + `mapping.js` (schema-versioned), custom synonym analysis (`opensearch/analysis/resume_synonyms_v1.txt`).
  - **Query construction:** each keyword carries a `mode` — `MUST` → `bool.must`, `SHOULD` → `bool.should`, `MUST_NOT` → `bool.must_not`. `minimum_should_match` becomes 1 only when there are no MUST clauses. This is **genuine recruiter Boolean semantics** — `IT` AND `Sales` as two MUST keywords truly requires both, not incidental term co-occurrence. ★Mandatory vs Optional maps cleanly to MUST vs SHOULD.
  - **Matching:** concept variants + synonyms, phrase-first for multi-word/`.+#/` terms, ambiguous-abbreviation handling (it/hr/bd/c via exact `.raw` term + regexp), tuned fuzziness (`AUTO:5,7`, disabled for short/exact terms), field boosts.
  - **Filters:** experience range, locations, industries, employer/title `.raw` terms, previous-titles ALL/ANY, skills (AND), **excluded companies** (must_not), education phrase, notice period, salary (entitlement-gated), completeness, review status; always AND `searchableProfile:true`.
  - **Ranking/sort:** `_score` or profile/resume-updated/experience, with deterministic tiebreakers (candidateId, documentId).
  - **Pagination:** signed cursor (`cursor.js`), `track_total_hits`.
  - **Privacy:** salary fields excluded from `_source`; visibility filter (`visibility.js`) + entitlement (`hasResumeSearchEntitlement`) enforced server-side.

**Assessment:** V2 is the standout module — it correctly implements the mandatory/optional Boolean search the vision asks for. Main risk is the lingering V1 path.

## J. ATS Workflow (mapped)

Job (`Job`) → candidate applies (`JobApplication` + `ApplicationScreeningAnswer` + `ApplicationResumeSnapshot` + `ApplicationTimeline`) **OR** recruiter sources from databank into ATS (`Application`) → screening (screening-question templates + rules, `ScreeningOutcome`) → shortlist (`PipelineStage`) → interview (`InterviewProcess/Round/PanelMember/Meeting`) → feedback (`InterviewFeedback`, recommendation/decision enums) → selection → offer (`Offer` + components + approvals + external token) → hire/reject. **The stage machinery, screening, interview, feedback and offer stages are all present and tested.** The **weak seam** is the two entry paths landing in two different models.

## K. RBAC / Tenant Isolation

- **Global roles** (`UserRole`): CANDIDATE, RECRUITER, ADMIN, plus portal-scoped CANDIDATE_ADMIN, RECRUITER_ADMIN, PLATFORM_ADMIN. Equivalence map: `RECRUITER_ADMIN → [ADMIN, RECRUITER]`, `PLATFORM_ADMIN → [ADMIN]`, `CANDIDATE_ADMIN → [CANDIDATE]`.
- **Enforcement is server-side** on every route via `auth([...roles])`; entitlements (`requireResumeDatabaseAccess`, `requireAtsAccess`) and org verification are additional middleware. Session invalidation via `sessionVersion`; `mustChangePassword` gate. Good.
- **Tenant isolation** is implemented as **per-query `organisationId` scoping** (membership resolved by `organisationAccessService`), not Postgres RLS. This works but is **only as safe as every query remembering its filter** — the primary systemic risk surface. Recommend an isolation test matrix + a repository-level guard.
- **Security risks to review:** (1) `auth(['ADMIN'])` on org-scoped `/api/admin/*` is satisfied by `RECRUITER_ADMIN` — confirm each admin controller re-scopes to the actor's org (the `platformAdmin.js` comment asserts it; verify per-endpoint). (2) IDOR on `/pipeline/:applicationId`, `/resume-imports/:batchId/items/:itemId`, offers — confirm every fetch is org-scoped, not just id-scoped. (3) Cross-org dedup/search leakage — V2 visibility filter + org scoping look correct; add explicit tests.

## L. Public Job Portal

Central enforcement in `buildPublicJobWhere`: `status=OPEN`, `archivedAt=null`, `isPublic=true`, `visibility ∈ {EXTERNAL,BOTH}`, application window/deadline live, org `ACTIVE` + `careersEnabled`. Company pages, featured jobs, aggregation buckets (min bucket size 3 — a nice privacy touch). **Gap:** the vision's `hideFromOwnEmployees` and "exclude specified companies from public visibility" exist **only** in recruiter-side V2 search (`excludedCompanies`), **not** in the public job WHERE. If a client needs to hide postings from their own employees / named competitors on the public portal, that rule is currently unenforced there.

## M. AI Architecture

Provider abstraction (`intelligence/providers`: openai-compatible, bedrock, mock, disabled; runtime = OpenAI/`gpt-5`). Features (`IntelligenceFeature` enum + 23 `intelligence/services`): JD generation/management + output normalizer, candidate matching (retriever → scoring → evidence → ranking, deterministic + LLM), semantic search + skill expansion, query intent/parser, interview intelligence, analytics insights, resume intelligence, governance/redaction. Flow per feature: INPUT → prompt registry → provider → structured output → normalizer/validation → `IntelligenceExecution`/`IntelligenceResult` storage → serialization. **Leak defense confirmed:** `PUBLIC_JOB_PRIVATE_FIELD_NAMES` strips assumptions, rawProviderResponse, prompts, systemInstructions, diagnostics, providerMetadata, token usage, cost, and source/execution IDs from public output. `redaction/projectionService.js` present.

## N. Networking & Messaging

Networking: `UserConnection` (PENDING/ACCEPTED/DECLINED/WITHDRAWN), `CompanyFollow`, `UserBlock`, `NetworkPrivacySettings`, `ConnectionRequestPermission`/`Visibility`; surfaces at `network/*` and `recruiter/network`. Messaging: `DirectConversation`/`DirectMessage` with `DirectMessageType`; CRUD service with authorization, **no realtime transport** (no websocket/SSE in the service; frontend uses no visible interval — likely manual/react-query refetch). Both are **functional but loosely coupled to the hiring workflow** — networking is closer to a standalone LinkedIn-style feature than an integrated sourcing channel today.

## O. Infrastructure

`docker-compose.yml`: postgres, redis, elasticsearch **and** opensearch, backend, worker, document-processor, frontend, with named volumes incl. `resume_storage`. Backend has `Dockerfile` + `Dockerfile.worker`. **Production-readiness concerns:** (1) local FS storage (`STORAGE_PROVIDER=local`) — must move to object storage (S3 abstraction exists). (2) Both ES and OpenSearch running — pick one (OpenSearch is the live V2 target). (3) Live secrets in `.env` on disk. (4) Single-node search/DB in compose — no HA. (5) `gpt-5`/OpenAI dependency for parsing/matching — cost + rate-limit exposure at scale.

## P. Technical Debt

- **Critical:** live OpenAI key in `.env` on disk (rotate); two application models forking the ATS.
- **High:** V1/V2 search duplication behind a flag; org-scoped-only databank vs central-databank vision; public portal missing `hideFromOwnEmployees`/company-exclusion.
- **Medium:** ES + OpenSearch both provisioned; local file storage; messaging lacks realtime; networking/hiring integration thin; verify per-endpoint org re-scoping on `/api/admin/*`.
- **Low:** legacy `searchService.js` shim; assorted `.env.backup*` files in tree; `New Text Document.txt`/dev log files committed to working tree.

## Q. Missing Product Capabilities (vs vision)

1. **Central platform resume databank** — import/dedup/index are per-org; no global corpus, no global dedup, no platform-admin bulk ingestion path.
2. **True Platform Administrator** — most `/api/admin/*` is org-scoped; only billing uses the strict platform gate.
3. **Public-side visibility exclusions** (`hideFromOwnEmployees`, excluded employers).
4. **Explicit contact-info / resume-download entitlement per candidate** — access is currently entitlement-at-the-feature level (can search ⇒ can act), not per-candidate consent/business-rule gating (§9 concern).
5. **Intelligent resume-update merge/versioning** on re-import.
6. **Realtime messaging** and deeper networking↔sourcing integration.

## R. Duplicate / Conflicting Implementations

- **Application models:** `Application` (64 refs — ATS pipeline, dashboard, offers, intelligence, interviews) vs `JobApplication` (25 refs — candidate portal V2 apply, screening, workflow repo). `atsService.js` references **both**. **Highest-value consolidation target** — confirm and document the bridge, or unify.
- **Search:** V1 `candidateSearchOrchestrator` + `searchService.js` shim vs V2 `resumeSearchV2/*`, flag-selected.
- **AI code:** `services/ai/*` (resume parser, older providers) vs `intelligence/providers/*` (newer unified abstraction) — overlapping provider concepts.
- **Search engines:** Elasticsearch + OpenSearch both in compose.

## S. Security Findings (prioritized)

1. **P0 — Live OpenAI key in plaintext `.env`** (+ `.env.backup*`). Gitignored and not in history, but present on disk and visible in this environment. **Rotate now**; move to a secrets manager.
2. **P1 — Tenant isolation depends on per-query `organisationId`** with no RLS backstop. One forgotten filter = cross-tenant leak. Add an isolation test suite + repository guardrails.
3. **P1 — `/api/admin/*` reachable by `RECRUITER_ADMIN` via role-equivalence.** Correct *iff* every admin controller re-scopes to the actor's org. Verify each endpoint; the guarantee currently lives in a comment, not a shared middleware.
4. **P1 — Public portal exclusion rules absent** (`hideFromOwnEmployees`) — jobs meant to be hidden from own employees/competitors are publicly reachable.
5. **P2 — Per-candidate contact/resume-download consent not modeled** — recruiters with the databank entitlement can download resumes for any searchable candidate in their org scope.
6. **P2 — IDOR review** on `:applicationId`/`:itemId`/offer-token routes (confirm org scoping on fetch, not just id).
7. **Positive:** AI-metadata deny-list, salary `_source` exclusion, signed cursors, Razorpay signature verification on raw body, helmet CSP, session-version invalidation.

## T. Scalability Findings

- **100K resumes:** fine. OpenSearch handles the index; per-org partitioning keeps result sets small; worker per-type concurrency prevents parse stampedes.
- **1M resumes:** watch (a) local FS storage — must be object storage; (b) OpenSearch single-node in compose — needs a real cluster + shard strategy; (c) dedup does per-import `findFirst` queries against `CandidateProfile` — index `email`/`normalizedPhoneNumber`/`linkedInUrlNormalized`/`(organisationId,fullName,currentEmployer)` and confirm they exist; (d) AI parse cost/throughput becomes the bottleneck (every resume → LLM call).
- **5M+:** the **per-org databank model itself** is the ceiling for the "central corpus" vision — a global databank would need global dedup (candidate identity resolution across orgs), a partitioned/tiered index, and batched/queued LLM parsing with backpressure (the queue + lease infra is already a good foundation). Pagination via signed cursor is scalable; deep-paging beyond `track_total_hits` limits should use `search_after` (V2 already sorts with tiebreakers, so this is a small step).

## U. Test Coverage Gaps

79 backend + 73 frontend + 5 e2e tests (phase-named: recruiter-ats, application-workflow, candidate-experience, etc.). **Business rules that need explicit tests:**
- Cross-tenant isolation (org A cannot read org B's candidates/applications/notes/offers/import batches via any endpoint).
- `Application` vs `JobApplication` bridge — a candidate submission appears in the recruiter pipeline.
- Public visibility — a non-public/INTERNAL/careers-disabled job is invisible in search **and** by direct slug **and** in company pages **and** apply endpoints.
- Resume-search MUST/MUST_NOT correctness against a seeded index (Boolean semantics).
- AI-metadata non-leak in public JD serialization.
- Duplicate resolution (attach/separate/reject) state transitions and idempotency.

## V. Recommended Target Architecture (evolve, don't rewrite)

Preserve the strong core (task engine, V2 search, provider abstraction, serializer deny-list). Then:
1. **Unify applications** onto one model (likely `JobApplication` as the source of truth, with the ATS pipeline reading it) via an additive migration + backfill — no historical migration edits.
2. **Make V2 search the default**, delete V1 once parity is proven; standardize on **OpenSearch**, drop ES from compose.
3. **Introduce a platform tier**: a real `PLATFORM_ADMIN`-owned central databank as a *separate* index/namespace layered above per-org profiles, with global identity resolution — additive to today's org databank, not a replacement.
4. **Move `hideFromOwnEmployees`/excluded-employer rules into a shared job-visibility helper** used by both public portal and search.
5. **Object storage + secrets manager + search cluster** for production.
6. **Per-candidate contact/download entitlement** model for §9.

## W. Prioritized Roadmap

**P0 — Security / Data Integrity / Broken Core**
- *Rotate the OpenAI key.* Problem: live key in `.env`. Evidence: `.env` line `OPENAI_API_KEY=sk-…`. Impact: account/billing compromise. Fix: rotate + secrets manager. Deps: none. Risk: low.
- *Resolve the two application models.* Problem: `Application` vs `JobApplication` fork. Evidence: 64 vs 25 refs; `atsService` uses both. Impact: candidate submissions may not surface in pipeline / double source of truth. Fix: trace the bridge, add tests, plan unification. Deps: migration. Risk: medium.
- *Tenant-isolation test matrix.* Problem: filter-based isolation, no RLS. Impact: cross-tenant leak. Fix: negative tests across all org-scoped endpoints. Risk: low.

**P1 — Core Recruitment Platform**
- Confirm/enforce org re-scoping on every `/api/admin/*` endpoint (shared middleware, not comments).
- Add `hideFromOwnEmployees`/excluded-employer enforcement to the public portal.
- Make V2 search default; verify Boolean MUST/MUST_NOT with seeded-index tests.

**P2 — Search & Resume Databank Scale**
- Standardize on OpenSearch (remove ES); move to object storage; add/confirm dedup indexes; `search_after` deep paging.
- Design the platform-level central databank as an additive layer (global identity resolution, tiered index).

**P3 — AI & Automation**
- Batch/backpressure LLM parsing at import scale; intelligent resume-update merge/versioning; cost observability (already have token/cost fields).

**P4 — UX / Product Polish**
- Realtime messaging; tighter networking↔sourcing integration; sweep dev artifacts (`New Text Document.txt`, `*.log`, `.env.backup*`) from the tree.

**P5 — Future Capabilities**
- Per-candidate consent/entitlement for contact + downloads; cross-org talent intelligence; public SEO hardening.

---

## Final Architectural Question — How close is Careeriz to the full vision?

**Based on repository evidence, Careeriz is a genuinely strong, ~single-org multi-tenant ATS + recruiter-sourcing product with real AI and real Boolean resume search — but it is not yet the "central multi-million-resume databank platform" the vision describes.**

- **What already works:** organisation-scoped ATS (jobs → applications → screening → interviews → feedback → offers → hire), a production-grade background-task/worker engine, a real OpenSearch Boolean recruiter search with mandatory/optional keywords and privacy controls, a per-org bulk resume-import pipeline with dedup and duplicate-review, an AI/intelligence layer with provider abstraction and public-metadata redaction, billing/entitlements, notifications, networking and messaging, and a public job portal with centrally-enforced visibility.
- **What only appears to work:** the "platform administrator" and "central databank" — the admin is largely org-scoped, and the databank/dedup/index are per-organisation. Networking and messaging exist but are lightly integrated into hiring.
- **What is incomplete:** unified application model, public-side visibility exclusions, per-candidate contact/download consent, realtime messaging, intelligent resume-update merge, and a true global corpus.
- **What could become a scaling problem:** local file storage, single-node search, per-resume LLM parsing cost/throughput, and the per-org databank model as a ceiling for a global corpus.
- **What could create security/isolation problems:** filter-based tenant isolation without RLS, `RECRUITER_ADMIN` reaching `/api/admin/*`, and the plaintext live secret.
- **What must be completed before production:** rotate secrets, unify the application model (or prove the bridge), add cross-tenant isolation tests, object storage, one search engine, and public-portal exclusion enforcement.
- **What is already strong enough to preserve:** the background-task/lease/queue engine, Resume Search V2, the AI provider abstraction + serializer deny-list, the Prisma domain model breadth, and the entitlement/verification middleware stack.

**Bottom line:** the foundation is well above average and worth preserving — the remaining distance to the vision is mostly **consolidation (applications, search stacks, admin scope) and a deliberate platform/central-databank layer**, not a rewrite.
