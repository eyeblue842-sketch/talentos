# Interview Scheduling Security

## Core Rules

- provider credentials are encrypted at rest
- raw tokens never leave backend services
- OAuth state is single-use and organization-bound
- custom meeting links must be safe URLs
- host URLs and passcodes are never broadly serialized
- candidate views exclude internal notes and restricted participant details

## OAuth Controls

- state token stored through `AuthToken`
- callback binds to initiating organization and user context
- replay and cross-tenant takeover are rejected

## Data Protection

Sensitive values excluded from logs and serializers:

- OAuth tokens
- encryption keys
- host URLs
- passcodes
- raw provider payloads

## Access Control

- provider admin routes require organization-admin permissions
- candidate interview access is tied to owned interview/application context
- interviewer access is tied to explicit participant assignment
- recruiter actions require organization membership plus scheduling permissions
