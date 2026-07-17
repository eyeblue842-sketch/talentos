# API Endpoints

Base URL: `http://localhost:5000/api`

## Auth

- `POST /auth/signup`
  - Register recruiter or candidate
  - Body:
    ```json
    {
      "email": "user@example.com",
      "password": "Password@123",
      "role": "RECRUITER"
    }
    ```
  - Recruiter rule:
    - must use a company email domain
    - Gmail/Yahoo/Outlook-style personal domains are rejected
    - the same recruiter company email cannot register twice
- `POST /auth/login`
- `GET /auth/me`
- `PATCH /auth/recruiter-profile`
  - Recruiter profile completion after signup
  - Body:
    ```json
    {
      "companyName": "Acme Inc",
      "aboutCompany": "Mid-size product engineering company",
      "industryDomain": "Information Technology",
      "companyType": "MNC",
      "headquartersLocation": "Bengaluru",
      "startedYear": 2018,
      "employeeCount": 250,
      "branchCount": 4,
      "officeLocations": ["Bengaluru", "Chennai", "Pune"],
      "annualTurnover": "INR 60 Cr",
      "designation": "Senior Talent Partner",
      "workingSince": 2023,
      "website": "https://acme.example"
    }
    ```

## Jobs

- `GET /jobs/public`
  - Public/candidate job browsing
  - Query: `keyword`, `location`, `skill`
- `GET /public/jobs/:slug/apply`
  - Public-safe application context and server-authoritative eligibility
- `GET /jobs`
  - Recruiter jobs
- `POST /jobs`
  - Create a job posting
- `PATCH /jobs/:jobId`
- `DELETE /jobs/:jobId`
- `GET /jobs/screening-templates`
- `POST /jobs/screening-templates`
- `PATCH /jobs/screening-templates/:templateId`
- `POST /jobs/screening-templates/:templateId/archive`
- `POST /jobs/screening-templates/:templateId/duplicate`
- `GET /jobs/:jobId/screening-questions`
- `POST /jobs/:jobId/screening-questions`
- `POST /jobs/:jobId/screening-questions/from-library`
- `PATCH /jobs/:jobId/screening-questions/:questionId`
- `POST /jobs/:jobId/screening-questions/reorder`
- `POST /jobs/:jobId/screening-questions/:questionId/duplicate`
- `DELETE /jobs/:jobId/screening-questions/:questionId`
- `GET /jobs/:jobId/screening-questions/preview`

## Resume Database

- `GET /resumes/search`
  - Recruiter resume search
  - Query: `keyword`, `location`, `minExperience`, `availability`
- `GET /resumes/saved`
- `POST /resumes/saved/:candidateId`
  - Body: `{ "tag": "SHORTLISTED" }`
- `PATCH /resumes/profile`
  - Candidate profile update
- `GET /resumes/recommended-jobs`
  - Candidate AI-style job recommendations based on skill match, preferred location, and expected CTC fit
- `POST /resumes/upload`
  - Multipart form-data with `resume`
- `GET /resumes/pdf`
  - Candidate PDF export
- `GET /candidate/resumes`
  - Candidate-owned resume inventory
- `POST /candidate/resumes`
  - Candidate resume upload with private storage
- `GET /candidate/resumes/:assetId/download`
  - Authenticated candidate resume download

## ATS / Applications

- `POST /ats/apply`
  - Candidate applies to a job
  - Body: `{ "jobId": "...", "coverLetter": "..." }`
- `POST /candidate/application-files`
  - Candidate answer-attachment upload
- `POST /candidate/applications/validate`
  - Validate screening answers and eligibility before submission
- `POST /candidate/applications`
  - Atomic application submission with snapshots, flags, source attribution, timeline, notifications, and duplicate protection
- `GET /candidate/applications`
  - Candidate-safe submitted application list
- `GET /candidate/applications/:applicationId`
  - Candidate-safe submitted application detail
- `GET /ats/applications`
  - Recruiter application list with flags, source, and resume availability
- `GET /ats/applications/:applicationId`
  - Recruiter application detail with answer snapshots and screening flags
- `GET /ats/applications/:applicationId/resume`
  - Authenticated recruiter resume snapshot download
- `GET /ats/files/:assetId?applicationId=...`
  - Authenticated recruiter screening-file download
- `GET /ats/pipeline`
  - Recruiter application board
- `PATCH /ats/pipeline/:applicationId/stage`
  - Body: `{ "stage": "SHORTLISTED" }`
- `PATCH /ats/pipeline/:applicationId/interview`
  - Body:
    ```json
    {
      "interviewScheduledAt": "2026-04-15T11:00:00.000Z",
      "interviewerName": "Anita Rao"
    }
    ```
- `POST /ats/pipeline/:applicationId/notes`
  - Body: `{ "content": "Strong portfolio, proceed to interview." }`
- `GET /ats/applications`
  - Candidate application tracking

## Resume Builder

- `GET /resume-builder`
- `PUT /resume-builder`
  - Body:
    ```json
    {
      "template": "classic",
      "personal": { "phone": "+91..." },
      "education": [],
      "experience": [],
      "skills": ["React"],
      "projects": []
    }
    ```

## Dashboards

- `GET /dashboard/recruiter`
- `GET /dashboard/candidate`

## Auth Headers

Protected endpoints require:

```http
Authorization: Bearer <jwt>
```
