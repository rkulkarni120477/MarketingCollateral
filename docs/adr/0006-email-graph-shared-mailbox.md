# ADR-0006: Email via Graph sendMail from a shared mailbox

- **Status:** Proposed
- **Date:** 2026-10-14

## Context

The portal sends clearance requests, change digests and request notifications. Sending as a named person would be wrong and would mix portal mail into personal mailboxes. The brief suggests `marketing-portal@academian.com`. That address is **not in the workbook** and is unconfirmed.

## Decision

- Send all mail with Graph `sendMail` as the shared mailbox (address in `config/environments/*.json`, marked unconfirmed until the owner confirms).
- Restrict the app's `Mail.Send` permission to that one mailbox with an **Exchange application access policy**. Without this, the permission reaches every mailbox in the tenant.
- Templates are HTML, branded and accessible, in `api/src/templates/`, rendered with a small templating helper. Every email has a "why am I getting this" footer.
- Log every send attempt in `NotificationLog` (recipient, template, status, timestamp).

## Consequences

- The Exchange policy is a tenant admin change. It is a live-tenant action and needs your approval (Phase 2).
- Mailbox must exist and be licensed. Confirm before Phase 5.

## Alternatives considered

- **SMTP relay.** Harder to restrict and to audit.
- **Send as the requester.** Rejected: impersonates staff.
