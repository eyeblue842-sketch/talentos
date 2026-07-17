# Database Schema Summary

## Main entities

- `User`: auth identity, role, active state
- `RecruiterProfile`: company details for recruiter users
  - Stores company name, about text, industry domain, MNC/Domestic type, headquarters, branch and office footprint, turnover, and recruiter designation metadata
- `CandidateProfile`: searchable candidate profile and resume metadata
- `Job`: recruiter-owned job posting
- `Application`: job application and ATS state container
- `JobApplication`: immutable submission record and candidate-safe application reference
- `ScreeningQuestionTemplate`: organisation-scoped reusable screening question
- `JobScreeningQuestion`: job-owned screening question configuration snapshot
- `ApplicationScreeningAnswer`: submitted answer snapshot per screening question
- `ApplicationFlag`: recruiter-visible structured screening result
- `ApplicationResumeSnapshot`: immutable resume/version used at submission
- `ResumeAsset`: private candidate-owned uploaded file metadata for resumes and answer attachments
- `ApplicationTimeline`: candidate-safe and recruiter-safe submission timeline
- `AtsNote`: recruiter notes on a candidate/application
- `ApplicationActivity`: timeline events such as stage moves and interview scheduling
- `ResumeBuilder`: structured resume data for PDF generation and shareable resume links
- `SavedCandidate`: recruiter bookmarks and candidate tagging

## Relationships

- One `User` has either one `RecruiterProfile` or one `CandidateProfile`
- One recruiter user can create many `Job` records
- One candidate profile can apply to many jobs through `Application`
- One candidate profile can submit only one `JobApplication` per job through a database uniqueness constraint
- One application can have many notes and timeline activity entries
- One submitted application can have many answer snapshots, flags, and timeline items
- One candidate has one `ResumeBuilder` record

## Search strategy

- Preferred: Elasticsearch index for fast resume retrieval
- Fallback: PostgreSQL filtered search when Elasticsearch is absent

## Storage strategy

- Resume uploads are stored as private `ResumeAsset` records
- Submitted applications preserve an immutable `ApplicationResumeSnapshot`
- Screening answer uploads reuse the same private storage path and remain auth-protected
- Local storage and S3-backed private storage are both supported by the storage abstraction
