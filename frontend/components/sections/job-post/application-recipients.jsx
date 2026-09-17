"use client";

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

// UX-2 Part 9: application-notification recipients. Recipients can ONLY be
// chosen from the organisation's eligible members - arbitrary external emails
// cannot be typed. The backend re-validates every address against active
// membership (jobService.buildNotificationRecipients) and is the source of
// truth; this control is the convenience layer, not the authority.
//
// Self-contained: renders its own hidden form fields
// (`applicationNotificationEmail` + `applicationNotificationEmailsJson`) so it
// works in both the create wizard and the edit form, which both submit via
// FormData.

function normalise(value) {
  return String(value || '').trim().toLowerCase();
}

function memberEmail(member) {
  return String(member?.email || member?.user?.email || '').trim();
}

export function ApplicationRecipients({
  members = [],
  defaultPrimary = '',
  defaultAdditional = [],
  recruiterEmail = '',
}) {
  const eligible = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const member of members) {
      const email = memberEmail(member);
      if (!email) continue;
      const key = normalise(email);
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(email);
    }
    // The recruiter's own email is always an eligible primary even if the
    // members list has not loaded it yet.
    if (recruiterEmail && !seen.has(normalise(recruiterEmail))) list.push(recruiterEmail.trim());
    return list;
  }, [members, recruiterEmail]);

  const eligibleKeys = useMemo(() => new Set(eligible.map(normalise)), [eligible]);

  // A saved primary is PRESERVED even if it is not currently in the members
  // list (e.g. members not loaded, or the member left) - dropping it here would
  // let an unrelated edit silently wipe the recipient. The backend re-validates
  // and excludes truly ineligible addresses at send time; a warning is shown.
  const initialPrimary = defaultPrimary
    ? String(defaultPrimary).trim()
    : (recruiterEmail && eligibleKeys.has(normalise(recruiterEmail)))
      ? eligible.find((email) => normalise(email) === normalise(recruiterEmail))
      : (eligible[0] || '');

  const [primary, setPrimary] = useState(initialPrimary || '');
  const [additional, setAdditional] = useState(() => {
    const seen = new Set([normalise(initialPrimary)]);
    const out = [];
    for (const raw of Array.isArray(defaultAdditional) ? defaultAdditional : []) {
      const key = normalise(raw);
      if (!key || seen.has(key)) continue; // preserve saved additional (deduped)
      seen.add(key);
      out.push(eligible.find((email) => normalise(email) === key) || String(raw).trim());
    }
    return out;
  });
  const [pending, setPending] = useState('');

  // The primary dropdown always includes the current primary as an option, even
  // when it is a stale saved value not in the members list, so it renders and
  // submits unchanged until the recruiter deliberately changes it.
  const primaryOptions = useMemo(() => {
    if (!primary || eligibleKeys.has(normalise(primary))) return eligible;
    return [primary, ...eligible];
  }, [eligible, eligibleKeys, primary]);

  // Saved recipients that are no longer eligible (e.g. member left the org):
  // surface them as a clear warning rather than silently dropping.
  const staleRecipients = useMemo(() => {
    const saved = [defaultPrimary, ...(Array.isArray(defaultAdditional) ? defaultAdditional : [])]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return [...new Set(saved.filter((email) => !eligibleKeys.has(normalise(email))))];
  }, [defaultPrimary, defaultAdditional, eligibleKeys]);

  const additionalOptions = useMemo(() => {
    const chosen = new Set([normalise(primary), ...additional.map(normalise)]);
    return eligible.filter((email) => !chosen.has(normalise(email)));
  }, [eligible, primary, additional]);

  function addPending() {
    const key = normalise(pending);
    if (!key || !eligibleKeys.has(key)) return;
    if (normalise(primary) === key || additional.some((email) => normalise(email) === key)) return;
    setAdditional((current) => [...current, eligible.find((email) => normalise(email) === key)]);
    setPending('');
  }

  function removeAdditional(email) {
    setAdditional((current) => current.filter((item) => normalise(item) !== normalise(email)));
  }

  function changePrimary(next) {
    setPrimary(next);
    // Never let the new primary also sit in the additional list.
    setAdditional((current) => current.filter((email) => normalise(email) !== normalise(next)));
  }

  return (
    <div className="grid gap-3 md:col-span-2">
      <input type="hidden" name="applicationNotificationEmail" value={primary} />
      <input type="hidden" name="applicationNotificationEmailsJson" value={JSON.stringify(additional)} />

      <Select
        label="Receive applications at"
        value={primary}
        onChange={(event) => changePrimary(event.target.value)}
        helpText="Choose an organisation-linked email. Defaults to your account email."
      >
        {primaryOptions.length === 0 ? <option value="">No organisation emails available</option> : null}
        {primaryOptions.map((email) => <option key={email} value={email}>{email}</option>)}
      </Select>

      <div className="grid gap-2">
        <span className="text-sm font-semibold text-[var(--color-text)]">Also notify (optional)</span>
        <div className="flex flex-wrap items-end gap-2">
          <Select
            className="min-w-0 flex-1"
            aria-label="Add an additional recipient"
            value={pending}
            onChange={(event) => setPending(event.target.value)}
            disabled={additionalOptions.length === 0}
          >
            <option value="">{additionalOptions.length ? 'Select a team member…' : 'No more eligible members'}</option>
            {additionalOptions.map((email) => <option key={email} value={email}>{email}</option>)}
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={addPending} disabled={!pending}>
            <Plus size={16} aria-hidden="true" />
            Add
          </Button>
        </div>
        {additional.length ? (
          <ul className="flex flex-wrap gap-2" aria-label="Additional recipients">
            {additional.map((email) => (
              <li key={email} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                {email}
                <button type="button" onClick={() => removeAdditional(email)} aria-label={`Remove ${email}`} className="inline-flex">
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Only the primary recipient will be notified.</p>
        )}
        {staleRecipients.length ? (
          <p className="text-sm text-[var(--color-danger)]">
            {staleRecipients.join(', ')} {staleRecipients.length === 1 ? 'is' : 'are'} no longer an eligible organisation member and will not be notified.
          </p>
        ) : null}
      </div>
    </div>
  );
}
