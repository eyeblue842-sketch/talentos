'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import {
  inviteUserAction,
  changeUserEmailAction,
  setUserActiveAction,
} from '@/app/platform/actions';

const ROLES = ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'VIEWER'];

// Member / email administration for the platform console. Invite a new member,
// change a member's login email (forces re-verification + sign-out), or
// deactivate / reactivate an account. The ownership "last usable owner" guard is
// enforced server-side, so a blocked action surfaces as a toast here.
export function PlatformUserAdmin({ organisationId, members = [] }) {
  const router = useRouter();
  const { push } = useToast();
  const [active, setActive] = useState(null); // { key, title, description, fields, run }
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('RECRUITER');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  function open(config) {
    setEmail(config.initialEmail || '');
    setRole('RECRUITER');
    setReason('');
    setActive(config);
  }
  function close() {
    if (saving) return;
    setActive(null);
  }

  async function submit() {
    if (!active) return;
    if (active.fields?.includes('email')) {
      const trimmed = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        push({ tone: 'error', title: 'Invalid email', description: 'Enter a valid email address.' });
        return;
      }
    }
    const trimmedReason = reason.trim();
    if (active.fields?.includes('reason') && !trimmedReason) {
      push({ tone: 'error', title: 'Reason required', description: 'Add a short reason — it is recorded in the audit log.' });
      return;
    }
    setSaving(true);
    try {
      const result = await active.run({ email: email.trim(), role, reason: trimmedReason });
      if (result?.ok) {
        push({ tone: 'success', title: active.successTitle || 'Done', description: active.successDescription });
        setActive(null);
        router.refresh();
      } else {
        push({ tone: 'error', title: 'Action failed', description: result?.error || 'The operation could not be completed.' });
      }
    } catch (error) {
      push({ tone: 'error', title: 'Action failed', description: error.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-text)]">Member administration</h2>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => open({
            key: 'invite',
            title: 'Invite a member',
            description: 'Send a role-scoped invitation email. The person joins once they accept.',
            fields: ['email', 'role'],
            successTitle: 'Invitation sent',
            run: ({ email: e, role: r }) => inviteUserAction(organisationId, e, r),
          })}
        >
          Invite member
        </Button>
      </div>

      <ul className="mt-3 space-y-2">
        {members.map((m) => {
          const inactive = m.user && !m.user.isActive;
          return (
            <li key={m.membershipId} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2">
              <span className="min-w-0 text-sm">
                <span className="font-medium text-[var(--color-text)]">{m.user?.name || m.user?.email || '—'}</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">{m.user?.email}</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">· {m.role}{inactive ? ' · inactive' : ''}</span>
              </span>
              {m.user ? (
                <span className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => open({
                      key: `email:${m.user.id}`,
                      title: 'Change login email',
                      description: `Change the email for ${m.user.email}. The new address must be re-verified and the user is signed out of all sessions.`,
                      fields: ['email', 'reason'],
                      initialEmail: m.user.email,
                      successTitle: 'Email changed',
                      run: ({ email: e, reason: r }) => changeUserEmailAction(organisationId, m.user.id, e, r),
                    })}
                  >
                    Change email
                  </Button>
                  {inactive ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => open({
                        key: `activate:${m.user.id}`,
                        title: 'Reactivate account',
                        description: `Reactivate ${m.user.email}. They will be able to sign in again.`,
                        fields: ['reason'],
                        successTitle: 'Account reactivated',
                        run: ({ reason: r }) => setUserActiveAction(organisationId, m.user.id, true, r),
                      })}
                    >
                      Reactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => open({
                        key: `deactivate:${m.user.id}`,
                        title: 'Deactivate account',
                        description: `Deactivate ${m.user.email}. They are signed out everywhere and cannot sign in until reactivated. Blocked if they are an organisation's last active owner.`,
                        fields: ['reason'],
                        successTitle: 'Account deactivated',
                        run: ({ reason: r }) => setUserActiveAction(organisationId, m.user.id, false, r),
                      })}
                    >
                      Deactivate
                    </Button>
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(active)} onClose={close} title={active?.title} description={active?.description}>
        <div className="space-y-4">
          {active?.fields?.includes('email') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pua-email">Email address</label>
              <Input id="pua-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" disabled={saving} />
            </div>
          ) : null}
          {active?.fields?.includes('role') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pua-role">Role</label>
              <Select id="pua-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}
              </Select>
            </div>
          ) : null}
          {active?.fields?.includes('reason') ? (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]" htmlFor="pua-reason">Reason (audited)</label>
              <Textarea id="pua-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Why are you taking this action?" disabled={saving} />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={saving}>Cancel</Button>
            <Button type="button" variant="primary" onClick={submit} loading={saving}>Confirm</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
