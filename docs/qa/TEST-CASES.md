# Careeriz – Application Test Cases

Target: https://www.careeriz.com (production) – run the same cases on any staging copy first.
Priority: **P1** = must pass before marketing/launch, **P2** = important, **P3** = nice to have.
Result column (in the CSV): Pass / Fail / Blocked / N/A, plus bug ID and notes.

**Test accounts to prepare**

| Alias | What it is |
|---|---|
| ADMIN | Platform super admin (`vinoj@xportisglobal.com`), also org owner of its own org |
| OWNER-A | Owner of company A (company-domain email, e.g. `sales@companya.com`) |
| REC-A2 | Second recruiter invited into company A |
| OWNER-B | Owner of company B (different domain) |
| CAND-1, CAND-2, CAND-3 | Candidate accounts (use Gmail-type addresses) |
| NEWBIE | An email address that has never registered |

**Browsers / devices:** Chrome, Edge, Safari (latest), Firefox; Android Chrome and iPhone Safari; widths 360, 768, 1280, 1920 px.

---

## 1. Setup, deployment and infrastructure (SET)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| SET-01 | Site loads over HTTPS | Open `https://www.careeriz.com` | Home page loads, valid certificate, no mixed-content warnings | P1 |
| SET-02 | HTTP redirects to HTTPS | Open `http://www.careeriz.com` | Redirects to `https://www.careeriz.com` | P1 |
| SET-03 | Apex redirects to www | Open `https://careeriz.com/jobs` | Redirects (301) to `https://www.careeriz.com/jobs` | P2 |
| SET-04 | First-run setup is closed | Open `/setup` | Redirects away (no setup form); `POST /api/setup` is rejected (409) | P1 |
| SET-05 | Certificate auto-renew | Check certificate expiry; confirm Caddy logs show managed cert | Expiry > 30 days or renewal scheduled | P2 |
| SET-06 | Backups run nightly | Check `~/backup.log` and S3 bucket `careeriz-backups-…/db/` | New dump each night, size > 1 KB, 30-day expiry | P1 |
| SET-07 | Backup restores | Restore latest dump into an empty scratch database | Restore completes; user/job row counts match | P1 |
| SET-08 | Server recovers from reboot | Reboot the instance | All 6 containers come back healthy without manual steps | P2 |
| SET-09 | Memory headroom | Check `free -m` and container stats under normal load | Available memory > 500 MB, swap not thrashing | P2 |
| SET-10 | Spend alert | Confirm AWS budget `careeriz-monthly` and email subscription | Budget exists, alerts at 50% / 80% / forecast 100% | P2 |
| SET-11 | Unknown URL | Open `/does-not-exist` | Friendly 404 page, no stack trace | P3 |
| SET-12 | Public pages without login | Open `/jobs`, `/pricing`, a job page, a company page | All load without sign-in | P1 |

## 2. Authentication and accounts (AUTH)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| AUTH-01 | Candidate sign-up – happy path | `/auth/candidate/login` → Create account; fill First name, Last name, email, password, confirm | Account created; **pop-up "Account created" with OK button**; verification email arrives | P1 |
| AUTH-02 | First & last name mandatory | Leave first name (then last name) empty | Button disabled / message "First name and last name are required"; API without `fullName` returns "Required" | P1 |
| AUTH-03 | Password rules | Try < 8 chars, 73+ chars, mismatched confirm | Clear validation messages; account not created | P1 |
| AUTH-04 | Duplicate email | Register an email that already exists | "Already registered, please sign in"; no second account | P1 |
| AUTH-05 | Employer sign-up – Company recruiter | `/hire` → Company → Create account with a company-domain email | Account + organisation created; modal mentions verification **and** pending company-domain review | P1 |
| AUTH-06 | Company recruiter with Gmail/Yahoo/Outlook | Register as Company with a free-mail address | Rejected with clear message | P1 |
| AUTH-07 | Consultancy recruiter with Gmail | Register as Consultancy with Gmail | Accepted | P2 |
| AUTH-08 | Disposable email | Register with a mailinator-type address | Rejected | P2 |
| AUTH-09 | Sign-up modal must be acknowledged | After sign-up, click outside / press Esc / click OK | Modal closes only by user action; message not lost silently | P2 |
| AUTH-10 | Verification email content | Open the email | Correct sender (no-reply@careeriz.com), link starts with `https://www.careeriz.com`, not localhost/0.0.0.0 | P1 |
| AUTH-11 | Verification link – success | Click the emailed link | Page "Your email has been verified" with **Continue to sign in**; employer goes to employer sign-in, candidate to candidate sign-in | P1 |
| AUTH-12 | Verification link – reused | Click the same link a second time | "We couldn't verify your email" with resend form and sign-in links | P1 |
| AUTH-13 | Verification link – tampered | Alter characters in the token | Same error page; token never shown in the URL | P1 |
| AUTH-14 | Resend verification | On the error page enter email, submit | Neutral message; new email arrives if account is unverified; no account enumeration | P2 |
| AUTH-15 | Login before verification | Sign in with an unverified account | Blocked with "verify your email" message | P1 |
| AUTH-16 | Login – happy path | Sign in with verified candidate / recruiter | Candidate lands on candidate dashboard; recruiter on recruiter home | P1 |
| AUTH-17 | Login – wrong password / unknown user | Try both | Same generic "Invalid credentials" for both; no hint which is wrong | P1 |
| AUTH-18 | Login rate limit | 11 wrong attempts quickly | Throttled (429 / message) | P2 |
| AUTH-19 | Deactivated account | Deactivate a user (admin) then sign in / use old session | Cannot sign in; existing session stops working | P1 |
| AUTH-20 | Logout – top-right button | Click **Logout** in the top bar (recruiter and admin pages) | Signed out, redirected to `/hire` (recruiter) or sign-in; back button does not show protected data | P1 |
| AUTH-21 | Logout – sidebar | Click sidebar Logout | Same as AUTH-20 | P2 |
| AUTH-22 | Session persistence | Close/reopen browser within session lifetime; wait past expiry | Stays signed in until expiry, then asked to sign in | P2 |
| AUTH-23 | Password reset | Forgot password → email/OTP → set new password | Old password stops working; new works; link single-use | P1 |
| AUTH-24 | Password reset – expired/invalid | Use an old link | Clear error, no password change | P2 |
| AUTH-25 | Google sign-in – candidate (new) | Candidate login → Continue with Google with a new Google account | Account created, signed in, lands on candidate dashboard | P1 |
| AUTH-26 | Google sign-in – existing | Same Google account again | Signs in to the same account | P1 |
| AUTH-27 | Google sign-in – cancelled | Cancel on the Google consent screen | Returns to login with a clear message | P2 |
| AUTH-28 | Google hidden for company recruiters | Open company-recruiter login | No Google button (per policy) | P2 |
| AUTH-29 | Must-change-password flow | Create a user flagged to change password; sign in | Forced to change-password page before anything else | P2 |
| AUTH-30 | Role isolation after login | Candidate opens `/recruiter/home`; recruiter opens `/candidate/dashboard` | Redirected away / denied | P1 |

## 3. Team invitations (INV)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| INV-01 | Send invitation | OWNER-A → Members → invite `REC-A2` email with role Recruiter | Invitation listed as Pending; email sent | P1 |
| INV-02 | Email content | Open the email | Names the inviter ("Vinoj (email) has invited you…"), organisation, role, link on its own line, expiry date | P1 |
| INV-03 | Same-domain invite | Invite another address at the owner's company domain | Allowed | P1 |
| INV-04 | Duplicate pending invite | Invite the same address again | "Active invitation already exists" – no second email | P2 |
| INV-05 | Link opens for a new user | Open link in a private window | Shows organisation, role, expiry and the **sign-up form** (work email read-only, name, password, confirm) | P1 |
| INV-06 | Create account from invitation | Fill and submit | Account created (already verified), joined to organisation **with the invited role**, signed in, lands on recruiter home | P1 |
| INV-07 | Password mismatch / short | Submit invalid | Inline error; nothing created | P2 |
| INV-08 | Existing account | Invitee already has an account; open link | "Account already exists – sign in" path works and returns to the invitation | P1 |
| INV-09 | Wrong account signed in | Open link while signed in as a different user | "Wrong account" notice with **Sign out and continue** | P1 |
| INV-10 | Accept error shown | Force a rejection (e.g. revoke then accept) | Reason shown on the page; no 500; token kept in URL | P1 |
| INV-11 | Expired invitation | Open after expiry | "Invitation expired/unavailable" | P1 |
| INV-12 | Revoked invitation | Owner revokes; invitee opens link | Not usable | P1 |
| INV-13 | Resend | Owner resends | New link works, old link stops working | P1 |
| INV-14 | Link reuse | Use the link after acceptance | Not usable again | P1 |
| INV-15 | Role enforced | Invite as Hiring Manager / Interviewer; check menus | Only the permitted areas are visible and reachable | P1 |
| INV-16 | Owner notified | After acceptance check the owner's notifications | "Invitation accepted" notification | P3 |
| INV-17 | Invitee name shown | After sign-up open Members and recruiter home | Invitee's name displayed (not "Recruiter home") | P2 |

## 4. Recruiter workspace and organisation (REC)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| REC-01 | Home heading | Open recruiter home | Heading shows the user's name (or email prefix if no name), not "Recruiter home" | P1 |
| REC-02 | Settings – set name | Settings → Your profile → enter first/last → Save | "Name saved"; heading updates after refresh | P1 |
| REC-03 | Settings – blank names | Save with empty fields | Validation error | P2 |
| REC-04 | Sidebar clean | Look at the bottom of the sidebar | No organisation/tagline box; Logout button present | P2 |
| REC-05 | Top-right bar | Look at top-right | Messages (mail) icon with unread badge + Logout button | P1 |
| REC-06 | Messages icon target | Click the mail icon | Opens Connections → Messages | P2 |
| REC-07 | Notifications bell | Trigger a notification; open bell | Count updates; items link correctly; mark as read works | P1 |
| REC-08 | Company profile | Edit About, logo, website, industry | Saved; reflected on the public company page | P1 |
| REC-09 | Blog / company posts | Create, edit, delete an organisation post | Appears on the company page and followers' feeds | P2 |
| REC-10 | Members page | View members, change a role, deactivate a member | Changes apply immediately; last owner cannot be removed | P1 |
| REC-11 | Unverified organisation limits | Use an organisation whose domain is pending review | Gated actions (e.g. inviting/posting) show a clear message | P2 |
| REC-12 | Tabs on home | Switch Home / About / Blog / Jobs / Connections / Insights | Each shows its own content; URLs are shareable | P2 |

## 5. Jobs (JOB)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| JOB-01 | Create a job – full wizard | Recruiter → Post a Job; complete every step | Job saved; validation on required fields; draft can be resumed | P1 |
| JOB-02 | Publish | Publish the job | Appears on `/jobs` and on the company page with a stable slug URL | P1 |
| JOB-03 | Private / draft job | Keep a job unpublished | Not visible publicly; direct URL gives 404 | P1 |
| JOB-04 | Edit a live job | Change salary/skills | Public page updates; applicants unaffected | P2 |
| JOB-05 | Close / archive | Close the job | Removed from listings; "no longer accepting applications" on direct URL; apply disabled | P1 |
| JOB-06 | Application deadline | Set a past deadline | Job hidden/closed automatically | P2 |
| JOB-07 | JD generator / templates | Generate and save a JD draft | Draft saved; fields map correctly into the job | P2 |
| JOB-08 | Job search & filters | `/jobs` filter by keyword, location, experience | Correct results; empty state when none | P1 |
| JOB-09 | SEO / sharing | Open a job page source | Title, description, canonical URL present | P3 |
| JOB-10 | LinkedIn opt-in default | Open wizard share step | "Also share this job on LinkedIn" defaults to **No** | P2 |

## 6. Candidate experience (CAN)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| CAN-01 | Profile completion | Fill headline, experience, skills, education | Saved; completeness indicator updates | P1 |
| CAN-02 | Resume upload / parse | Upload PDF and DOCX | Parsed fields prefilled; errors for unsupported/large files | P1 |
| CAN-03 | Apply to a job | Open job → Apply | Application created once; success screen; appears under Applications | P1 |
| CAN-04 | Duplicate apply | Apply again to the same job | Prevented with a clear message | P1 |
| CAN-05 | Apply while signed out | Click Apply logged out | Sent to login, returns to the job afterwards | P1 |
| CAN-06 | Saved jobs | Save and unsave a job | List updates | P2 |
| CAN-07 | Find Jobs tabs | Saved / Applications / Interviews / Offers tabs | Each shows the correct data | P2 |
| CAN-08 | Application status updates | Recruiter moves the application stage | Candidate sees the new status + notification | P1 |
| CAN-09 | Interview schedule | Recruiter schedules an interview | Candidate sees date/link; reschedule works | P1 |
| CAN-10 | Offer flow | Recruiter releases an offer | Candidate can view, accept/decline; status syncs to recruiter | P1 |
| CAN-11 | Privacy settings | Set profile to Private / Recruiters only / Public | Visibility changes in search accordingly | P1 |
| CAN-12 | Notifications | Open bell on the candidate top bar | Items listed, links open the right page | P2 |

## 7. Recruiter ATS and hiring (ATS)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ATS-01 | Applicant list per job | Open a job with applicants | Correct list, counts and filters | P1 |
| ATS-02 | Move stage | Drag/change stage of an applicant | Stage saved, audit trail kept, candidate notified | P1 |
| ATS-03 | Job responses triage | Use Job Responses; bulk shortlist/reject | Bulk actions apply to selected only; bulk email sent | P2 |
| ATS-04 | Interview scheduling | Schedule, reschedule, cancel | Calendar entry + candidate email; conflicts flagged | P1 |
| ATS-05 | Feedback | Interviewer submits feedback | Visible to allowed roles only | P2 |
| ATS-06 | Offers | Create, approve, release an offer | Approval chain respected; PDF/letter correct | P1 |
| ATS-07 | Candidate invites | Send an invite to a candidate for a job | Email sent; candidate can open the job | P2 |
| ATS-08 | Cross-org isolation | OWNER-B opens a URL of company A's applicant | 403/404 – no data leak | P1 |
| ATS-09 | Requisitions / openings | Create a requisition and link to jobs | Counts and approvals work | P3 |
| ATS-10 | Analytics | Open intelligence/analytics pages | Numbers match underlying data; no errors on empty data | P3 |

## 8. Resume databank and search (RES)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| RES-01 | Import resumes | Upload multiple resumes | Batch processed; per-file status; failures retryable | P1 |
| RES-02 | Search by keyword/skill | Search a skill present in imports | Relevant results ranked; filters work | P1 |
| RES-03 | Empty / no results | Search nonsense | Friendly empty state | P3 |
| RES-04 | Candidate detail | Open a candidate from search | Shows parsed data; contact visibility follows candidate privacy | P1 |
| RES-05 | Talent pools / saved searches | Create a pool, add a candidate | Persists and is shared per org rules | P2 |
| RES-06 | Large import | Import 100+ files | No timeouts; worker memory stays healthy | P2 |

## 9. Connections, feed and posts (NET)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| NET-01 | Tab order | Recruiter home → Connections | Order: **Feed, Discover, My Connections, Invitations, Messages, Company People**; opens on Feed | P1 |
| NET-02 | Tabs show different content | Click each tab | Discover = search + suggestions + privacy; My Connections = accepted; Invitations = received + sent | P1 |
| NET-03 | Search keeps the tab | Search in Discover | Stays on Discover with results | P2 |
| NET-04 | Recruiter ↔ recruiter blocked | OWNER-A searches for OWNER-B / REC-A2 | Recruiters never appear in suggestions or search | P1 |
| NET-05 | Recruiter request to recruiter via API | Call send-request with a recruiter target | 403 "Recruiters connect with candidates only" | P1 |
| NET-06 | Recruiter → candidate request | Send, candidate accepts | Connection created on both sides | P1 |
| NET-07 | Candidate → recruiter request | Send from candidate; recruiter accepts | Works | P1 |
| NET-08 | Decline / withdraw / remove | Exercise each action | State updates both sides; can re-request after decline | P2 |
| NET-09 | Block user | Block someone | No requests/messages/feed between the two | P2 |
| NET-10 | Privacy "requests from" | Set candidate to Nobody / Recruiters only | Requests blocked accordingly | P2 |
| NET-11 | Candidate posts | Candidate writes a post (with and without image URL) | Appears in own and connections' feeds | P1 |
| NET-12 | Recruiter posts | Recruiter writes a plain update | Appears in recruiter and connected candidates' feeds | P1 |
| NET-13 | Hiring text blocked | Recruiter posts "We are hiring a Java developer, apply now" | Rejected with guidance to use a Careeriz job link | P1 |
| NET-14 | Variants of hiring text | "Vacancy", "walk-in", "send your CV", "looking for a … engineer" | All rejected | P1 |
| NET-15 | Own job link allowed | Post a link to an own open public job (use the Attach drop-down) | Posted; shows a **job card** (title, company, location, View & apply) | P1 |
| NET-16 | Other company's / closed / private job link | Post such a link | Rejected | P1 |
| NET-17 | Hiring text + link + email/phone/other URL | Add contact details to a hiring post | Rejected | P1 |
| NET-18 | Job card for candidates | Candidate opens a recruiter post with a job link | Card visible; **View & apply** opens the job | P1 |
| NET-19 | Links clickable | Post with a normal URL | Link clickable, opens in new tab with `noopener` | P2 |
| NET-20 | Like toggle | Like then unlike a post | Count +1 / −1, button state correct, no duplicates after refresh | P1 |
| NET-21 | Share toggle | Share then unshare | Same as NET-20; shared post appears for the sharer's connections | P1 |
| NET-22 | Counts only | Check the post UI | Only counts shown – no list of who liked | P1 |
| NET-23 | "X liked/shared this" line | Connection likes a third person's post | Line appears on viewer's feed for that post | P2 |
| NET-24 | Visibility | React to a post from an unconnected author via API | 404 | P1 |
| NET-25 | Delete own post | Delete a post | Removed everywhere; cannot delete others' posts | P1 |
| NET-26 | Like notification | Another user likes your post | One notification "Your post has N likes" (no name); more likes update the same unread notification | P1 |
| NET-27 | Share notification | Another user shares | "Your post has been shared N time(s)" | P2 |
| NET-28 | No self-notification | Like your own post | No notification | P3 |
| NET-29 | Empty feed | New recruiter with no connections | "Your feed is empty" guidance | P3 |
| NET-30 | Load more | Create > 10 posts | Load more fetches next page without duplicates | P2 |
| NET-31 | Company People | Open last tab | Lists only the org's members, with invitation count | P2 |
| NET-32 | XSS in posts | Post `<script>alert(1)</script>` and `<img onerror>` | Rendered as text; nothing executes | P1 |
| NET-33 | Very long post / emoji / multilingual | 4000 chars, emoji, Hindi text | Saved and displayed correctly; 4001 chars rejected | P3 |

## 10. Messaging (MSG)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| MSG-01 | Start conversation with a connection | Message from a profile card | Conversation created; appears for both | P1 |
| MSG-02 | Send / receive | Exchange messages | Delivered in order; unread badge updates within ~30 s | P1 |
| MSG-03 | Non-connection | Try to message a stranger | Blocked or request-gated per rules | P1 |
| MSG-04 | Unread badge | Read messages | Badge clears | P2 |
| MSG-05 | Long history | Conversation with 100+ messages | Pagination works | P3 |

## 11. Billing and plans (BIL)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| BIL-01 | Pricing page | Open `/pricing` | Loads (no error); plans listed; buttons work | P1 |
| BIL-02 | Checkout | Start a paid plan checkout | Blocked until Razorpay keys are configured – verify friendly message | P1 |
| BIL-03 | After keys configured: pay, fail, cancel | Run each on test mode | Plan activates only after a successful payment; failures leave plan unchanged | P1 |
| BIL-04 | Invoices | Open billing page | Invoices/receipts listed correctly | P2 |
| BIL-05 | Entitlement limits | Exceed plan limits (jobs/users) | Clear upgrade prompt, no silent failure | P2 |
| BIL-06 | Complimentary grant (admin) | Platform console → grant | Plan active with correct dates | P2 |

## 12. Platform console (PLT)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| PLT-01 | Access control | Open `/platform` as a normal recruiter / candidate / logged out | Denied | P1 |
| PLT-02 | Owner access | Open as ADMIN | Console loads (organisations, users, billing, email admin) | P1 |
| PLT-03 | Domain review | Approve/reject a pending company domain | Organisation status changes; owner notified | P1 |
| PLT-04 | Impersonation / destructive actions | Try each admin action | Confirmations required; audit log written | P2 |
| PLT-05 | LinkedIn console | Open `/platform/linkedin` | Super-admin only; publishing flag off by default | P2 |

## 13. LinkedIn distribution (LIN) – only after the LinkedIn app is configured

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| LIN-01 | Connect a profile | Platform console → connect | Identity comes from LinkedIn member id only | P2 |
| LIN-02 | Controlled live post | Enable publishing, publish one test job | One post on the intended profile only; none elsewhere | P1 |
| LIN-03 | Opt-out respected | Job with "share on LinkedIn" = No | Nothing posted | P1 |
| LIN-04 | Failure handling | Simulate a timeout | Marked "needs action", never auto-reposted | P1 |

## 14. Email and notifications (EML)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| EML-01 | Deliverability | Send verification/invite/reset to Gmail, Outlook, a company mailbox | Arrives (inbox, not spam) within 2 min | P1 |
| EML-02 | Links | Open every link in each email type | All point to `https://www.careeriz.com`, none to localhost/internal hosts | P1 |
| EML-03 | Failure retry | Break SMTP temporarily | Email queued and retried later; app does not error | P2 |
| EML-04 | Content correctness | Check names, dates (timezone), role names | No placeholders / `undefined` / raw enum text | P2 |
| EML-05 | Unsubscribe / preferences | Where offered | Honoured | P3 |

## 15. Security (SEC)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| SEC-01 | Authorisation on APIs | Call recruiter APIs with a candidate token and vice versa | 403 | P1 |
| SEC-02 | Cross-organisation access (IDOR) | OWNER-B requests company A's jobs/applicants/members by id | 403/404 | P1 |
| SEC-03 | Cross-user access | CAND-2 requests CAND-1's applications/messages/profile edits | Denied | P1 |
| SEC-04 | Open redirect | `?next=//evil.com`, `?next=https://evil.com` on login/verification | Ignored; stays on-site | P1 |
| SEC-05 | XSS | Inject script into names, company name, job description, messages | Escaped everywhere, including emails | P1 |
| SEC-06 | SQL injection | `' OR 1=1 --` in search/login fields | No error leakage, no bypass | P1 |
| SEC-07 | Brute force | Repeated login / reset / sign-up | Rate limited | P1 |
| SEC-08 | Token handling | Inspect cookies | Session cookie is HttpOnly, Secure, SameSite | P1 |
| SEC-09 | Secrets not exposed | View page source, network responses, error pages | No keys, stack traces, internal URLs | P1 |
| SEC-10 | Security headers | Check response headers | HSTS, no sensitive server banners | P2 |
| SEC-11 | File upload abuse | Upload `.exe`, huge file, renamed script | Rejected | P1 |
| SEC-12 | Server access | Port scan the server | Only 80/443 open to the world; SSH only from allowed address | P1 |
| SEC-13 | Logs | Review Caddy/app logs | Tokens redacted in access logs | P2 |

## 16. Non-functional (NFR)

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| NFR-01 | Page speed | Lighthouse on home, jobs, job page, recruiter home | LCP < 3 s on a normal connection | P2 |
| NFR-02 | Concurrent users | 50 simultaneous users browsing/applying | Error rate < 1%, memory stable | P1 |
| NFR-03 | Responsive layout | Check main pages at 360/768/1280 px | No horizontal scroll, controls usable | P1 |
| NFR-04 | Accessibility | Keyboard-only run of login, apply, post; screen-reader labels | All reachable, visible focus, modal traps focus | P2 |
| NFR-05 | Browser matrix | Run the P1 cases in Chrome, Edge, Safari, Firefox, mobile | Same behaviour | P1 |
| NFR-06 | Time zones / dates | Users in IST and another zone | Dates and expiry shown consistently | P3 |
| NFR-07 | Data volume | 1,000 jobs / 10,000 candidates | Lists paginate, search stays fast | P2 |
| NFR-08 | Error handling | Disconnect network mid-action | Clear message; no duplicate submissions | P2 |
| NFR-09 | Back/forward and refresh | Use browser navigation during multi-step forms | No lost data / broken state | P3 |

## 17. Regression checks for issues already found and fixed

Re-run these after every deployment – each one was a real bug.

| ID | Past bug | Check | Expected | Pri |
|---|---|---|---|---|
| REG-01 | Wizard posted to `localhost:5000` | Fresh environment: open setup wizard | Calls the site's own address; completes | P1 |
| REG-02 | Invitation page returned 500 and showed "Invitation missing" | Open a valid invitation link (signed out and signed in) | Page renders; never "Invitation missing" for a valid token | P1 |
| REG-03 | Accept error crashed the page | Accept as the wrong account | Reason displayed; token kept | P1 |
| REG-04 | `/pricing` crashed (same cause as REG-02) | Open `/pricing` | Loads | P1 |
| REG-05 | Verification link went to `https://0.0.0.0:3000` | Click a verification link from email | Lands on `www.careeriz.com/auth/verify-email` | P1 |
| REG-06 | Three Connections tabs showed identical content | Click Discover / My Connections / Invitations | Different content on each | P1 |
| REG-07 | Package lock missing `pizzip` / `docxtemplater` | Docker build from a clean checkout | Build succeeds | P2 |
| REG-08 | Google sign-in "not configured" | Click Continue with Google on production | Reaches Google's sign-in page, returns signed in | P1 |
| REG-09 | Recruiter heading "Recruiter home" | Open recruiter home | Shows the name | P2 |
| REG-10 | SSH locked after home IP change | Check access after an IP change | Know how to re-allow (AWS login + security-group update) | P3 |

---

### How to report a bug
ID of the case, environment/browser, exact steps, expected vs actual, screenshot or screen recording, time of occurrence (so server logs can be matched), account used.
