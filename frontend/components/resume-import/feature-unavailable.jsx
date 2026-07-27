import { Lock, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getFeatureFlagEnvName } from '@/lib/feature-flags';

export function ResumeImportFeatureUnavailable({
  featureKey = 'bulkResumeImport',
  title = 'Bulk Resume Import is unavailable',
  description = 'This feature is currently disabled for this environment.',
  backHref,
  backLabel = 'Return to workspace',
}) {
  return (
    <Card>
      <EmptyState
        icon={Sparkles}
        title={title}
        description={`${description}${getFeatureFlagEnvName(featureKey) ? ` Enable ${getFeatureFlagEnvName(featureKey)} to expose this module.` : ''}`}
        primaryAction={backHref ? { href: backHref, label: backLabel } : undefined}
        secondaryAction={{ href: '/admin/feature-flags', label: 'Feature flags' }}
      />
      <div className="mt-4 flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
        Backend authorization remains authoritative even when the frontend flag is enabled.
      </div>
    </Card>
  );
}

