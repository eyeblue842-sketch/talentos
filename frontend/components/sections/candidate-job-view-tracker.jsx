'use client';

import { useEffect } from 'react';

export function CandidateJobViewTracker({ jobId }) {
  useEffect(() => {
    fetch('/api/candidate/recent-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        source: 'JOB_DETAIL',
        referrerClassification: 'PUBLIC_JOB_DETAIL',
      }),
    }).catch(() => {});
  }, [jobId]);

  return null;
}
