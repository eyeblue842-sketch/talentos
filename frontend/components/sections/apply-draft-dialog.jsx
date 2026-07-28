"use client";

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function ApplyDraftDialog({
  open,
  onClose,
  onConfirm,
  pending = false,
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply draft"
      description="Applying this draft will update the live Job Description."
    >
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        This action can be performed again later by applying another draft.
        <br />
        Do you want to continue?
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="button" onClick={onConfirm} loading={pending}>Apply</Button>
      </div>
    </Dialog>
  );
}
