import { prisma } from '../../config/db.js';

export function findOrganisationFeature(organisationId, key) {
  return prisma.featureFlag.findUnique({
    where: {
      organisationId_key: {
        organisationId,
        key,
      },
    },
  });
}

export function findOrganisationFeatures(organisationId, keys) {
  return prisma.featureFlag.findMany({
    where: {
      organisationId,
      key: { in: keys },
    },
  });
}

export function createOrganisationFeature(data) {
  return prisma.featureFlag.create({ data });
}

export function createOrganisationFeatures(data) {
  return prisma.featureFlag.createMany({ data });
}
