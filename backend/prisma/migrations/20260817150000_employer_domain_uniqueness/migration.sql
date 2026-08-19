-- CAREERIZ EMPLOYER ACCESS, domain-ownership closure section 2: a
-- concurrency-safe, database-enforced constraint that at most one COMPANY
-- organisation may hold a given verifiedDomain at a time (covering BOTH
-- PENDING and VERIFIED claims - a second registration must not be able to
-- squat on a domain while an earlier claim is still under review either).
-- NULL values (legacy organisations, CONSULTANCY organisations) are
-- unaffected by a partial unique index and remain unlimited, as required.
--
-- This constraint cannot be expressed in schema.prisma's declarative DSL
-- (Prisma has no partial/filtered @@unique), so it is hand-written here
-- rather than generated via `prisma migrate diff`. It is still fully
-- enforced by Postgres and by two concurrent transactions racing to
-- INSERT the same domain - exactly one will succeed, the other raises a
-- unique_violation (Postgres error 23505 / Prisma P2002) that the
-- application layer (employerOnboardingService.js) catches and translates
-- into the same stable EMAIL_DOMAIN_ALREADY_CLAIMED response used for the
-- non-racing case.
CREATE UNIQUE INDEX "Organisation_company_verified_domain_key"
  ON "Organisation" ("verifiedDomain")
  WHERE "type" = 'COMPANY' AND "verifiedDomain" IS NOT NULL;
