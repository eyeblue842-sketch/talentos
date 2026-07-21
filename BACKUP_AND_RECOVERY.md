# Backup and Recovery

## Database Backup

Recommended:

- daily full PostgreSQL backups
- point-in-time recovery where supported
- staging restore verification on a schedule

For managed Postgres or Supabase:

- use provider-managed snapshots
- document retention and restore steps

## Resume Storage Backup

If local storage is used:

- snapshot the persistent resume volume
- test file restore separately from database restore

If S3 is used:

- enable versioning
- enable lifecycle and replication policies as required

## Redis

Redis is operational state, not the primary source of truth. Persistent recovery focuses on PostgreSQL and resume assets. Redis can be rebuilt on restart.

## Disaster Recovery

Minimum recovery sequence:

1. restore database
2. restore resume storage
3. redeploy backend, worker, frontend
4. rebuild Elasticsearch index if required
5. validate health and core auth flows

## Rollback

- container rollback to the previous image tag
- careful migration rollback only when reviewed and safe
- prefer forward-fix migrations over destructive rollback when data risk exists

## Migration Rollback

- never use destructive reset in production
- review generated SQL before deployment
- maintain migration order and artifact history
- document manual remediation for failed migrations
