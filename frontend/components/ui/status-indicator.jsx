import { Badge } from '@/components/ui/badge';

const STATUS_TONES = {
  OPEN: 'success',
  ACTIVE: 'success',
  APPROVED: 'success',
  SELECTED: 'success',
  SCHEDULED: 'info',
  INTERVIEW_SCHEDULED: 'info',
  APPLIED: 'info',
  DRAFT: 'neutral',
  PRIVATE: 'neutral',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  ON_HOLD: 'warning',
  SHORTLISTED: 'purple',
  CLOSED: 'danger',
  ARCHIVED: 'neutral',
  REJECTED: 'danger',
  WITHDRAWN: 'danger',
  INACTIVE: 'danger',
  NOT_LOOKING: 'warning',
};

export function StatusIndicator({ status }) {
  return <Badge variant={STATUS_TONES[status] || 'neutral'}>{String(status).replaceAll('_', ' ')}</Badge>;
}
