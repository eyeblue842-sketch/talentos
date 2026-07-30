import { env } from '../../config/env.js';
import { requireEnterprisePermission } from '../../services/enterprisePermissionService.js';
import { intelligenceFeatureConfig } from '../policies/intelligencePolicy.js';
import {
  createOrganisationFeatures,
  findOrganisationFeature,
  findOrganisationFeatures,
} from '../repositories/featureAccessRepository.js';

const ensuredFlags = new Set();

async function ensureOrganisationFeatureFlags(organisationId) {
  if (ensuredFlags.has(organisationId)) return;

  const existing = await findOrganisationFeatures(
    organisationId,
    Object.values(intelligenceFeatureConfig).map((item) => item.flag),
  );

  const existingKeys = new Set(existing.map((item) => item.key));
  const missing = Object.values(intelligenceFeatureConfig)
    .map((item) => item.flag)
    .filter((key) => !existingKeys.has(key));

  if (missing.length) {
    await createOrganisationFeatures(
      missing.map((key) => ({
        organisationId,
        key,
        description: `Milestone 7 intelligence capability: ${key}`,
        enabled: false,
      })),
    ).catch(() => {});
  }

  ensuredFlags.add(organisationId);
}

export async function requireIntelligenceFeature(actorUser, feature, organisationId = null, mode = 'read') {
  const config = intelligenceFeatureConfig[feature];
  if (!config) {
    const error = new Error('Unsupported intelligence feature.');
    error.statusCode = 422;
    throw error;
  }

  const permission = mode === 'generate' ? config.permissionGenerate : config.permissionRead;
  const context = await requireEnterprisePermission(actorUser, permission, organisationId);

  await ensureOrganisationFeatureFlags(context.organisationId);

  const flag = await findOrganisationFeature(context.organisationId, config.flag);

  const providerEnabled = env.intelligenceEnabled && env.intelligenceProvider !== 'DISABLED';
  const enabled = providerEnabled && Boolean(flag?.enabled);

  return {
    ...context,
    feature,
    featureFlag: config.flag,
    enabled,
    providerEnabled,
    disabledReason: providerEnabled
      ? (flag?.enabled ? null : 'This intelligence feature is disabled for the organization.')
      : 'Intelligence provider is unavailable or disabled.',
  };
}
