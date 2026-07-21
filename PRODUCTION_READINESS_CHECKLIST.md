# Production Readiness Checklist

## Security

- [ ] Production secrets stored outside source control
- [ ] `JWT_SECRET` rotated and strong
- [ ] `MEETING_TOKEN_ENCRYPTION_KEY` set for production when Google or Zoom integration is enabled
- [ ] `CORS_ALLOWED_ORIGINS` restricted
- [ ] `TRUST_PROXY` configured correctly
- [ ] TLS enabled
- [ ] Security headers verified
- [ ] File upload validation verified
- [ ] Offer, invitation, reset, verification, and meeting-provider state token flows validated
- [ ] Google and Zoom OAuth redirect URIs verified

## Scheduling and Providers

- [ ] Google Workspace connection validated with real credentials
- [ ] Zoom connection validated with real credentials
- [ ] Custom HTTPS meeting links validated
- [ ] Candidate, interviewer, and recruiter calendar downloads verified
- [ ] Reminder delivery verified after schedule, reschedule, and cancellation
- [ ] Reschedule limits/settings reviewed per organization

## Performance and Operations

- [ ] Database indexes reviewed for scheduling and reminder hot paths
- [ ] Redis enabled
- [ ] Elasticsearch healthy
- [ ] Worker concurrency tuned
- [ ] Reminder queue throughput observed in staging

## Monitoring

- [ ] `/api/health` monitored
- [ ] Worker logs captured
- [ ] Backend logs captured
- [ ] Redis monitored
- [ ] PostgreSQL monitored
- [ ] Elasticsearch monitored
- [ ] Provider-failure logs reviewed without secret leakage

## Testing

- [x] `npm run lint --prefix backend`
- [x] `npm run type-check --prefix backend`
- [x] `npm test --prefix backend`
- [x] `npm run build --prefix backend`
- [x] `npm run lint --prefix frontend`
- [x] `npm run type-check --prefix frontend`
- [x] `npm test --prefix frontend`
- [x] `npm run build --prefix frontend`
- [x] `npx prisma validate`
- [x] `npx prisma generate`
- [ ] Docker builds validated on a Docker-enabled machine

## Deployment

- [ ] Staging deploy completed
- [ ] Environment variables reviewed
- [ ] Nginx or ingress config reviewed
- [ ] Worker container running
- [ ] Milestone 8.5 migration reviewed before release

## Rollback

- [ ] Previous image tag available
- [ ] Database rollback policy reviewed
- [ ] Resume storage recovery plan confirmed
- [ ] Provider connection recovery runbook documented
