# Observability Guide

## Overview

Milestone 7 adds a baseline observability layer focused on safe structured logs, correlation IDs, subsystem health, and intelligence execution visibility.

## Request Correlation

`backend/src/middleware/requestContext.js` assigns a request ID to every request and mirrors it in the `x-request-id` response header.

## Structured Logging

Request completion and error logs include safe structured fields such as:

- request ID
- organization ID where known
- user ID where safe
- route
- method
- status
- latency
- error code where present

## Intelligence Logging

Execution records provide the durable intelligence trace for:

- feature
- prompt key and version
- provider
- model
- cache hit
- retries
- latency
- estimated usage

## Logging Redaction Rules

Do not log:

- passwords
- verification tokens
- reset tokens
- offer access tokens
- invitation tokens
- provider API keys
- full resume bodies
- raw provider payloads containing personal data
- candidate contact information unless operationally required and already protected elsewhere

## Health Endpoints

`/api/health` now reports bounded subsystem status for:

- application
- database
- Elasticsearch
- intelligence provider
- background-task subsystem

No secret values are exposed.

## Operational Guidance

- investigate repeated provider failures through intelligence governance records, not by enabling raw secret-bearing logs
- use request IDs to trace safe client-reported failures
- treat jsdom canvas warnings as test-environment noise unless browser evidence shows runtime impact

## Future Enhancements

- external log aggregation
- worker metrics
- alerting thresholds
- latency percentiles per intelligence feature
- structured analytics for retry and failure trends
