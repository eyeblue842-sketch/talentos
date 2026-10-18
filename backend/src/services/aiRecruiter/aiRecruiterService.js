import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { vapiProvider } from './providers/vapiProvider.js';
import { plivoProvider } from './providers/plivoProvider.js';
import { mapProviderEvent } from './screeningResultMapper.js';
import {
  resolveProvider,
  pickCandidatePhone,
  buildPromptVariables,
  serializeScreeningCall,
} from './screeningPlan.js';

// Re-exported so callers/tests importing from the service entry point keep working.
export { resolveProvider, serializeScreeningCall } from './screeningPlan.js';

// ---------------------------------------------------------------------------
// AI voice recruiter - orchestration service.
//
// Places an outbound HR-screening call for an Application and ingests the
// provider's webhook callbacks. Telephony is provider-routed by the
// candidate's country: PLIVO for India (+91), VAPI for everyone else. The
// whole module is a no-op unless env.aiScreeningEnabled is true, and even then
// every call is simulated (DRY_RUN) until env.aiScreeningDryRun is false AND
// the routed provider is configured - so this never dials a real number or
// spends until an operator deliberately turns it on.
// ---------------------------------------------------------------------------

function badRequest(message, code = 422) {
  const error = new Error(message);
  error.statusCode = code;
  return error;
}

function notFound(message = 'Screening call not found.') {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function forbidden(message = 'AI screening is not available.') {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

const PROVIDERS = {
  PLIVO: plivoProvider,
  VAPI: vapiProvider,
};

async function loadApplicationForOrg(applicationId, organisationId) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, candidate: true },
  });
  if (!application) {
    throw notFound('Application not found.');
  }
  // Tenant guard: the application must belong to the caller's active org.
  if (organisationId && application.organisationId && application.organisationId !== organisationId) {
    throw notFound('Application not found.');
  }
  return application;
}

export async function placeScreeningCall(user, applicationId, overrides = {}, organisationId = null, meta = {}) {
  if (!env.aiScreeningEnabled) {
    throw forbidden('AI screening is not enabled.');
  }

  const application = await loadApplicationForOrg(applicationId, organisationId);
  const { job, candidate } = application;
  if (!job || !candidate) {
    throw badRequest('This application is missing job or candidate context.');
  }

  const toPhoneNumber = pickCandidatePhone(candidate);
  if (!toPhoneNumber) {
    throw badRequest('The candidate has no phone number on file to call.');
  }

  const providerKey = resolveProvider(toPhoneNumber);
  const provider = PROVIDERS[providerKey];
  const variables = buildPromptVariables({ job, candidate, overrides });
  const callerId = providerKey === 'PLIVO' ? env.plivoScreeningCallerId : null;

  // Simulate unless we are explicitly live AND the routed provider is wired up.
  const dryRun = env.aiScreeningDryRun || !provider.isConfigured();

  const call = await prisma.screeningCall.create({
    data: {
      organisationId: application.organisationId || organisationId || null,
      applicationId: application.id,
      jobId: job.id,
      candidateId: candidate.id,
      initiatedByUserId: user?.id || null,
      provider: providerKey,
      status: 'PENDING',
      dryRun,
      toPhoneNumber,
      callerId,
      // Consent basis: the candidate applied through Careeriz, which is the
      // lawful basis for this screening call. Recorded for TRAI/DPDP evidence.
      consentCaptured: true,
      consentSource: 'application',
      promptVariables: variables,
    },
  });

  if (dryRun) {
    const updated = await prisma.screeningCall.update({
      where: { id: call.id },
      data: { status: 'DRY_RUN', dispatchedAt: new Date() },
    });
    return serializeScreeningCall(updated);
  }

  try {
    const { providerCallId } = await provider.dispatch({
      toPhoneNumber,
      callerId,
      variables,
      screeningCallId: call.id,
      candidate,
      job,
    });
    const updated = await prisma.screeningCall.update({
      where: { id: call.id },
      data: {
        status: 'QUEUED',
        providerCallId: providerCallId || null,
        dispatchedAt: new Date(),
      },
    });
    return serializeScreeningCall(updated);
  } catch (error) {
    const updated = await prisma.screeningCall.update({
      where: { id: call.id },
      data: { status: 'FAILED', errorMessage: String(error?.message || error).slice(0, 500) },
    });
    void meta;
    return serializeScreeningCall(updated);
  }
}

export async function listScreeningCalls(user, filters = {}, organisationId = null) {
  void user;
  const where = {};
  if (organisationId) where.organisationId = organisationId;
  if (filters.applicationId) where.applicationId = filters.applicationId;
  if (filters.jobId) where.jobId = filters.jobId;
  const take = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
  const calls = await prisma.screeningCall.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take,
  });
  return calls.map(serializeScreeningCall);
}

export async function getScreeningCall(user, screeningCallId, organisationId = null) {
  void user;
  const call = await prisma.screeningCall.findUnique({ where: { id: screeningCallId } });
  if (!call || (organisationId && call.organisationId && call.organisationId !== organisationId)) {
    throw notFound();
  }
  return serializeScreeningCall(call);
}

// Webhook ingestion. Provider callbacks are unauthenticated; the controller
// verifies the shared secret before this runs. We locate the ScreeningCall by
// providerCallId (preferred) or by the screeningCallId echoed back in metadata,
// then merge the mapped fields. The raw payload is always retained.
export async function ingestProviderEvent(providerKey, payload) {
  const mapped = mapProviderEvent(providerKey, payload);
  const providerCallId = mapped.providerCallId || null;
  const screeningCallId = mapped.screeningCallId || null;

  let call = null;
  if (providerCallId) {
    call = await prisma.screeningCall.findUnique({ where: { providerCallId } });
  }
  if (!call && screeningCallId) {
    call = await prisma.screeningCall.findUnique({ where: { id: screeningCallId } });
  }
  if (!call) {
    // Nothing to attach the event to - acknowledge so the provider stops
    // retrying, but record nothing.
    return { matched: false };
  }

  const data = { lastProviderEvent: payload };
  // Only overwrite fields the event actually carried.
  for (const key of [
    'status', 'outcome', 'answeredAt', 'endedAt', 'durationSeconds', 'endedReason',
    'recordingUrl', 'transcript', 'currentCtc', 'expectedCtc', 'noticePeriod',
    'noticeNegotiable', 'buyoutAvailable', 'earliestJoinDate', 'techAnswers',
    'interestSummary', 'aiSummary',
  ]) {
    if (mapped[key] !== undefined && mapped[key] !== null) {
      data[key] = mapped[key];
    }
  }
  if (providerCallId && !call.providerCallId) {
    data.providerCallId = providerCallId;
  }

  const updated = await prisma.screeningCall.update({ where: { id: call.id }, data });
  return { matched: true, call: serializeScreeningCall(updated) };
}
