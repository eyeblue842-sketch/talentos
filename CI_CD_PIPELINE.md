# CI/CD Pipeline

## Workflow File

- `.github/workflows/ci-cd.yml`

## Validation Stages

1. install dependencies
2. backend install
3. frontend install
4. lint
5. type-check
6. backend tests
7. frontend tests
8. build
9. Prisma validate
10. Prisma generate
11. migration status check
12. security scan
13. Docker image builds

## Deployment Stages

- staging deployment placeholder after validation
- production approval gate through GitHub environment approval

## Notes

- this pipeline is intentionally conservative
- production deployment is not automated in this milestone
- staging deployment remains a documented integration point until environment-specific secrets and infrastructure are finalized
