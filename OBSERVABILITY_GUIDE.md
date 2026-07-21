# Observability Guide

## Overview

Careeriz emits structured backend logs and uses health services introduced in Milestone 8.

## Request Correlation

Backend request logs include:

- request ID
- route
- method
- status
- latency
- organization ID where available
- user ID where safe

## Scheduling and Provider Logging

Milestone 8.5 scheduling flows add safe identifiers such as:

- organization ID
- interview round/meeting ID
- provider
- operation type
- result
- retry count

## Redaction Rules

The following must not appear in logs:

- OAuth access or refresh tokens
- encryption keys
- meeting host URLs
- passcodes
- raw provider payloads containing participant data
- private calendar event details

## Health Behavior

Application health must not fail solely because optional organization meeting providers are disconnected.

Provider validation is surfaced through organization-level status, not global hard-fail health.

## Operational Notes

- Docker/compose validation could not be run in this environment because Docker CLI is unavailable.
- Live Google Workspace and Zoom validation were not performed because no real credentials were configured.
