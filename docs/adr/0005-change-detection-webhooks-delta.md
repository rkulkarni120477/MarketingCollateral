# ADR-0005: Change detection: list webhooks, Graph delta, timer fallback

- **Status:** Accepted (owner, 2026-10-15)
- **Date:** 2026-10-14

## Context

F8 needs notifications when collateral is published, archived or deleted. Webhooks are the fast path, but they are not guaranteed to deliver every event. They also do not say what changed.

## Decision

- Register SharePoint **list and library webhooks** on the collateral libraries. A webhook triggers `mc-api`. It does not carry the change itself.
- On each trigger, `mc-api` runs a **Graph delta query** on the library to find what changed since the stored delta token.
- A **15-minute timer** runs the same delta query as a fallback, so a lost webhook only delays a notification.
- Webhook subscriptions are renewed before they expire. The renewal job is part of the timer.

## Consequences

- Notifications are at-least-once. Every queued notification has an idempotency key (item ID + version + status) so duplicates are dropped.
- Delta tokens are stored in `PortalConfig`, not in code.
- Webhook renewal failure is an alert (brief NFR: alert on failed notifications).

## Alternatives considered

- **Polling only.** Simple, but 15-minute latency for "immediate" notifications.
- **Power Automate flows.** Less testable, and the flow logic would live outside the repo.
