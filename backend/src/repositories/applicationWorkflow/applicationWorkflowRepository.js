import { prisma } from '../../config/db.js';

function buildApplicationDetailInclude(includeCandidateTimelineOnly = false) {
  return {
    job: { include: { organisation: true } },
    candidate: { include: { user: true } },
    application: {
      include: {
        ...(includeCandidateTimelineOnly
          ? {}
          : {
              notes: {
                include: {
                  author: true,
                },
                orderBy: { createdAt: 'desc' },
              },
              activities: {
                include: {
                  actorUser: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            }),
        interviewProcesses: {
          include: {
            rounds: {
              include: {
                owner: true,
                panelMembers: { include: { user: true } },
                feedbacks: { include: { interviewer: true } },
              },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    },
    resumeSnapshot: true,
    answers: { include: { fileAsset: true }, orderBy: { createdAt: 'asc' } },
    ...(includeCandidateTimelineOnly
      ? { timeline: { where: { isCandidateVisible: true }, orderBy: { createdAt: 'desc' } } }
      : {
          flags: { orderBy: { createdAt: 'desc' } },
          timeline: { orderBy: { createdAt: 'desc' } },
        }),
  };
}

async function createApplicationNotificationsTx(tx, payload) {
  const recruiterIds = await tx.organisationMembership.findMany({
    where: {
      organisationId: payload.organisationId,
      status: 'ACTIVE',
      role: { in: ['OWNER', 'ADMIN', 'RECRUITER', 'HIRING_MANAGER'] },
    },
    select: { userId: true },
  });

  const notifications = recruiterIds.map((row) => tx.notification.create({
    data: {
      organisationId: payload.organisationId,
      recipientUserId: row.userId,
      type: 'APPLICATION',
      title: payload.recruiterTitle,
      message: payload.recruiterMessage,
      entityType: 'JobApplication',
      entityId: payload.jobApplicationId,
      metadata: {
        applicationId: payload.jobApplicationId,
      },
    },
  }));

  notifications.push(tx.notification.create({
    data: {
      organisationId: payload.organisationId,
      recipientUserId: payload.candidateUserId,
      type: 'APPLICATION',
      title: payload.candidateTitle,
      message: payload.candidateMessage,
      entityType: payload.candidateEntityType,
      entityId: payload.jobApplicationId,
      metadata: {
        applicationId: payload.jobApplicationId,
      },
    },
  }));

  await Promise.all(notifications);
}

export function findJobForOrganisation(jobId, organisationId) {
  return prisma.job.findFirst({
    where: { id: jobId, organisationId },
    include: {
      organisation: true,
      screeningQuestions: { orderBy: { displayOrder: 'asc' } },
      _count: { select: { applications: true, submittedApplications: true } },
    },
  });
}

export function findPublicJobBySlug(slug) {
  return prisma.job.findFirst({
    where: {
      slug,
      isPublic: true,
      archivedAt: null,
      organisation: {
        status: 'ACTIVE',
        careersEnabled: true,
      },
    },
    include: {
      organisation: true,
      screeningQuestions: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      _count: { select: { submittedApplications: true } },
    },
  });
}

export function findScreeningTemplate(organisationId, templateId) {
  return prisma.screeningQuestionTemplate.findFirst({
    where: { id: templateId, organisationId },
  });
}

export function findOwnedResumeAsset(candidateId, assetId) {
  return prisma.resumeAsset.findFirst({
    where: {
      id: assetId,
      candidateId,
      kind: 'RESUME',
      status: { not: 'DELETED' },
    },
  });
}

export function findScreeningFileAsset(candidateId, assetId) {
  return prisma.resumeAsset.findFirst({
    where: { id: assetId, candidateId, kind: 'SCREENING_FILE' },
  });
}

export function countScreeningTemplates(where) {
  return prisma.screeningQuestionTemplate.count({ where });
}

export function findScreeningTemplates(where, skip, take) {
  return prisma.screeningQuestionTemplate.findMany({
    where,
    include: { _count: { select: { jobScreeningQuestions: true } } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
    skip,
    take,
  });
}

export function createScreeningTemplateRecord(data) {
  return prisma.screeningQuestionTemplate.create({ data });
}

export function updateScreeningTemplateRecord(templateId, data) {
  return prisma.screeningQuestionTemplate.update({
    where: { id: templateId },
    data,
  });
}

export function findJobScreeningQuestions(where) {
  return prisma.jobScreeningQuestion.findMany({
    where,
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export function countJobScreeningQuestions(where) {
  return prisma.jobScreeningQuestion.count({ where });
}

export function createJobScreeningQuestionRecord(data) {
  return prisma.jobScreeningQuestion.create({ data });
}

export function findJobScreeningQuestion(where) {
  return prisma.jobScreeningQuestion.findFirst({ where });
}

export function updateJobScreeningQuestionRecord(questionId, data) {
  return prisma.jobScreeningQuestion.update({
    where: { id: questionId },
    data,
  });
}

export function findJobScreeningQuestionIds(where) {
  return prisma.jobScreeningQuestion.findMany({
    where,
    select: { id: true },
  });
}

export function reorderJobScreeningQuestionsRecord(questionIds) {
  return prisma.$transaction(questionIds.map((id, index) => prisma.jobScreeningQuestion.update({
    where: { id },
    data: { displayOrder: index },
  })));
}

export function deleteJobScreeningQuestionRecord(questionId) {
  return prisma.jobScreeningQuestion.delete({ where: { id: questionId } });
}

export function findActiveJobScreeningQuestions(where) {
  return prisma.jobScreeningQuestion.findMany({
    where,
    orderBy: { displayOrder: 'asc' },
  });
}

export function findCandidateResumeAssetsByCandidate(candidateId) {
  return prisma.resumeAsset.findMany({
    where: {
      candidateId,
      kind: 'RESUME',
      status: { not: 'DELETED' },
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
  });
}

export function findCandidateProfile(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
  });
}

export function findCandidateProfileWithUser(candidateId) {
  return prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    include: { user: true },
  });
}

export function createResumeAssetRecord(data) {
  return prisma.resumeAsset.create({ data });
}

export function deactivateOtherPrimaryResumes(candidateId, assetId) {
  return prisma.resumeAsset.updateMany({
    where: {
      candidateId,
      kind: 'RESUME',
      id: { not: assetId },
    },
    data: { isPrimary: false },
  });
}

export function updateCandidateProfileLatestResume(candidateId, assetId) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      latestResumeAssetId: assetId,
      resumeUrl: `/api/candidate/resumes/${assetId}/download`,
    },
  });
}

export function findJobApplicationByJobAndCandidate(jobId, candidateId) {
  return prisma.jobApplication.findUnique({
    where: {
      jobId_candidateId: {
        jobId,
        candidateId,
      },
    },
  });
}

export function findJobForApplicationValidation(jobId) {
  return prisma.job.findFirst({
    where: { id: jobId },
    include: {
      screeningQuestions: {
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      },
      _count: { select: { submittedApplications: true } },
    },
  });
}

export async function submitJobApplicationRecord({
  payload,
  candidateUserId,
  candidateProfile,
  validationQuestions,
  resumeAsset,
  source,
  answersByQuestionId,
  validateAnswerAgainstQuestion,
  evaluateRule,
  generatePublicReference,
}) {
  return prisma.$transaction(async (tx) => {
    const freshJob = await tx.job.findUnique({
      where: { id: payload.jobId },
      include: { _count: { select: { submittedApplications: true } } },
    });
    if (!freshJob) {
      const error = new Error('Job not found.');
      error.statusCode = 404;
      throw error;
    }

    const duplicate = await tx.jobApplication.findUnique({
      where: { jobId_candidateId: { jobId: payload.jobId, candidateId: candidateProfile.id } },
    });
    if (duplicate) {
      const error = new Error('You have already applied to this job.');
      error.statusCode = 409;
      error.code = 'ALREADY_APPLIED';
      throw error;
    }

    const application = await tx.application.create({
      data: {
        organisationId: freshJob.organisationId,
        jobId: freshJob.id,
        candidateId: candidateProfile.id,
        statusLabel: 'Applied',
        currentStage: 'APPLIED',
        activities: {
          create: {
            organisationId: freshJob.organisationId,
            eventType: 'APPLICATION_SUBMITTED',
            message: 'Application submitted.',
          },
        },
      },
    });

    const jobApplication = await tx.jobApplication.create({
      data: {
        publicReference: generatePublicReference(),
        organisationId: freshJob.organisationId,
        jobId: freshJob.id,
        candidateId: candidateProfile.id,
        applicationId: application.id,
        candidateStatusUpdatedAt: new Date(),
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        sourceCampaign: source.sourceCampaign,
        utmSource: source.utmSource,
        utmMedium: source.utmMedium,
        utmCampaign: source.utmCampaign,
        utmTerm: source.utmTerm,
        utmContent: source.utmContent,
        referrer: source.referrer,
        directLinkIdentifier: source.directLinkIdentifier,
        screeningSummary: {
          totalQuestions: validationQuestions.length,
          answeredQuestions: (payload.answers || []).length,
        },
      },
    });

    await tx.applicationResumeSnapshot.create({
      data: {
        organisationId: freshJob.organisationId,
        applicationId: jobApplication.id,
        resumeAssetId: resumeAsset.id,
        storageKey: resumeAsset.storageKey,
        storageProvider: resumeAsset.storageProvider,
        filename: resumeAsset.originalFilename,
        mimeType: resumeAsset.mimeType,
        sizeBytes: resumeAsset.sizeBytes,
      },
    });

    const answerCreates = [];
    const flagCreates = [];
    const screeningResults = [];

    for (const question of validationQuestions) {
      const rawAnswer = answersByQuestionId.get(question.id) || {};
      const validatedAnswer = validateAnswerAgainstQuestion(question, rawAnswer);
      const matchingRules = (question.rules || []).filter((rule) => evaluateRule(rule.operator, validatedAnswer.answerValue, rule.value));
      const screeningOutcome = matchingRules[0]?.outcome || null;

      answerCreates.push(tx.applicationScreeningAnswer.create({
        data: {
          organisationId: freshJob.organisationId,
          applicationId: jobApplication.id,
          originalQuestionId: question.id,
          fileAssetId: validatedAnswer.fileAssetId,
          questionTextSnapshot: question.questionText,
          internalLabelSnapshot: question.internalLabel,
          helpTextSnapshot: question.helpText,
          placeholderSnapshot: question.placeholder,
          questionTypeSnapshot: question.questionType,
          optionsSnapshot: question.config || {},
          validationSnapshot: question.validationConfig || {},
          requiredSnapshot: question.required,
          answerValue: validatedAnswer.answerValue,
          screeningOutcome,
        },
      }));

      for (const rule of matchingRules) {
        flagCreates.push(tx.applicationFlag.create({
          data: {
            organisationId: freshJob.organisationId,
            applicationId: jobApplication.id,
            questionId: question.id,
            outcome: rule.outcome,
            operator: rule.operator,
            internalReason: rule.reason,
            metadata: {
              questionText: question.questionText,
              ruleValue: rule.value,
              answerValue: validatedAnswer.answerValue,
            },
          },
        }));
      }

      if (screeningOutcome) {
        screeningResults.push({
          questionId: question.id,
          outcome: screeningOutcome,
          ruleCount: matchingRules.length,
        });
      }
    }

    await Promise.all(answerCreates);
    await Promise.all(flagCreates);

    await tx.jobApplication.update({
      where: { id: jobApplication.id },
      data: {
        screeningSummary: {
          totalQuestions: validationQuestions.length,
          answeredQuestions: (payload.answers || []).length,
          flags: screeningResults.length,
          outcomes: screeningResults,
        },
      },
    });

    await tx.applicationTimeline.create({
      data: {
        organisationId: freshJob.organisationId,
        applicationId: jobApplication.id,
        actorUserId: candidateUserId,
        eventType: 'APPLICATION_SUBMITTED',
        message: 'Application submitted.',
        metadata: {
          publicReference: jobApplication.publicReference,
        },
        isCandidateVisible: true,
      },
    });

    await createApplicationNotificationsTx(tx, {
      organisationId: freshJob.organisationId,
      candidateUserId,
      jobApplicationId: jobApplication.id,
      recruiterTitle: 'New application received',
      recruiterMessage: `${candidateProfile.fullName} applied to ${freshJob.title}.`,
      candidateTitle: 'Application submitted',
      candidateMessage: `Your application for ${freshJob.title} was submitted successfully.`,
      candidateEntityType: 'Application',
    });

    return { jobApplication, application };
  });
}

export function countRecruiterJobApplications(where) {
  return prisma.jobApplication.count({ where });
}

export function findRecruiterJobApplications(where, orderBy, skip, take) {
  return prisma.jobApplication.findMany({
    where,
    include: {
      job: { include: { organisation: true } },
      candidate: true,
      application: true,
      flags: true,
      resumeSnapshot: true,
    },
    orderBy,
    skip,
    take,
  });
}

export function findRecruiterJobApplicationDetail(jobApplicationId, organisationId) {
  return prisma.jobApplication.findFirst({
    where: { id: jobApplicationId, organisationId },
    include: buildApplicationDetailInclude(false),
  });
}

export function findCandidateJobApplicationDetail(jobApplicationId, candidateId) {
  return prisma.jobApplication.findFirst({
    where: {
      id: jobApplicationId,
      candidateId,
    },
    include: buildApplicationDetailInclude(true),
  });
}

export function countCandidateJobApplications(where) {
  return prisma.jobApplication.count({ where });
}

export function findCandidateJobApplications(where, orderBy, skip, take) {
  return prisma.jobApplication.findMany({
    where,
    include: {
      job: { include: { organisation: true } },
      application: true,
      resumeSnapshot: true,
      timeline: { where: { isCandidateVisible: true }, orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy,
    skip,
    take,
  });
}

export function findCandidateWithdrawalApplication(jobApplicationId, candidateId) {
  return prisma.jobApplication.findFirst({
    where: {
      id: jobApplicationId,
      candidateId,
    },
    include: {
      application: true,
      job: true,
      candidate: { include: { user: true } },
    },
  });
}

export async function withdrawCandidateApplicationRecord({
  existing,
  candidateUserId,
  timelineMessage,
  reason,
  note,
}) {
  return prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: existing.application.id },
      data: {
        currentStage: 'WITHDRAWN',
        statusLabel: 'Withdrawn',
      },
    });

    await tx.jobApplication.update({
      where: { id: existing.id },
      data: {
        withdrawnAt: new Date(),
        withdrawalReason: reason || null,
        withdrawalNote: note || null,
        withdrawnByUserId: candidateUserId,
        candidateStatusUpdatedAt: new Date(),
      },
    });

    await tx.applicationTimeline.create({
      data: {
        organisationId: existing.organisationId,
        applicationId: existing.id,
        actorUserId: candidateUserId,
        eventType: 'APPLICATION_WITHDRAWN',
        message: timelineMessage,
        metadata: {
          reason: reason || null,
        },
        isCandidateVisible: true,
      },
    });

    await tx.applicationActivity.create({
      data: {
        organisationId: existing.organisationId,
        applicationId: existing.application.id,
        actorUserId: candidateUserId,
        eventType: 'APPLICATION_WITHDRAWN',
        message: 'Candidate withdrew the application.',
        metadata: {
          reason: reason || null,
        },
      },
    });

    await createApplicationNotificationsTx(tx, {
      organisationId: existing.organisationId,
      candidateUserId,
      jobApplicationId: existing.id,
      recruiterTitle: 'Application withdrawn',
      recruiterMessage: `${existing.candidate.fullName} withdrew their application for ${existing.job.title}.`,
      candidateTitle: 'Application withdrawn',
      candidateMessage: `You withdrew your application for ${existing.job.title}.`,
      candidateEntityType: 'Application',
    });
  });
}

export function setPrimaryResumeAssetRecord(candidateId, assetId) {
  return prisma.$transaction([
    prisma.resumeAsset.updateMany({
      where: {
        candidateId,
        kind: 'RESUME',
        id: { not: assetId },
      },
      data: { isPrimary: false },
    }),
    prisma.resumeAsset.update({
      where: { id: assetId },
      data: {
        isPrimary: true,
        status: 'ACTIVE',
        archivedAt: null,
      },
    }),
    prisma.candidateProfile.update({
      where: { id: candidateId },
      data: {
        latestResumeAssetId: assetId,
        resumeUrl: `/api/candidate/resumes/${assetId}/download`,
        onboardingSkippedResume: false,
      },
    }),
  ]);
}

export function findActiveReplacementResume(candidateId, assetId) {
  return prisma.resumeAsset.findFirst({
    where: {
      candidateId,
      kind: 'RESUME',
      status: 'ACTIVE',
      id: { not: assetId },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
}

export function markResumeAssetPrimary(assetId) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: { isPrimary: true },
  });
}

export function updateCandidateProfileResumeLink(candidateId, assetIdOrNull) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data: {
      latestResumeAssetId: assetIdOrNull || null,
      resumeUrl: assetIdOrNull ? `/api/candidate/resumes/${assetIdOrNull}/download` : null,
    },
  });
}

export function archiveResumeAssetRecord(assetId) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: {
      status: 'ARCHIVED',
      isPrimary: false,
      archivedAt: new Date(),
    },
  });
}

export function countApplicationResumeSnapshotReferences(assetId) {
  return prisma.applicationResumeSnapshot.count({
    where: { resumeAssetId: assetId },
  });
}

export function deleteResumeAssetRecord(assetId) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: {
      status: 'DELETED',
      isPrimary: false,
      archivedAt: new Date(),
    },
  });
}

export function restoreResumeAssetRecord(assetId) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: {
      status: 'ACTIVE',
      archivedAt: null,
    },
  });
}

export function updateResumeAssetParsing(assetId, parsingStatus, parsedData) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: {
      parsingStatus,
      parsedData,
    },
  });
}

export function updateCandidateProfileRecord(candidateId, data) {
  return prisma.candidateProfile.update({
    where: { id: candidateId },
    data,
  });
}

export function updateResumeAssetParsedReview(assetId, parsedData, parsingStatus) {
  return prisma.resumeAsset.update({
    where: { id: assetId },
    data: {
      parsingStatus,
      parsedData,
    },
  });
}

export function findOwnedDownloadResumeAsset(assetId, candidateId) {
  return prisma.resumeAsset.findFirst({
    where: { id: assetId, candidateId, status: { not: 'DELETED' } },
  });
}

export function findApplicationResumeSnapshot(applicationId, organisationId) {
  return prisma.applicationResumeSnapshot.findFirst({
    where: {
      applicationId,
      organisationId,
    },
  });
}

export function findApplicationScreeningAnswerFile(applicationId, organisationId, assetId) {
  return prisma.applicationScreeningAnswer.findFirst({
    where: {
      applicationId,
      organisationId,
      fileAssetId: assetId,
    },
    include: { fileAsset: true },
  });
}
