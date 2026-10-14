# ADR-0007: AI behind a feature flag, with non-AI search always working

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

AI features (Ask-AI search, auto-metadata, duplicate detection, stats check, triage, summaries) are useful but not required for the core job. They add cost, a data-processing surface, and a dependency on Azure OpenAI and AI Search availability.

## Decision

- Gate every AI feature behind a single flag, `aiEnabled`, stored in `PortalConfig` (and mirrored in `config/environments/*.json` as the default). Default **off** until Phase 6 sign-off.
- Non-AI search (SharePoint keyword search with refiners) must work completely with the flag off. Tests cover both states.
- Every AI-written field is marked **AI-suggested** until a human confirms it.
- Prompts are versioned files in `api/src/ai/prompts/`. Temperature is low. Prompts and responses are logged to App Insights without file content. No PII beyond what the task needs.
- Ask-AI answers must cite collateral and must never include content from items the caller cannot read. Retrieval is filtered by the caller's group IDs before generation.

## Consequences

- Two code paths for search. Both need tests.
- Index contents must carry allowed-group IDs. The indexing pipeline (Phase 6) is the only writer.

## Alternatives considered

- **AI always on.** Rejected: a failure would break search for everyone.
