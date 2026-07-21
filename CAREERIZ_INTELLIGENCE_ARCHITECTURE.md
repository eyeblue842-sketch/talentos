# Careeriz Intelligence Architecture

## 1. Intelligence-Layer Overview

Careeriz Milestone 7 introduces a centralized intelligence layer under `backend/src/intelligence/**`. Feature modules do not call providers directly. Controllers remain thin and delegate to shared services for provider access, prompt selection, redaction, validation, governance, caching, and usage enforcement.

Core backend areas:

- `providers/`
- `prompts/`
- `policies/`
- `schemas/`
- `redaction/`
- `services/`

Core frontend touchpoints:

- recruiter resume search assistant
- recruiter ATS/application intelligence panel
- recruiter job intelligence panel
- admin analytics insight panel
- admin intelligence governance page

## 2. Provider Abstraction

Provider selection is centralized in `backend/src/intelligence/services/providerService.js`.

Supported provider states:

- `DISABLED`
- `OPENAI`
- `ANTHROPIC`
- `GEMINI`
- `AZURE_OPENAI`
- `OLLAMA`
- `CUSTOM_OPENAI_COMPATIBLE`

Implemented adapters in Milestone 7:

- `DISABLED`
- one configurable OpenAI-compatible adapter

Provider responsibilities:

- text generation
- structured generation
- health checks
- timeout handling
- retry behavior
- model and usage metadata normalization
- provider-error normalization

## 3. Supported Provider States

Current runtime behavior:

- disabled provider: returns a clear unavailable state without fabricating results
- enabled but misconfigured provider: fails safely with a normalized error
- unavailable provider: returns a safe user-facing failure and preserves deterministic baselines where available
- enabled provider with valid config: supports structured JSON-centric execution

## 4. Prompt Registry

Prompts are versioned in code through `backend/src/intelligence/prompts/promptRegistry.js`.

Initial prompt keys:

- `RESUME_SUMMARY`
- `RESUME_SKILL_EXTRACTION`
- `CANDIDATE_JOB_MATCH_EXPLANATION`
- `JOB_DESCRIPTION_DRAFT`
- `JOB_DESCRIPTION_IMPROVEMENT`
- `INTERVIEW_QUESTION_SET`
- `INTERVIEW_EVALUATION_RUBRIC`
- `INTERVIEW_NOTES_SUMMARY`
- `TALENT_SEARCH_QUERY_PARSE`
- `ANALYTICS_INSIGHT`

Each prompt definition includes:

- key
- version
- purpose
- allowed data classes
- prohibited data
- input schema reference
- output schema reference
- default provider settings
- human-review requirement

## 5. Structured Output Validation

All structured responses are validated against Zod schemas in `backend/src/intelligence/schemas/outputSchemas.js`.

Protection rules:

- reject malformed JSON
- reject unexpected properties
- cap array lengths
- cap string lengths
- normalize and strip unsafe markup-like content
- reject unsupported enum values
- do not persist malformed output as valid intelligence

## 6. Data Projection and Redaction

The projection layer in `backend/src/intelligence/redaction/projectionService.js` prevents raw record dumps to providers.

Data classes:

- `PUBLIC_JOB_DATA`
- `ORGANIZATION_INTERNAL`
- `CANDIDATE_PROFESSIONAL`
- `CANDIDATE_CONTACT`
- `HIGHLY_SENSITIVE`
- `PROHIBITED_FOR_AI`

Milestone 7 exclusions include:

- email unless strictly needed
- phone unless strictly needed
- exact home address
- authentication data
- access tokens
- financial account data
- protected attributes
- recruiter private notes unless explicitly justified

## 7. Governance Data Model

Prisma models added:

- `IntelligenceExecution`
- `IntelligenceResult`
- `IntelligenceFeedback`

Execution records capture:

- organization
- requesting user
- feature
- prompt key
- prompt version
- provider
- model
- usage metadata
- latency
- cache-hit state
- retries
- safe metadata
- completion state

Result records capture:

- organization
- execution linkage
- entity type and entity id
- source fingerprint
- result version
- prompt version
- normalized output
- explanation
- expiry and supersession timestamps

Feedback records capture:

- user attribution
- useful or not useful
- optional rating
- optional correction notes
- optional override reason

## 8. Feature Flags

Organization-scoped flags are created and enforced through the existing `FeatureFlag` model.

Current intelligence flag keys:

- `intelligence.resume_summary`
- `intelligence.skill_extraction`
- `intelligence.candidate_matching`
- `intelligence.job_description`
- `intelligence.interview_assistant`
- `intelligence.talent_search`
- `intelligence.analytics_insights`

## 9. Permissions

Milestone 7 extends the enterprise permission catalog with:

- `intelligence.resume.read`
- `intelligence.resume.generate`
- `intelligence.match.read`
- `intelligence.match.generate`
- `intelligence.job.generate`
- `intelligence.interview.generate`
- `intelligence.search.use`
- `intelligence.analytics.use`
- `intelligence.governance.read`
- `intelligence.governance.manage`

Access requires both permission and organization-scoped feature enablement where applicable.

## 10. Caching

Result caching is persisted through `IntelligenceResult`.

Cache identity is based on:

- organization
- entity type
- entity id
- source fingerprint
- result version
- prompt version

No cross-organization cache sharing is allowed.

## 11. Staleness

Staleness is handled through:

- source fingerprints
- result-version keys
- supersession timestamps
- explicit regenerate paths

Results are not silently reused when source fingerprints or versions change.

## 12. Usage Controls

Usage enforcement is centralized in `backend/src/intelligence/services/usageService.js`.

Supported controls:

- per-user daily request limits
- per-organization daily request limits
- batch-size limits
- input-size limits
- timeout ceilings

These are non-billing operational guards only.

## 13. Human Review

Every recruiter-facing or admin-facing generated output is treated as a suggestion. The UI uses explicit labels such as:

- AI-generated suggestion
- Review before use

No intelligence path in Milestone 7 automatically:

- rejects a candidate
- shortlists a candidate
- moves ATS stages
- publishes a job
- finalizes a hiring decision

## 14. Failure Handling

Failure paths are normalized and safe:

- disabled provider returns unavailable state
- invalid base URL is rejected server-side
- provider timeout is normalized
- malformed output is rejected by schema validation
- deterministic baselines remain available where designed
- no fabricated AI fallback is returned

## 15. Security

Security controls include:

- backend-only provider secrets
- provider URL validation
- no raw secret storage in governance records
- request correlation IDs
- organization isolation
- permission checks before every feature call
- structured safe error responses
- no raw provider payload logging containing personal data

## 16. Prompt Injection Defence

Resume text, job descriptions, interview notes, and recruiter-entered content are treated as untrusted input.

Current protections:

- centralized system prompt ownership
- strict output schemas
- redaction/projection rather than raw record dumps
- no AI-generated SQL or arbitrary Prisma filters
- recruiter-editable interpreted filters before executing talent search

## 17. Resume Builder Boundary

The intelligence layer operates on uploaded or linked resume content already inside Careeriz. It does not create a native resume builder, template editor, or resume-layout workflow.

## 18. Future Provider Expansion

The current abstraction allows future adapters for:

- Anthropic
- Gemini
- Azure OpenAI
- Ollama
- other OpenAI-compatible providers

without rewriting feature services.

## 19. Future Evaluation Framework

Recommended future additions:

- prompt evaluation datasets
- fairness review samples
- regression suites for output quality
- approval workflows for prompt-version rollout
- model change review gates

## 20. Future Billing Integration Boundary

Usage tracking records request counts, token counts, latency, and estimated cost but does not implement billing. This creates a clean future boundary for:

- usage reporting
- quota tiers
- budget alerts
- organization entitlements
