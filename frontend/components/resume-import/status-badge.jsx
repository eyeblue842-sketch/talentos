 "use client";

import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  getResumeImportBatchStatusMeta,
  getResumeImportItemStatusMeta,
} from '@/lib/resume-import';

export function ResumeImportStatusBadge({ status, kind = 'item' }) {
  const meta = kind === 'batch'
    ? getResumeImportBatchStatusMeta(status)
    : getResumeImportItemStatusMeta(status);
  const unknown = meta.label === 'Unknown status';

  useEffect(() => {
    if (unknown) {
      console.warn('[resume-import] unknown status', { kind, status });
    }
  }, [kind, status, unknown]);

  return (
    <Badge variant={meta.tone} title={meta.description}>
      {meta.label}
    </Badge>
  );
}
