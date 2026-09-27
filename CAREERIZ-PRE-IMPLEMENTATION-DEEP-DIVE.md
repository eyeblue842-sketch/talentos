# CAREERIZ — PRE-IMPLEMENTATION ARCHITECTURE DEEP-DIVE

**Type:** Read-only investigation ahead of the central-databank architecture decision
**Branch:** `develop` · **Date:** 2026-09-16
**Rule observed:** No code, schema, migration, config, or infra was changed. Every claim below is traced to concrete code (`file:line`).

> **Two findings are live, not theoretical, and should be read first (§6, §13):**
> 1. The **live recruiter resume search path (V1, the default)** returns `CandidateProfile` rows **across all organisations**, with **no `organisationId` and no `searchableProfile` filter**. Candidate detail/preview-by-ID has the same gap. Recruiter notes, ATS data, and resume-file downloads are correctly org-scoped, so tenant-private activity does **not** leak — but the candidate professional profile database is effectively global today, unintentionally, and also exposes candidates who never opted in to being searchable.
> 2. Candidate **job recommendations** bypass the public-visibility gate (`status: 'OPEN'` only), so `INTERNAL`/non-public jobs can surface to candidates.
>
> Neither is a blocker for the databank plan — in fact #1 shows the codebase is already *closer* to a shared databank than to strict isolation — but both must be conscious decisions, and #1 changes the risk framing of "introduce a global databank": we would be **formalising and gating** an exposure that partially exists, not opening a new one.

---

## 1. Application vs JobApplication — Complete Trace

**Both models are real and complementary — neither is redundant.**

| Aspect | `Application` | `JobApplication` |
|---|---|---|
| Prisma model | `schema.prisma` | `schema.prisma` |
| Role | **ATS pipeline system-of-record** (stage/status) | **Candidate-submission provenance record** |
| Key fields | `currentStage: PipelineStage`, `statusLabel`, `recruiterTag`, `recruiterNotes`, `matchScore`, `interviewScheduledAt` | `publicReference @unique`, `applicationId @unique → Application`, `sourceType/UTM/referrer`, `screeningSummary`, `withdrawnAt/Reason`, `resumeSnapshotId` |
| Hangs off it | `notes AtsNote[]`, `activities ApplicationActivity[]`, `interviewProcesses InterviewProcess[]`, `offers Offer[]`, `submittedApplication JobApplication?` | `answers ApplicationScreeningAnswer[]`, `flags ApplicationFlag[]`, `timeline ApplicationTimeline[]`, `resumeSnapshot ApplicationResumeSnapshot?` |
| Uniqueness | `@@unique([jobId, candidateId])` | `@@unique([jobId, candidateId])`, `applicationId @unique` |
| onDelete | `job` Cascade, `candidate` Cascade, `organisation` SetNull | `job` Restrict, `candidate` Restrict, `organisation` Restrict, `application` **SetNull** |

**The bridge exists and is enforced in code.** `JobApplication.applicationId` is a 1:1 FK to `Application` (`submittedApplication JobApplication?` on the other side).

### A. What gets created when a candidate applies?
`submitJobApplication()` → `submitJobApplicationRecord()` (`repositories/applicationWorkflow/applicationWorkflowRepository.js:299`) runs **one `prisma.$transaction`** that creates:
1. `Application` with `currentStage: 'APPLIED'` (`:332`) + an `ApplicationActivity` (`APPLICATION_SUBMITTED`),
2. `JobApplication` linked via `applicationId: application.id` (`:349-355`),
3. `ApplicationResumeSnapshot`, `ApplicationScreeningAnswer[]`, `ApplicationFlag[]`, `ApplicationTimeline`.

So **both records are created atomically and linked**.

### B. Does it appear in the recruiter ATS immediately?
**Yes.** The ATS pipeline reads `Application` (`atsService.getPipeline`, `Application.currentStage`), and the candidate submit path creates that `Application` at `APPLIED` in the same transaction. The recruiter also sees it via `getRecruiterJobResponses` reading `JobApplication` joined to `application`.

### C. What guarantees consistency?
- **Creation:** a single `$transaction` (all-or-nothing).
- **Withdrawal:** `withdrawCandidateApplicationRecord()` (`:557`) updates **both** in one `$transaction` — `Application.currentStage = 'WITHDRAWN'` (`:565`) **and** `JobApplication.withdrawnAt` (`:573`).
- **Recruiter-sourced entry:** `atsService.buildResumeWorkflowApplication()` (`atsService.js:96`) also creates **both**, linked (`:138` Application, `:150` JobApplication with `applicationId`).
- **Uniqueness:** `@@unique([jobId, candidateId])` on both prevents duplicates.

### D. Can candidate and recruiter see divergent statuses (e.g. candidate "INTERVIEW", recruiter "SHORTLISTED")?
**No — not for a linked pair.** The candidate-visible status is **derived from the same `Application.currentStage`**: `getCandidateVisibleStatus(application.application?.currentStage, …)` (`applicationWorkflowService.js:150`, `:1390`, `:1495-1499`). There is a single source of truth for stage. The only ways to get an inconsistency are edge cases, not normal flow:
- If an `Application` is **deleted**, `JobApplication.applicationId` is set null (`onDelete: SetNull`) and the candidate view falls back to the default `'APPLIED'` label — an orphaned candidate record.
- A **recruiter-sourced** candidate has an `Application` but (for direct DB-added ones) a `JobApplication` is created too — but a candidate who never applied simply has no candidate-facing record, which is expected.

### E. Which should be system-of-record?
- **`Application` = system-of-record for recruitment activity/stage** (interviews, offers, notes, pipeline all reference it).
- **`JobApplication` = system-of-record for the candidate's submission** (screening answers, resume snapshot, source/UTM, withdrawal, public reference, candidate-facing timeline).
- **Recommendation:** keep both; formalise `Application` as the pipeline SoR and `JobApplication` as the submission/provenance SoR. Do **not** merge — the split is a legitimate command/provenance separation. The one hardening worth doing later: change `JobApplication.applicationId` from `SetNull` to `Restrict` (or cascade the delete) so the candidate-facing record can't be silently orphaned.

---

## 2. Admin Authorization Matrix

**Middleware chain:** `adminRouter.use(auth(['RECRUITER','ADMIN']))` then `requireVerifiedOrganisation()` (`routes/adminRoutes.js`). `roleSatisfies` (`middleware/auth.js`) lets `RECRUITER_ADMIN` pass `auth(['ADMIN'])`. **But the real scoping happens at the service layer.**

**Org derivation (the key control):** every org-admin controller passes `req.user.activeMembership?.organisationId` (`controllers/adminController.js:40-271`) — **server-derived, never from body/params**. `activeMembership` is resolved by `resolveMembershipForRequest()` (`services/organisationAccessService.js:38`), which matches the requested org id **only among the user's own ACTIVE memberships** (`:41` `memberships.find(item => item.organisationId === requestedOrganisationId)`). A spoofed `x-organisation-id`/`?organisationId` for a foreign org yields `activeMembership = null`. Services re-validate via `requireEnterprisePermission()` (`enterprisePermissionService.js:207`) and use org-scoped object lookups, e.g. `findFirst({ where: { id: unitId, organisationId: context.organisationId } })` (`adminService.js:294`).

| Endpoint group (`/api/admin/*`) | Role gate | Org scope | Platform scope | Sensitive | Risk |
|---|---|---|---|---|---|
| overview, organisation, units, users, roles, settings, workflow, audit, notification-templates, background-jobs, analytics, feature-flags, lookups | `auth(['RECRUITER','ADMIN'])` + verified org | **Derived from `activeMembership`; object lookups `findFirst({id, organisationId})`** | via ADMIN bypass only | Yes (org config, membership, ownership transfer) | **Low** — org-scoped in code, not just comments |
| `/api/admin/billing/*` (purchases, webhook-events, credit-ledger, adjustments, subscription suspend/reactivate, manual-verify, refund) | `auth(['ADMIN'])` + `requirePlatformAdmin()` | Cross-tenant **by design** | **Platform only** (`ADMIN`/`PLATFORM_ADMIN`) | Yes (money) | Low (correct strict gate) |
| `/api/admin/organisation-verification/*` (pending, approve, reclassify type) | `auth(['ADMIN'])` + `requirePlatformAdmin()` | Cross-tenant by design | Platform only | Yes (employer identity) | Low |

### Can a RECRUITER_ADMIN reach data outside its org by changing `organisationId`/`userId`/etc.?
**No — verified in code.** `resolveEnterpriseContext()` (`enterprisePermissionService.js:175-197`) routes `RECRUITER_ADMIN` (and every non-ADMIN role) to `requireOrganisationContext()` → `getActiveMemberships(user.id)` → **only the user's own memberships**. Object IDs (unitId, membershipId) are looked up with `{ id, organisationId: context.organisationId }`, so a foreign ID returns "not found". The v1-audit worry that `RECRUITER_ADMIN` could cross tenants via `auth(['ADMIN'])` equivalence is **refuted**: middleware-level equivalence is undone by service-level membership scoping.

### The real finding: `UserRole.ADMIN` ≈ `PLATFORM_ADMIN` = cross-tenant god-mode
`resolveEnterpriseContext()` (`:180`) gives **both `ADMIN` and `PLATFORM_ADMIN`** a synthetic context from `getPlatformOrganisationContext(requestedOrganisationId)` (`:153`) — a fabricated `activeMembership` with `role: 'OWNER'` and **all** `enterprisePermissions` for **any** organisation id supplied, **without requiring a real membership** (`:210-214`). Implications:
- A global `ADMIN` can operate as OWNER of any organisation through the org-admin console. This is intended ("legacy org-agnostic ADMIN bypass" per the code comment) but means **`ADMIN` and `PLATFORM_ADMIN` are currently indistinguishable** for enterprise scope, and any `ADMIN` account compromise = full platform compromise.
- With **no** org id supplied, `getPlatformOrganisationContext(null)` silently selects the **oldest ACTIVE organisation** (`:156`) and grants OWNER on it — a footgun.
- **Recommendation (later):** reserve the cross-tenant bypass for `PLATFORM_ADMIN` only, demote generic `ADMIN`, require explicit org selection (no oldest-org default), and audit-log platform cross-org actions.

---

## 3. Candidate / Resume Ownership Map

| Entity | Ownership | Evidence |
|---|---|---|
| `User` | PLATFORM-OWNED (the login identity) | root of auth |
| **`CandidateProfile`** | **MIXED / DUAL-MODE** | `userId String? @unique` **and** `organisationId String?` both nullable; `source: CandidateProfileSource` (`DIRECT_SIGNUP` vs `BULK_IMPORT`). Self-signup ⇒ `userId` set, `organisationId` null (**effectively platform-level**). Bulk import ⇒ `organisationId` set, `userId` null (**org-scoped copy**). Both FKs `onDelete: SetNull`. |
| `ResumeAsset` | USER-OWNED (via candidate) | `candidateId` (req) + `ownerUserId` (req); **no `organisationId`**; `onDelete: Cascade` from both. |
| Parsed resume | Embedded in candidate/asset | `CandidateProfile.rawResumeText/parserVersion/parserMetadata`; `ResumeAsset.parsedText/parsedData`. |
| Search document | Derived, org-tagged | OpenSearch doc `documentId: candidate:{id}`, `sourceOrganisationId` (see §5). |
| `Organisation` | PLATFORM-OWNED tenant root | |
| `ResumeImportBatch/Item` | ORGANISATION-OWNED | carry `organisationId`; profiles link back via `importBatchId`. |
| `Application`, `JobApplication`, `AtsNote`, `Offer`, `InterviewFeedback`, `SavedCandidate`, `TalentPoolCandidate` | ORGANISATION-OWNED (tenant-private ATS) | all carry `organisationId`; hang off `CandidateProfile` by relation. |

**Crucial for the databank:** tenant ownership is **not** intrinsic to a candidate's professional identity — it is introduced by the `organisationId` on *imported* profiles and by the *relationship* records (applications/notes/etc.). A self-signup `CandidateProfile` is already an org-agnostic identity. The schema is therefore **much closer to the target separation than expected**: the "global professional identity" (CandidateProfile without org) and the "tenant-private assessment" (org-scoped relations) already coexist as concepts.

---

## 4. Current Deduplication Architecture

`detectDuplicateCandidate(organisationId, parsedData, tx, excludeCandidateId)` (`resumeImportService.js:315-378`):
1. **Exact match, org-scoped** on normalized **email** / **phone** (`normalizedPhoneNumber`) / **LinkedIn** (`linkedInUrlNormalized`) — `findFirst({ where: { organisationId, OR: [...] } })` → `suggestedOnly: false` (hard duplicate → review/attach).
2. **Heuristic** on `fullName` + `currentEmployer` (case-insensitive), org-scoped → `suggestedOnly: true` (possible duplicate → review).
3. Otherwise `null` (new candidate).

**No resume-hash / document-hash dedup.** `ResumeImportItem.checksumSha256` exists and is stored in `provenanceMetadata` but is **not** used for candidate identity resolution. Resolution options: `ATTACHED_TO_EXISTING` / `CREATED_SEPARATE` / `REJECTED` (`:947-1037`). No intelligent "updated resume → versioned merge".

### Org A imports `Rahul Sharma / rahul@example.com`, then Org B imports the same person
**Two separate `CandidateProfile` rows are created** — one with `organisationId = A`, one with `organisationId = B` — because every dedup query is `where: { organisationId, … }`. There is **no global identity**.

**What could establish global identity without leaking Org A's private data:** a **platform-level identity resolution key** (normalized email/phone/LinkedIn, and optionally a resume/content hash) that maps many org-scoped profiles to one `PlatformCandidate`. Org A's *private* data (notes/ratings/pipeline) stays on the org-scoped relations; only the **shared professional facts** (skills/experience/education/resume text) are associated with the platform identity. See §14/§15.

---

## 5. Current OpenSearch (V2) Document Architecture

Index: `careeriz-resume-search-v2` (`resumeSearchV2/mapping.js:3-4`), synonym-graph analyzer from `opensearch/analysis/resume_synonyms_v1.txt`.

**Document id:** `candidate:{candidateId}` (`documentBuilder.js:70`) — **one doc per candidate**, not per resume/per-org.

**Identity/scope fields:** `documentId`, `candidateId`, `resumeId`, `importItemId`, `sourceOrganisationId` (`mapping.js:39-44`).
**Visibility/entitlement fields:** `visibilityClassification` (keyword), `contactVisibilityClassification` (keyword), `searchableProfile` (boolean) (`:45-47`).
**Searchable professional fields:** `normalizedSkills(.raw)`, `rawSkills`, `currentTitle(.raw)`, `previousTitles`, `currentEmployer(.raw)`, `previousEmployers`, `industries`, `employmentHistoryText`, `projectsText`, `educationText/Summary`, `certifications`, `languages`, `currentLocation`, `preferredLocations`, `totalExperienceMonths`, `noticePeriodDays` (`:48-81`).
**Sensitive (indexed, excluded from `_source` at query time):** `currentSalaryNormalized`, `expectedSalaryNormalized`, `salarySearchable` (`:82-84`; excluded in `queryCompiler.js` `_source.excludes`).
**Meta:** `parsingConfidence`, `reviewRequired`, `resumeUpdatedAt`, `profileUpdatedAt`, `sourceVersion`, `indexSchemaVersion`.

**Classification source:** `visibilityClassification = resolveResumeVisibilityClassification(candidate, resume)` (`documentBuilder.js:62`) and `contactVisibilityClassification = candidate.phoneVisibleToRecruiters ? 'RECRUITER_VISIBLE' : 'HIDDEN'` (`:81`).

---

## 6. Cross-Tenant Search Enforcement (V2 design vs V1 live reality)

### V2 (`resumeSearchV2`) — a global-databank-ready design, **currently dormant**
`buildResumeSearchVisibilityFilter({ actorUser, organisationId })` (`visibility.js`):
- **`GLOBAL_RECRUITER_DATABASE`** → visible to any org's recruiter.
- **`CANDIDATE_PUBLIC`** → visible to all.
- **`ORGANISATION_PRIVATE`** → visible **only** when `sourceOrganisationId == actor org`.
- **`NOT_SEARCHABLE`** → hidden from everyone (platform admin sees all non-NOT_SEARCHABLE).

This is exactly the entitlement model a central databank needs. **But two facts matter:**
1. `RESUME_SEARCH_V2_ENABLED` defaults `false` (`config/env.js`) and `.env` does not set it ⇒ **V2 is not the live path.**
2. **Classification default is `GLOBAL_RECRUITER_DATABASE` for bulk imports.** `resolveResumeVisibilityClassification()` returns `GLOBAL_RECRUITER_DATABASE` for a searchable profile whose `profileVisibility` is neither `PUBLIC` nor `PRIVATE`. Bulk import sets `profileVisibility: 'RECRUITERS_ONLY'`, `searchableProfile: true`, `resumeVisibleToRecruiters: true` (`resumeImportService.js:424-425`) and writes **no** `provenanceMetadata.resumeSearch.visibilityClassification` override (`:301-306`). So when V2 is switched on, **every org's imports become cross-org searchable by default.** That must be an explicit product decision, not a default.

### V1 (`candidateSearchOrchestrator`) — the **live** path, **not tenant-scoped**
`resumeController.searchResumeDatabase` runs V1 when `!env.resumeSearchV2Enabled` (`resumeController.js:80`). V1's candidate set comes from `getCandidateSourceRows(filters)` → `findSearchCandidatesByFilters(filters)` → `findMany({ where: buildDbWhere(filters) })` (`candidateSearchRepository.js:55-64`). **`buildDbWhere()` (`searchUtils.js`) contains no `organisationId` and no `searchableProfile` clause** — only keyword/skill/location/experience/salary criteria. `organisationId` is used solely to decorate results with org-specific saved/application context (`candidateSearchOrchestrator.js:142-184`). Detail/preview are the same: `findAuthorizedCandidateDetailRecord(candidateId, organisationId)` and `findRecruiterCandidatePreviewRecord(candidateId, organisationId)` do `findUnique({ where: { id: candidateId } })` — **candidate fetched by ID only**; `organisationId` scopes only the nested notes/applications sub-selects (`candidateSearchRepository.js:135-190`).

**Net live behaviour (gated by `auth(['RECRUITER'])` + verified org + no-op entitlement):**
- `GET /api/resumes/search` → candidate cards **from all orgs**, incl. non-searchable profiles, with PII (name, employer, title, location, experience, **current/expected CTC** are in the select).
- `GET /api/resumes/search/:candidateId` and `/preview/:candidateId` → **full profile of any candidate by id**.
- **Safe:** recruiter **notes/ATS data** stay org-scoped (sub-select `where: { organisationId }`); **resume-file download** is org-scoped (§7); so tenant-private *activity* does not leak — only the candidate professional profile surface.

**Design → target:** the V2 model is the right foundation for "global corpus + per-org entitlement filter". The evolution is to (a) make classification an explicit, defaulted-to-private decision, (b) enable V2, (c) retire the un-scoped V1 candidate query. One doc per candidate already avoids millions of duplicate search docs (§14).

---

## 7. Contact & Resume Permission Model

**Today, when a recruiter finds a candidate:**
- **Search / open profile / view email & phone:** served by V1 detail/preview (`getCandidateDetail`, `getCandidatePreview`), which **does not enforce** `phoneVisibleToRecruiters` / `salaryVisibleToRecruiters` for cross-org candidates and fetches by id (see §6). There is **no "request/unlock contact" step** — contact fields present on the profile are returned.
- **Download resume:** **properly gated.** `getCandidateResumeDownload()` (`resumeService.js`) → `findCandidateResumeAccessForOrganisation(candidateId, organisationId)` requires the candidate to have `applications.some({ organisationId })` **or** `savedByRecruiters.some({ organisationId })` (`resumeRepository.js:73`). No application/save ⇒ 404. Audit-logged.
- **Entitlement layer:** `requireResumeDatabaseAccess()` / `requireAtsAccess()` are **org-plan gates**, server-side, but ship behind a **kill-switch that defaults to a true no-op** (`middleware/entitlement.js`; `isEntitlementEnforcementEnabled` off) — so plan-level gating is currently inert.

**Reusable building blocks for the target "search → limited profile → unlock contact → download" flow:**
- Profile flags already exist: `searchableProfile`, `phoneVisibleToRecruiters`, `salaryVisibleToRecruiters`, `resumeVisibleToRecruiters`, `profileVisibility` (CandidateProfile).
- Index already carries `contactVisibilityClassification` and salary `_source` exclusion.
- `SavedCandidate` + `Application` already model the "org has a relationship with this candidate" predicate the download gate uses — the natural anchor for an "unlock" record.
- **Missing:** an explicit `ContactUnlock`/entitlement-consumption record and enforcement of the profile flags on the *detail/preview* responses.

---

## 8. Public Job Visibility Trace

**Central helper:** `buildPublicJobWhere(filters)` (`publicPortalService.js:218`) enforces `status:'OPEN'`, `archivedAt:null`, `isPublic:true`, `visibility ∈ {EXTERNAL,BOTH}`, live application window, org `ACTIVE` + `careersEnabled`. **Reused consistently** for: job list (`:450`), featured (`:388/501/515`), company page by slug (`:570`), aggregations.

| Discovery path | Uses authoritative gate? | Evidence |
|---|---|---|
| Public job search / list | ✅ `buildPublicJobWhere` | `publicPortalService.js:450` |
| Featured / related / company page | ✅ `buildPublicJobWhere` | `:388,:501,:515,:570` |
| Job detail (public) | ✅ (same base where) | `publicPortalService` detail |
| **Candidate recommendations** | ❌ **bypasses gate** | `recommendationService.js:53-57` = `findMany({ where: { status: 'OPEN' } })` only — no `isPublic`/`visibility`/`careersEnabled`/deadline. Serialized via `serializePublicJob` (hides salary) but **INTERNAL/non-public jobs can be recommended.** |
| Application endpoint | Partial | `applicationWorkflowRoutes` `getPublicJobApplyData` uses `optionalAuth`; confirm it re-checks visibility before accepting an apply. |

**`hideFromOwnEmployees` / excluded-employer:** **UNMODELED.** The `Job` model has only `isPublic`, `featuredInPortal`, `visibility (EXTERNAL/INTERNAL/BOTH)` — **no** `hideFromOwnEmployees` or excluded-company field anywhere. (The `excludedCompanies` seen in `resumeSearchV2/queryCompiler.js` is a *recruiter search input filter*, unrelated to job posting visibility.) This vision feature is **missing**, not merely un-enforced.

**Best home for one authoritative policy:** `buildPublicJobWhere()` is already that home — extend it (and route recommendations through it) rather than adding scattered filters. `serializePublicJob()` is the matching output guard.

---

## 9. Search V1 / V2 Dependency Map

| Dependency | On V1 | On V2 | Classification |
|---|---|---|---|
| Route `GET /api/resumes/search` | ✅ live default | — | REQUIRES PORTING (semantics + tenant-scoping) |
| Route `POST /api/resumes/search/v2` | — | ✅ (flag-gated, dormant) | SAFE (already built) |
| `searchService.js` (shim) → `candidateSearchOrchestrator` | ✅ | — | REQUIRES PORTING |
| `resumeController.searchResumeDatabase` | ✅ (`:80` flag branch) | calls V2 when enabled | REQUIRES PORTING |
| Talent pools / saved searches / preview / detail | ✅ (via orchestrator) | partial (V2 service has its own) | REQUIRES PORTING |
| Elasticsearch adapter (`config/elastic.js`) | ✅ optional accelerator, DB fallback | — | SAFE TO MIGRATE (off by default) |
| Indexing (`resumeSearchV2/indexingService`) + worker | — | ✅ | SAFE |
| Tests (`elastic-*`, `semantic-search-foundation`, search specs) | ✅ | ✅ | REQUIRES PORTING (keep coverage) |
| Functionality only in V1 | keyword/skill/location DB search, talent-pool/saved-search plumbing, ES-optional mode | — | REQUIRES PORTING |
| Functionality only in V2 | MUST/SHOULD/MUST_NOT Boolean, synonyms, visibility classification, signed cursors, salary `_source` exclusion | ✅ | — |

**Do not delete V1** until: (a) V2 reaches feature parity for talent pools/saved searches/preview, (b) V2 is enabled and load-tested, (c) tenant classification defaults are decided. V1's value today is that it is the *only enabled* path — but it is also the source of the §6 exposure, so porting is the priority, not preservation.

---

## 10. AI Legacy (`services/ai/*`) vs New (`intelligence/providers/*`)

**Not duplicates — different generations, partially bridged.**

- `intelligence/providers/*` (bedrock, openaiCompatible, mock, disabled) + `intelligence/services/providerService.js` = the **canonical provider abstraction**, used by all `intelligence/services/*` features (JD generation, candidate match/rank, semantic search, interview/analytics intelligence) via `intelligenceController` and runtime config.
- `services/ai/*` = the **resume-parsing-specific** layer. `services/ai/resume-parser.js` (with `RESUME_PARSER_VERSION`) is consumed by the **worker** (`worker.js`). Notably `services/ai/ai-provider.js` **imports from `intelligence/providers`** — i.e. the older AI module now delegates provider calls to the newer abstraction rather than duplicating them.

| Feature | Service | Provider | Model | Prompt | Output → Storage |
|---|---|---|---|---|---|
| Resume parsing | `services/ai/resume-parser.js` (worker) | `services/ai/ai-provider.js` → `intelligence/providers` | OpenAI `gpt-5` | internal parser prompt | `CandidateProfile.parsedData/rawResumeText/parserVersion`; `ResumeAsset.parsedData` |
| JD generation / improve | `intelligence/services/jobDescriptionGenerationService.js` | `intelligence/providers/*` | OpenAI `gpt-5` | `intelligence/prompts/promptRegistry.js` | `JobDescription*` + `IntelligenceExecution/Result` |
| Candidate match / rank | `candidateMatch*`, `candidateRanking*` | `intelligence/providers/*` | OpenAI | prompt registry | `CandidateJobMatchState`, `CandidateRankingSnapshot/Entry` |
| Semantic search / skill expansion | `semanticSearchService`, `semanticSkillExpansionService` | `intelligence/providers/*` (+ ES) | OpenAI | prompt registry | `SemanticSearchQuery/Execution` |

**Do not consolidate yet.** The clean end-state is: `services/ai/resume-parser` keeps its resume-domain logic but calls the `intelligence` provider abstraction for all model I/O (already partly true).

---

## 11. Elasticsearch / OpenSearch Dependency Map

**Both default OFF** (`ELASTICSEARCH_ENABLED=false`, `RESUME_SEARCH_V2_ENABLED=false`, `RESUME_INDEXING_ENABLED=false`; `.env` sets none).

| Engine | Referenced by | Role |
|---|---|---|
| **Elasticsearch** (`config/elastic.js`, `isElasticsearchEnabled`) | V1 `candidateSearchOrchestrator` (optional accelerator → falls back to DB when off), `intelligence/services/semanticSearchService.js`, `healthService.js`, `server.js`, tests (`elastic-availability`, `elastic-disabled-routes`, `phase1-security`, `semantic-search-foundation`) | **V1 + semantic-search dependency; dev-optional.** Not required for V1 to function (DB fallback). |
| **OpenSearch** (`resumeSearchV2/openSearchAdapter.js`, `OPENSEARCH_NODE`) | V2 search + indexing + worker indexing | **V2 target engine.** Required only when V2/indexing enabled. |

**Conclusion:** ES is **not "actively required"** in the default posture (V1 runs on Postgres fallback); it is a **V1/semantic accelerator + test dependency**. OpenSearch is the forward engine. Removing ES is safe **only after** semantic search is repointed to OpenSearch and the ES tests are ported — **do not remove now**.

---

## 12. Current Platform-Admin Capability Matrix

| Target capability | Status | Evidence |
|---|---|---|
| Manage client **organisations** (own) | **PARTIAL** (org-scoped; ADMIN can cross via bypass) | `adminService` org endpoints; `getPlatformOrganisationContext` bypass |
| Manage **users** (own org) | PARTIAL (org-scoped) | `adminController` users/membership |
| **Global resume databank** | **MISSING** (databank is per-org) | dedup/import/index all `organisationId`-scoped |
| **Bulk upload** resumes at platform level | **BACKEND ONLY / org-scoped** | `resumeImportRouter` = `auth(['RECRUITER','ADMIN'])`, org-scoped; no platform ingestion path |
| **Parsing monitor** | PARTIAL (org-scoped background-jobs view) | `getAdminBackgroundJobs` (org), `getResumeImportWorkerStatus` |
| **Duplicate review** | PARTIAL (org-scoped, per-batch) | `resolve-duplicate` endpoints (org batch) |
| **Search health / index health** | BACKEND ONLY (health service) | `healthService` (ES/OpenSearch/DB); no admin UI for index health |
| **Public job portal controls** | PARTIAL | `careersEnabled`, `isPublic`, `visibility` at org/job level; no platform-wide control panel |
| **Permissions / roles** | PARTIAL (org role definitions) | `OrganisationRoleDefinition`, `adminService` roles |
| **Platform configuration** | PARTIAL | `FeatureFlag` (org-scoped), `PlatformSetupState`, billing/verification (platform) |
| Cross-tenant **billing reconciliation** | **IMPLEMENTED** | `adminBillingRoutes` + `requirePlatformAdmin` |
| Cross-tenant **org verification** | **IMPLEMENTED** | `organisationVerificationRoutes` + `requirePlatformAdmin` |
| Platform-admin **UI** | PARTIAL (org-admin console FE exists; platform billing FE exists; no global-databank FE) | `frontend/app/admin/*`, `recruiter/billing` |

**Reality:** a genuine platform administrator exists **only for billing and org verification**. Everything else labelled "admin" is an **organisation** admin console. The global databank, platform bulk ingestion, and index-health tooling are **missing at the platform tier**.

---

## 13. Security Findings (this deep-dive)

| # | Severity | Finding | Evidence | Live? |
|---|---|---|---|---|
| S1 | **Critical** | **Cross-tenant candidate-profile exposure in live V1 search + detail/preview.** Recruiter in Org A can search and open full profiles of candidates owned by Org B, and of self-signup candidates who never set `searchableProfile`. | `searchUtils.buildDbWhere` (no org/searchable filter), `candidateSearchRepository.js:55-90,135-190`, `resumeController.js:80` | **Yes** (default path) |
| S2 | High | **Non-consented profiles searchable.** `searchableProfile` is never enforced in V1. | same as S1 | Yes |
| S3 | High | **Latent global exposure of imports when V2 is enabled** — bulk imports default to `GLOBAL_RECRUITER_DATABASE`. | `visibility.js` + `resumeImportService.js:301-306,424-425` | Latent (V2 off) |
| S4 | Medium | **`ADMIN` == `PLATFORM_ADMIN` cross-tenant OWNER on any org; oldest-org default.** | `enterprisePermissionService.js:153-172,180,210-214` | Yes (intended, but broad) |
| S5 | Medium | **Recommendations bypass public visibility** (INTERNAL jobs can reach candidates). | `recommendationService.js:53-57` | Yes |
| S6 | Low | **`hideFromOwnEmployees`/excluded-employer unmodeled** — cannot satisfy that requirement at all today. | `Job` model fields | n/a |
| S7 | Low | **`JobApplication.applicationId` SetNull** can orphan the candidate-facing record if an `Application` is deleted. | `schema.prisma` | edge |

**Correctly isolated (do not regress):** recruiter notes/ATS activity (org sub-selects), resume-file download (`resumeRepository.js:73`), org-admin console (membership-scoped), billing/verification (platform gate).

---

## 14. Central Databank Target Model (do NOT confuse Global with Public)

**Principle:** *Candidate identity is platform-level; recruitment activity stays organisation-level.* The schema already separates these; the change is to make identity explicit and make access an entitlement, not a copy.

Distinct permission planes (each independently gated):

| Plane | Meaning | Existing hook |
|---|---|---|
| **Platform-owned** | one identity per real person | `CandidateProfile` without org (self-signup) already is this |
| **Searchable** | appears in the corpus at all | `searchableProfile`, `visibilityClassification=NOT_SEARCHABLE` |
| **Discoverable** | which orgs may find it | `visibilityClassification` GLOBAL vs ORGANISATION_PRIVATE vs CANDIDATE_PUBLIC + `sourceOrganisationId` |
| **Contact-visible** | email/phone revealed | `phoneVisibleToRecruiters`, `contactVisibilityClassification`, + a new unlock record |
| **Resume-downloadable** | file access | `resumeVisibleToRecruiters` + `findCandidateResumeAccessForOrganisation` predicate |
| **Organisation-private** | notes/ratings/pipeline/interviews/offers | already org-scoped relations |

**Target shape (conceptual, additive):**
```
PlatformCandidate (new, thin: identity keys + link)
   └── CandidateProfile (existing; the shared professional facts)
         └── ResumeAsset[] (existing; resume versions)
               └── Search Document (existing V2; one per candidate, sourceOrganisationId + visibilityClassification)
   └── OrganisationCandidateAccess (new: (organisationId, candidateId, accessLevel, unlockedContactAt))
         └── Application / JobApplication / AtsNote / Offer / Interview* (existing, org-scoped — unchanged)
```
Org A and Org B both point at the **same** `PlatformCandidate`/`CandidateProfile`; their private assessment lives on their own `OrganisationCandidateAccess` + ATS rows. No duplicate profiles, no duplicate search docs.

---

## 15. Minimum Migration Strategy (smallest safe change)

**Guiding rule: preserve → correct → consolidate → extend. No historical migration edits.**

1. **Correct the live leak first (no schema change).** Scope V1 search + detail/preview to the actor's org **or** to an explicit, defaulted-off "global" classification, and enforce `searchableProfile`. This closes S1/S2 before any databank work and is reversible.
2. **Add identity resolution (additive tables).** New `PlatformCandidate` (id, normalized email/phone/LinkedIn, optional content hash, `mergedIntoId?`) and `OrganisationCandidateAccess` (organisationId, candidateId, accessLevel, contactUnlockedAt). Backfill `PlatformCandidate` from existing `CandidateProfile` identity keys; link existing profiles. Nullable FKs + `onDelete: SetNull/Restrict` to avoid orphan/cascade surprises.
3. **Make visibility explicit.** Add a real `visibilityClassification` column (or keep it in `provenanceMetadata` but **default imports to `ORGANISATION_PRIVATE`**), so "global" is opt-in per candidate/policy, not a fallthrough default.
4. **Turn on V2 behind the corrected classification**, port talent-pools/saved-search/preview to V2, then retire the un-scoped V1 candidate query (keep V1 code until parity is proven).
5. **Elevate dedup to platform identity** — run the existing email/phone/LinkedIn (+ optional content hash) match against `PlatformCandidate` in addition to the org-scoped `CandidateProfile` check, so re-imports attach to one identity.
6. **Route recommendations and any apply endpoints through `buildPublicJobWhere`**, and add `hideFromOwnEmployees`/excluded-employer fields + one policy in that helper.

Each step is independently shippable and reversible; none rewrites the ATS.

---

## 16. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Enabling V2 without fixing import classification exposes all imports cross-org | High if V2 flipped as-is | High | Default classification to ORGANISATION_PRIVATE **before** enabling V2 (§15.3) |
| Fixing V1 scoping changes current (leaky) recruiter search results | Certain | Medium (behavioural) | Feature-flag the scope fix; communicate that pre-fix cross-org visibility was unintended |
| Identity-resolution backfill mis-merges distinct people sharing a phone/email | Medium | High (data integrity) | Merge only on strong keys; keep `mergedIntoId` reversible; queue ambiguous merges for review (reuse duplicate-review UI) |
| `ADMIN` bypass breadth | Medium | High if account compromised | Split ADMIN vs PLATFORM_ADMIN; audit-log cross-org actions |
| Orphaned `JobApplication` on `Application` delete | Low | Low | Change FK to Restrict/cascade |
| Removing ES prematurely breaks semantic search/tests | Medium | Medium | Repoint semantic search to OpenSearch first; keep ES until then |

---

## 17. Recommended Implementation Sequence

- **P0 (data-isolation correctness, no schema):** scope V1 search + candidate detail/preview to org (or explicit opt-in global) and enforce `searchableProfile`; route recommendations through `buildPublicJobWhere`. Closes S1/S2/S5.
- **P0.5 (RBAC clarity):** separate `ADMIN` from `PLATFORM_ADMIN`; remove oldest-org default; audit-log platform cross-org actions.
- **P1 (identity foundation, additive):** `PlatformCandidate` + `OrganisationCandidateAccess`; backfill + link; explicit `visibilityClassification` defaulting to ORGANISATION_PRIVATE.
- **P2 (databank search):** enable V2 behind corrected classification; port talent-pool/saved-search/preview; retire un-scoped V1 query; platform-level dedup.
- **P3 (contact entitlement):** "search → limited profile → unlock contact → download" using existing flags + a `ContactUnlock`/access record; enforce flags on detail/preview.
- **P4 (platform admin + visibility policy):** platform databank/ingestion/index-health console; add `hideFromOwnEmployees`/excluded-employer to `Job` + `buildPublicJobWhere`.

---

## FINAL ANSWER — Smallest architecture change for a true platform candidate/resume identity

**Introduce a thin platform-identity layer *above* the existing `CandidateProfile`, and turn cross-org visibility into an explicit entitlement — do not replace `CandidateProfile`, and do not duplicate search documents.**

Concretely, the smallest safe set:

1. **Two additive tables**, no rewrites: `PlatformCandidate` (identity keys: normalized email/phone/LinkedIn + optional resume/content hash; `mergedIntoId?`) and `OrganisationCandidateAccess` (`organisationId`, `candidateId`, `accessLevel`, `contactUnlockedAt`). Existing `CandidateProfile` becomes the shared professional facts hanging under one `PlatformCandidate`; all existing org-scoped ATS rows (Application, JobApplication, AtsNote, Offer, Interview*) stay exactly as they are.
2. **Make visibility explicit and private-by-default** (`visibilityClassification`), so "global databank" membership is opt-in per candidate/policy — this both enables the databank and **closes the current default-global exposure**.
3. **Reuse, don't rebuild, what already fits:** Resume Search V2's one-doc-per-candidate index with `sourceOrganisationId` + `visibilityClassification` + `buildResumeSearchVisibilityFilter` **is already the global-corpus-with-entitlement-filter design** — it needs enabling behind the corrected default, not redesigning. The import worker, dedup, AI provider abstraction, and org-scoped ATS all remain intact.
4. **Before any of it, fix the live V1 tenant-scoping** so the platform tier is built on isolation you can prove, not on the current unintended sharing.

This gives a genuine platform-level candidate/resume identity (one person, many org accesses, shared professional data, private assessments) while preserving Resume Search V2, the import worker, the AI infrastructure, and every recruiter workflow — reached by **~two new tables + a classification default + enabling existing V2**, not a rewrite.

**DO NOT IMPLEMENT. Awaiting approval.**
