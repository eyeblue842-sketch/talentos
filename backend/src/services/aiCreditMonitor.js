import { env } from '../config/env.js';
import { getIntelligenceProviderHealth } from '../intelligence/services/providerService.js';
import { sendRecruiterOutreachEmail } from './emailService.js';

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;

let lastAlertAt = 0;

export function isOutOfCredits(health) {
  return Boolean(health && !health.healthy
    && (health.code === 'credit_balance_exhausted' || health.code === 'insufficient_quota' || health.errorType === 'insufficient_quota'));
}

// Emails the platform owner once when the AI provider reports no credits, then at most once a day
// while it stays that way. State is in memory, so a worker restart may repeat one email.
export async function checkAiCredits({ now = Date.now(), send = sendRecruiterOutreachEmail } = {}) {
  if (!env.intelligenceEnabled || !env.platformSuperAdminEmail) return 'skipped';
  const health = await getIntelligenceProviderHealth();
  if (!isOutOfCredits(health)) {
    lastAlertAt = 0;
    return 'ok';
  }
  if (lastAlertAt && now - lastAlertAt < REMINDER_INTERVAL_MS) return 'already-alerted';
  lastAlertAt = now;
  await send(
    env.platformSuperAdminEmail,
    'Careeriz: OpenAI credits have run out - please recharge',
    [
      `The ${health.provider || 'OpenAI'} account used by Careeriz (model ${health.model || 'unknown'}) reports that its credits are exhausted.`,
      '',
      'Until credits are added, resume uploads fall back to the basic parser and AI job descriptions will not work.',
      '',
      'Recharge here: https://platform.openai.com/settings/organization/billing/overview',
      '',
      'This reminder repeats once a day until credits are added.',
    ].join('\n'),
  );
  return 'alerted';
}

export function startAiCreditMonitor({ log = console } = {}) {
  const run = () => checkAiCredits().catch((error) => log.error?.(JSON.stringify({ level: 'error', event: 'ai.credit_monitor.error', message: error?.message })));
  setTimeout(run, 60 * 1000).unref?.();
  setInterval(run, CHECK_INTERVAL_MS).unref?.();
}
