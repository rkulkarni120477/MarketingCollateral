# ADR-0002: Azure Functions on Node 22 LTS

- **Status:** Proposed — **deviates from the brief** (brief says Node 20)
- **Date:** 2026-10-14

## Context

The brief specifies Azure Functions, TypeScript, Node 20 (isolated). Node.js 20 reached end of life on **30 April 2026**. Security fixes stop after that date, so it can't be used for a new project in October 2026. Node 22 is the current LTS line. Third-party trackers list its end of life as 30 April 2027.

## Decision

- Use **Node 22 LTS** for `mc-api`, using the isolated worker model with the current TypeScript Functions programming model.
- Pin the exact Node and Functions runtime versions in `api/package.json` and the Function App settings when scaffolding.
- Re-evaluate at each Node LTS transition. Track the EOL date in `docs/runbook-*.md` (to be written in Phase 7).

## Consequences

- Deviation from the brief. Confirm in the Phase 1 checkpoint (question Q8 in [data-issues.md](../data-issues.md)).
- Azure Functions must support Node 22 in the target plan. Verify on the Functions runtime support page at scaffold time.

## Alternatives considered

- **Node 20 as written in the brief.** Rejected: past EOL.
- **Node 24.** Newer, but not LTS at the time of writing. Revisit when it is.
