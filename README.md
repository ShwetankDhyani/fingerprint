# Lynx Web Solutions

Production marketing + transactional site for **Lynx Web Solutions** ([www.lynxweb.in](https://www.lynxweb.in)).

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Framer Motion, React Hook Form, Zod
- Resend + React Email
- Supabase (Postgres + RLS)
- **Cashfree** (only payment provider — India + international)
- WhatsApp click-to-chat

## Payment model (packaged plans)

Checkout charges a **booking advance**, not the full project fee:

| Plan | Project total | Advance online | Balance |
| --- | --- | --- | --- |
| Starter | ₹14,999 | 50% (₹7,500) | Before go-live |
| Growth | ₹34,999 | 40% (₹14,000) | Before go-live |
| Premium | ₹69,999 | 40% (₹28,000) | Milestones / before go-live |

Kickoff starts after the advance clears. Remaining balance is invoiced separately.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Without payment/email/DB secrets, the app still runs in development: leads log locally, checkout returns mock orders, and WhatsApp uses the configured public number. **Production refuses mock payments and requires Cashfree + Supabase.**

## Backend map

| Area | Path |
| --- | --- |
| Lead server action | `src/app/actions/contact.ts` |
| Email templates | `src/emails/` |
| Cashfree create order | `POST /api/payments/cashfree/create-order` |
| Cashfree verify | `POST /api/payments/cashfree/verify` |
| Cashfree webhook | `POST /api/webhooks/cashfree` |
| Outbound mail (single path, logged) | `src/lib/email/mailer.ts`, `src/lib/email/notifications.ts` |
| Quote advance order | `POST /api/payments/quote/create-order` |
| Invoice payment order | `POST /api/payments/invoice/create-order` |
| Payment settlement (quote / invoice) | `src/lib/payments/settlement.ts` |
| Daily project digest (Vercel cron) | `GET /api/cron/project-digest` |
| SQL schema + RLS | `supabase/schema.sql` |
| Portal schema (auth/orgs/quotes) | `supabase/portal_schema.sql` |
| Portal upgrade (tokens/tickets/email log) | `supabase/portal_upgrade.sql` |
| Admin portal | `/admin` |
| Client portal | `/client` |
| Support tickets | `/admin/tickets`, `/client/support` |
| Email + service diagnostics | `/admin/settings` |
| Login / invite | `/login`, `/invite/[token]` |
| Public quote | `/q/[quoteNumber]?t=…` |
| Privacy / Terms | `/privacy`, `/terms` |

## Cashfree setup (production)

1. Create / open a Cashfree merchant account and generate **App ID** + **Secret Key**.
2. Enable UPI, cards, net banking, and international cards as needed.
3. Set on Vercel:
   - `CASHFREE_APP_ID`
   - `CASHFREE_SECRET_KEY`
   - `CASHFREE_ENV=production`
   - `NEXT_PUBLIC_CASHFREE_MODE=production`
   - `NEXT_PUBLIC_SITE_URL=https://www.lynxweb.in`
4. Whitelist `www.lynxweb.in` and set webhook URL to  
   `https://www.lynxweb.in/api/webhooks/cashfree` (payment success events).
5. Apply `supabase/schema.sql` in Supabase.

## WhatsApp payment confirmations

Automatic payment receipts on WhatsApp use Meta Cloud API templates.
See [`docs/WHATSAPP-SETUP.md`](docs/WHATSAPP-SETUP.md). Until those env vars
are set, payments still complete and email receipts still send.

## Client + admin portal

Additive CRM/billing portal on the same Next.js app (shared auth, forest/gold/mono visual language).

**Project themes:** every project gets a deterministic visual skin (accent, motif, pattern) from its id/name/code/summary so lists stay scannable. Override with `projects.meta.theme` (one of `ember`, `lagoon`, `ink`, `saffron`, `verdant`, `cobalt`, `blush`, `arctic`, `voltage`, `cinder`) or `projects.meta.accent` (`#rrggbb`).

1. Apply `supabase/schema.sql`, then `supabase/portal_schema.sql`, then `supabase/portal_upgrade.sql`.
2. Enable Supabase Auth (email/password). Set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (already used for leads/payments)
3. Promote your user to staff in SQL after first signup:
   `update profiles set role = 'ADMIN' where email = 'you@lynxweb.in';`
4. Staff: `/admin` — leads (enquiries until advance paid), clients, projects, milestones, quotes, invoices, inbox.
5. Clients: invited via `/invite/[token]`, then `/client`.
6. Quotes: branded public letterhead at `/q/LWX-Q-…?t=…` (signed, expiring token, regenerable from the quote page). Signed-in staff and members of the owning organization can open the same page without a token. The advance is collected inline through Cashfree, which accepts the quote, raises the invoice and emails receipts.
7. Support: clients raise tickets at `/client/support`; staff triage them at `/admin/tickets`. Both sides get email on every reply.
8. Snapshots: staff publish them from a project page, and `/api/cron/project-digest` posts one automatically each day for every active project.

Every list page (clients, projects, quotes, invoices, tickets, billing) filters
server-side from the URL, so a search for a person's name, email, phone or a
document number finds their records and the result stays shareable.

Without Auth env vars, `/login` shows a configuration empty state and marketing pages keep working.

### Email

Outbound mail goes through one path that prefers Resend and falls back to any
SMTP mailbox, records every attempt in `email_log`, and never throws — a failed
send still leaves a copyable (and WhatsApp-shareable) link in the admin UI.
Check delivery and send a test from `/admin/settings`.

**Email setup for `@lynxweb.in` is complete** (sending via Resend, receiving via ImprovMX). See [`docs/EMAIL-SETUP.md`](docs/EMAIL-SETUP.md) for configuration details and DNS records.

## Production checklist

1. Apply `supabase/schema.sql`, `supabase/portal_schema.sql` and `supabase/portal_upgrade.sql`.
2. Fill hosting env from `.env.example` (no Razorpay/Stripe vars). Include Supabase anon key for portal login.
3. Confirm Cashfree webhook + domain whitelist.
4. Set `RESEND_API_KEY` (or `SMTP_URL`) and verify the sending domain — see `docs/EMAIL-SETUP.md`. Confirm with the test send on `/admin/settings`.
5. Set `CRON_SECRET` so the daily digest endpoint only answers Vercel's scheduler.
6. Smoke-test: contact form, advance checkout, webhook mark-paid, receipt email, portal login, quote share link, ticket round-trip.
6. Keep `CASHFREE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` server-only. Rotate any keys that were ever pasted into chat or tickets.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 43127 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

## Portal progress screenshots

Staff upload screenshots on a project’s **What’s new** form. Files go to the Supabase Storage bucket `project-media` (public). If uploads fail in a fresh environment, run `supabase/project_media_bucket.sql` in the Supabase SQL editor.

Paying a quotation advance automatically opens an active project for the client (no separate “create project” step).
