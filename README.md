# Lynx Web Solutions

Production marketing + transactional platform for **Lynx Web Solutions** ([lynxwebsolutions.com](https://lynxwebsolutions.com)).

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Framer Motion, React Hook Form, Zod
- Resend + React Email
- Supabase (Postgres + RLS)
- Razorpay (India) + Stripe (global)
- WhatsApp click-to-chat

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://127.0.0.1:43127](http://127.0.0.1:43127).

Without payment/email/DB secrets, the app still runs: leads log locally, checkout returns mock orders, and WhatsApp uses the configured public number.

## Backend map

| Area | Path |
| --- | --- |
| Lead server action | `src/app/actions/contact.ts` |
| Email templates | `src/emails/` |
| Razorpay create order | `POST /api/payments/razorpay/create-order` |
| Stripe checkout | `POST /api/payments/stripe/create-checkout` |
| Razorpay webhook | `POST /api/webhooks/razorpay` |
| Stripe webhook | `POST /api/webhooks/stripe` |
| SQL schema + RLS | `supabase/schema.sql` |

## Production checklist

1. Apply `supabase/schema.sql` in your Supabase project.
2. Fill `.env.local` / hosting env from `.env.example`.
3. Point Razorpay + Stripe webhooks at your production `/api/webhooks/*` URLs.
4. Confirm Resend domain/from address is verified.
5. Keep `RAZORPAY_KEY_SECRET`, `STRIPE_SECRET_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` server-only.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server on port 43127 |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |
