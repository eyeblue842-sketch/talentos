import { prisma } from '../../config/db.js';
import { recordAuditLog } from '../../services/auditLogService.js';
import { requireIntelligenceFeature } from './featureAccessService.js';
import { createIntelligenceExecution, completeIntelligenceExecution, createFingerprint, getFreshCachedResult, recordIntelligenceFailure, storeIntelligenceResult, supersedeCachedResults } from './governanceService.js';
import { executeStructuredPrompt } from './intelligenceRuntimeService.js';
import { projectResumeForIntelligence } from '../redaction/projectionService.js';
import { enforceIntelligenceUsageLimits } from './usageService.js';

function buildDeterministicResumeBaseline(candidate, resumeAsset) {
  const experienceEntries = Array.isArray(candidate.experienceEntries) ? candidate.experienceEntries : [];
  const educationEntries = Array.isArray(candidate.educationEntries) ? candidate.educationEntries : [];
  const certificationEntries = Array.isArray(candidate.certificationEntries) ? candidate.certificationEntries : [];
  return {
    professionalSummary: candidate.summary || `${candidate.fullName} is a ${candidate.currentTitle || candidate.headline || 'professional'} based in ${candidate.location || 'their current location'}.`,
    workHistorySummary: experienceEntries.length
      ? experienceEntries.slice(0, 3).map((entry) => `${entry.jobTitle || entry.title || 'Role'} at ${entry.employer || entry.company || 'Employer'}`).join('; ')
      : 'Work history is limited or still needs review.',
    educationSummary: educationEntries.length
      ? educationEntries.slice(0, 2).map((entry) => `${entry.degree || 'Degree'} from ${entry.institution || entry.school || 'Institution'}`).join('; ')
      : 'Education details are limited or still need review.',
    certifications: certificationEntries.map((entry) => entry.name || entry.label).filter(Boolean).slice(0, 15),
    skillClusters: Array.isArray(candidate.skills) ? candidate.skills.slice(0, 20) : [],
    dataGaps: [
      !candidate.summary ? 'Professional summary missing' : null,
      !experienceEntries.length ? 'Structured experience entries missing' : null,
      !educationEntries.length ? 'Structured education entries missing' : null,
      !resumeAsset?.parsedText ? 'Resume parsed text is unavailable' : null,
    ].filter(Boolean),
  };
}

export async function getResumeIntelligence(actorUser, payload, requestMeta = {}) {
  const context = await requireIntelligenceFeature(actorUser, 'RESUME_SUMMARY', null, 'read');
  const candidate = await prisma.candidateProfile.findUnique({ where: { id: payload.candidateId } });
  if (!candidate) {
    const error = new Error('Candidate not found.');
    error.statusCode = 404;
    throw error;
  }

  const resumeAsset = payload.resumeAssetId
    ? await prisma.resumeAsset.findFirst({ where: { id: payload.resumeAssetId, candidateId: candidate.id, kind: 'RESUME', status: { not: 'DELETED' } } })
    : await prisma.resumeAsset.findFirst({ where: { candidateId: candidate.id, kind: 'RESUME', status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }] });

  const deterministic = buildDeterministicResumeBaseline(candidate, resumeAsset);
  const sourceFingerprint = createFingerprint({
    candidateUpdatedAt: candidate.updatedAt,
    resumeUpdatedAt: resumeAsset?.updatedAt || resumeAsset?.createdAt || null,
    parsedText: resumeAsset?.parsedText || null,
    parsedData: resumeAsset?.parsedData || null,
    skills: candidate.skills,
  });

  if (!payload.forceRegenerate) {
    const cached = await getFreshCachedResult({
      organisationId: context.organisationId,
      entityType: 'ResumeIntelligence',
      entityId: resumeAsset?.id || candidate.id,
      sourceFingerprint,
      resultVersion: 'resume-intelligence-v1',
      promptVersion: '1.0.0',
    });
    if (cached) {
      return {
        executionId: cached.executionId,
        fromCache: true,
        generatedAt: cached.createdAt,
        ...cached.normalizedOutput,
      };
    }
  }

  if (context.enabled) {
    await enforceIntelligenceUsageLimits({
      organisationId: context.organisationId,
      userId: actorUser.id,
      feature: 'RESUME_SUMMARY',
    });
  }

  const execution = await createIntelligenceExecution({
    organisationId: context.organisationId,
    requestedByUserId: actorUser.id,
    feature: 'RESUME_SUMMARY',
    promptKey: 'RESUME_SUMMARY',
    promptVersion: '1.0.0',
    provider: context.enabled ? undefined : 'DISABLED',
    inputPayload: { candidateId: candidate.id, resumeAssetId: resumeAsset?.id || null },
  });

  try {
    let enhanced = null;
    let skillExtraction = null;
    let usage = {};

    if (context.enabled) {
      const [summaryRuntime, skillsRuntime] = await Promise.all([
        executeStructuredPrompt({
          promptKey: 'RESUME_SUMMARY',
          input: projectResumeForIntelligence(candidate, resumeAsset),
        }),
        executeStructuredPrompt({
          promptKey: 'RESUME_SKILL_EXTRACTION',
          input: projectResumeForIntelligence(candidate, resumeAsset),
        }),
      ]);
      enhanced = summaryRuntime.output;
      skillExtraction = skillsRuntime.output;
      usage = {
        promptTokens: (summaryRuntime.promptTokens || 0) + (skillsRuntime.promptTokens || 0),
        completionTokens: (summaryRuntime.completionTokens || 0) + (skillsRuntime.completionTokens || 0),
        latencyMs: Math.max(summaryRuntime.latencyMs || 0, skillsRuntime.latencyMs || 0),
        outputCharacterCount: (summaryRuntime.rawText?.length || 0) + (skillsRuntime.rawText?.length || 0),
      };
    }

    await supersedeCachedResults({
      organisationId: context.organisationId,
      entityType: 'ResumeIntelligence',
      entityId: resumeAsset?.id || candidate.id,
      resultVersion: 'resume-intelligence-v1',
    });

    const normalizedOutput = {
      deterministic,
      aiSummary: enhanced,
      aiSkillExtraction: skillExtraction,
      generatedLabel: enhanced ? 'AI-generated suggestion. Review before use.' : 'Deterministic resume baseline. AI enhancement unavailable.',
      sourceResumeId: resumeAsset?.id || null,
      sourceResumeUpdatedAt: resumeAsset?.updatedAt || resumeAsset?.createdAt || null,
      generationTimestamp: new Date().toISOString(),
    };

    const stored = await storeIntelligenceResult({
      organisationId: context.organisationId,
      executionId: execution.id,
      entityType: 'ResumeIntelligence',
      entityId: resumeAsset?.id || candidate.id,
      sourceFingerprint,
      resultVersion: 'resume-intelligence-v1',
      promptVersion: '1.0.0',
      normalizedOutput,
      explanation: enhanced?.professionalSummary || deterministic.professionalSummary,
      feature: 'RESUME_SUMMARY',
    });

    await completeIntelligenceExecution(execution.id, {
      status: context.enabled ? 'SUCCEEDED' : 'SKIPPED',
      ...usage,
      outputCharacterCount: JSON.stringify(normalizedOutput).length,
    });

    await recordAuditLog({
      organisationId: context.organisationId,
      actorUserId: actorUser.id,
      action: 'intelligence.resume.generate',
      entityType: 'ResumeIntelligence',
      entityId: stored.id,
      afterData: { candidateId: candidate.id, resumeAssetId: resumeAsset?.id || null, providerEnabled: context.enabled },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return {
      executionId: execution.id,
      resultId: stored.id,
      fromCache: false,
      generatedAt: stored.createdAt,
      ...normalizedOutput,
    };
  } catch (error) {
    await recordIntelligenceFailure(execution.id, error);
    throw error;
  }
}
