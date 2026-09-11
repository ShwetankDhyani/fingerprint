# Customer lifecycle — what fires, from where

Every message the customer receives is triggered from the same code path as the
status change that caused it, and every one writes to `email_log` /
`whatsapp_log`, which is what the customer timeline reads. If you add a trigger,
add it next to the write, not in a separate screen.

## Customer-facing

| Trigger | Channel | Fires from | Template |
| --- | --- | --- | --- |
| Contact form submitted | Email | `src/app/actions/contact.ts` | `lead-acknowledgement` |
| Quote sent or re-sent | Email + WhatsApp | `createQuoteAction` / `emailQuoteAction` in `src/app/actions/portal.ts` | `quote-sent`, `quotation_ready` |
| Quote unopened after 3 days | Email | `GET /api/cron/lifecycle` | `quote-followup` |
| Advance paid | Email + WhatsApp | `settleQuoteAdvance` in `src/lib/payments/settlement.ts` | `quote-paid-client`, `payment_confirmation` |
| Invoice raised | Email | `createInvoiceFromQuoteAction` in `src/app/actions/portal.ts` | `invoice-sent` |
| Invoice due within 3 days | Email | `GET /api/cron/lifecycle` | `invoice-due-soon` |
| Invoice overdue | Email | `GET /api/cron/lifecycle` | `invoice-overdue` |
| Invoice paid | Email + WhatsApp | `settleInvoicePayment` in `src/lib/payments/settlement.ts` | `invoice-paid-client`, `payment_confirmation` |
| Milestone completed | Email | `setMilestoneStatusAction` in `src/app/actions/portal.ts` | `milestone-completed` |
| Daily progress snapshot | Email | `GET /api/cron/project-digest` | `project-snapshot` |
| Project marked delivered | Email | `completeProjectAction` in `src/app/actions/portal.ts` | `project-handover` |
| Ticket opened / replied | Email | `createTicketAction` / `replyTicketAction` | `ticket-*` |

Copy for the manual sends lives in `src/lib/email/notifications.ts`; copy for
the automated ones lives in `src/lib/email/lifecycle.ts`.

## Internal (the bell in the admin header)

`notifyStaff` in `src/lib/portal/notify.ts` writes one `notifications` row per
active staff member. Every call passes a `dedupeKey`, and a unique index on
`(user_id, dedupe_key)` means a retried webhook or a re-run cron cannot notify
twice.

| Event | Dedupe key |
| --- | --- |
| New enquiry | `lead-created:<leadId>` |
| Lead with no reply after 48h | `lead-stale:<leadId>` |
| Advance paid | `quote-advance-paid:<transactionId>` |
| Invoice paid | `invoice-paid:<transactionId>` |
| Invoice went overdue | `invoice-overdue:<invoiceId>` |
| Ticket opened | `ticket-created:<threadId>` |
| Project delivered | `project-completed:<projectId>` |

## No-double-send stamps

The cron is idempotent because it stamps the row before the send counts as
done. If you add a scheduled message, add a stamp column with it.

- `leads.nudged_at`, `leads.last_contacted_at`
- `quotes.followup_sent_at`
- `invoices.reminder_sent_at`, `invoices.overdue_notice_at`
- `milestones.client_notified_at`
- `projects.handover_sent_at`

## Schedules

Both crons are declared in `vercel.json` and check `CRON_SECRET` when it is set.

- `/api/cron/project-digest` — 12:30 UTC daily
- `/api/cron/lifecycle` — 04:00 UTC daily

Run either by hand in development:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:43127/api/cron/lifecycle
```

## Environment

WhatsApp templates must be approved in Meta Business Manager before they send.
Names are configurable so you are not stuck with ours:

- `WHATSAPP_PAYMENT_TEMPLATE` (default `payment_confirmation`)
- `WHATSAPP_QUOTE_TEMPLATE` (default `quotation_ready`)

See `docs/WHATSAPP-SETUP.md` for the parameter order each template expects, and
`docs/EMAIL-SETUP.md` for provider configuration.
