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
- `GET /jobs`
  - Recruiter jobs
- `POST /jobs`
  - Create a job posting
- `PATCH /jobs/:jobId`
- `DELETE /jobs/:jobId`

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

## ATS / Applications

- `POST /ats/apply`
  - Candidate applies to a job
  - Body: `{ "jobId": "...", "coverLetter": "..." }`
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
