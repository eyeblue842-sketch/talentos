# Production Readiness Checklist

## Security

- [ ] Production secrets stored outside source control
- [ ] `JWT_SECRET` rotated and strong
- [ ] `CORS_ALLOWED_ORIGINS` restricted
- [ ] `TRUST_PROXY` configured correctly behind Nginx/load balancer
- [ ] TLS enabled
- [ ] Security headers verified
- [ ] File upload validation verified
- [ ] Offer, invitation, reset, and verification token flows validated

## Performance

- [ ] Database indexes reviewed for hot paths
- [ ] Redis enabled
- [ ] Elasticsearch healthy
- [ ] Pagination verified on large lists
- [ ] Worker concurrency tuned

## Backup and Recovery

- [ ] Database backup plan in place
- [ ] Resume storage backup plan in place
- [ ] Restore drill documented
- [ ] Rollback procedure documented

## Monitoring

- [ ] `/api/health` monitored
- [ ] Worker logs captured
- [ ] Backend logs captured
- [ ] Redis monitored
- [ ] PostgreSQL monitored
- [ ] Elasticsearch monitored

## Testing

- [ ] `npm run lint`
- [ ] `npm run type-check`
- [ ] backend tests
- [ ] frontend tests
- [ ] backend build
- [ ] frontend build
- [ ] `npx prisma validate`
- [ ] `npx prisma generate`
- [ ] Docker builds

## Browser and Accessibility

- [ ] Candidate flows manually tested
- [ ] Recruiter flows manually tested
- [ ] Admin flows manually tested
- [ ] Mobile and tablet spot checks performed
- [ ] Keyboard navigation spot checks performed

## Deployment

- [ ] Staging deploy completed
- [ ] Environment variables reviewed
- [ ] Nginx config reviewed
- [ ] Worker container running
- [ ] Migrations reviewed before release

## Rollback

- [ ] Previous image tag available
- [ ] Database rollback policy reviewed
- [ ] Resume storage recovery plan confirmed
