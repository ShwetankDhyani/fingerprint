# Email setup for lynxweb.in

**Status: COMPLETE** (as of 2026-09-05)

Everything in the portal works without email — invites and quotations always
produce a link you can copy or send on WhatsApp, and every send attempt is
recorded in **Admin → Settings → Delivery log**. This document explains how
email is currently configured for production.

## Current production setup

The portal sends mail through **Resend** (installed via Vercel Marketplace), receives mail via **ImprovMX** free forwarder, and Setu can reply as `@lynxweb.in` from Gmail using Resend SMTP.

### Sending (Resend)

- **Resend integration**: installed via Vercel Marketplace on project `lynx-web-solutions` (team `shwetankdhyanis-projects`). Resource name: `resend-email-emerald-helmet`.
- **Domain**: `lynxweb.in` is **Verified** in Resend, region **us-east-1** (North Virginia).
- **Vercel environment variables** (Production + Preview):
  - `RESEND_API_KEY` — set automatically by the Resend integration (non-empty)
  - `EMAIL_FROM` = `Lynx Web Solutions <hello@lynxweb.in>`
  - `EMAIL_REPLY_TO` = `care@lynxweb.in`
  - `EMAIL_TO_TEAM` = `setu.dhyani@gmail.com`

The portal prefers `RESEND_API_KEY` over `SMTP_URL` when both are set.

### Receiving (ImprovMX)

Since neither Zoho Forever Free (Singapore DC only showed paid plans) nor GoDaddy's free email forwarding were available, **ImprovMX** free forwarder is active:

- `care@lynxweb.in` → `setu.dhyani@gmail.com`
- `hello@lynxweb.in` → `setu.dhyani@gmail.com`

### Human replies as @lynxweb.in (Gmail Send mail as)

Gmail account `setu.dhyani@gmail.com` has **Send mail as** verified for:

- `care@lynxweb.in`
- `hello@lynxweb.in`

SMTP settings:

- Server: `smtp.resend.com`
- Port: `465` (SSL)
- Username: `resend`
- Password: the value of `RESEND_API_KEY`

Test confirmed: mail sent from `care@lynxweb.in` via Gmail delivered successfully to `setu.dhyani@gmail.com`.

## DNS records (GoDaddy)

Domain `lynxweb.in` is hosted at GoDaddy (`ns47.domaincontrol.com`, `ns48.domaincontrol.com`).

### Sending records (Resend, subdomain `send`)

**Do not remove these when changing mail DNS** — they are used by Resend for outbound portal mail:

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | (DKIM public key from Resend) | — |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

### Receiving records (ImprovMX, root domain)

| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` | — |

The root MX records point at ImprovMX so that `care@` and `hello@` forward to Gmail. The `send.` subdomain MX and `resend._domainkey` TXT records are for outbound Resend mail and must be preserved.

## How mail flows

1. **Portal sends** (quote, invite, ticket reply, etc.) → Resend API → client inbox
2. **Client replies** → ImprovMX → `setu.dhyani@gmail.com`
3. **Human replies as @lynxweb.in** → Gmail (Send mail as) → Resend SMTP → client inbox

Delivery log: **Admin → Settings → Delivery log** (every send attempt is recorded in `email_log` table).

Diagnostic test: **Admin → Settings → Send test email** succeeded on 2026-09-05. Status: `sent` via Resend. Gmail received "Lynx Web Solutions — email delivery test" from `hello@lynxweb.in`.

## What the portal sends

| Trigger | Recipient | Template |
| --- | --- | --- |
| Client invited | the contact | `client-invite` |
| Quote created with "Send now", or "Send email" on a quote | the recipient | `quote-sent` |
| Advance paid via Cashfree | client receipt + team alert | `quote-paid-*` |
| Ticket raised | client confirmation + team alert | `ticket-created-*` |
| Ticket reply | the other side | `ticket-reply-*` |
| Snapshot published, and the daily digest cron | client contacts | `project-snapshot` |
| Invoice raised from a quote | billing contact | `invoice-sent` |
| Contact form submitted | client acknowledgement + team alert | `lead-*` |

Every send writes a row to `email_log` with the status and any provider error, so nothing fails silently.

## Maintenance notes

- The code in `src/lib/email/mailer.ts` prefers `RESEND_API_KEY` over `SMTP_URL`.
- **Path B** (Gmail `SMTP_URL` fallback) is documented in git history as a stopgap option but is **not currently used** in production.
- If the Resend API key is rotated, update it in Vercel **and** in Gmail's Send mail as SMTP password for `care@` / `hello@`.
- ImprovMX configuration: managed at [improvmx.com](https://improvmx.com) (free tier, no login required for initial setup; visit their dashboard to add/remove aliases).
- To verify DNS: `dig MX lynxweb.in`, `dig TXT send.lynxweb.in`, `dig TXT resend._domainkey.lynxweb.in`.
