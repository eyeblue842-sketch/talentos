# Legacy Resume Backfill

Phase 4.2 no longer serves candidate resumes from public `/uploads/...` paths. Historical `CandidateProfile.resumeUrl` values are supported only through authenticated compatibility access and should be backfilled into `ResumeAsset` records before production rollout.

## Dry run

```bash
cd backend
node scripts/backfill-legacy-resume-assets.js
```

## Apply

```bash
cd backend
node scripts/backfill-legacy-resume-assets.js --apply
```

## Behaviour

- Scans candidate profiles with `resumeUrl` values.
- Skips profiles that already have `latestResumeAssetId`.
- Migrates only trusted local legacy paths under the configured storage root.
- Rejects external URLs and invalid paths.
- Reports counts for scanned, migrated, skipped, missing, and invalid records.
- Leaves original `resumeUrl` data in place for rollback and auditability.
