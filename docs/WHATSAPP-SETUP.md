# WhatsApp payment confirmations

Lynx can send automatic WhatsApp messages when a quotation advance or invoice
payment settles. Click-to-chat (`wa.me`) still works for marketing; this guide
covers **outbound business messages** via Meta WhatsApp Cloud API.

## Why a Cloud API (not just wa.me)

`wa.me` links open WhatsApp for the visitor to message you. They cannot send a
confirmation *to the client* after payment. For that you need:

1. A Meta Business account with WhatsApp Business Platform
2. An approved **message template** (required for business-initiated chats)
3. Server credentials stored in Vercel env vars

## One-time Meta setup

1. Open [Meta for Developers](https://developers.facebook.com/) → your app →
   WhatsApp → API Setup.
2. Copy **Phone number ID** and a permanent **System User** access token
   (Business Settings → System Users → Generate token with `whatsapp_business_messaging`).
3. Create a template named `payment_confirmation` (or set
   `WHATSAPP_PAYMENT_TEMPLATE` to your name) with body variables:

   ```
   Hi {{1}}, Lynx received {{2}} for {{3}}. Ref: {{4}}. Thank you.
   ```

   Example: `Hi Priya, Lynx received ₹25,000 for Invoice INV-1042. Ref: lynxi_…. Thank you.`

4. Create a second template named `quotation_ready` (or set
   `WHATSAPP_QUOTE_TEMPLATE`) with body variables:

   ```
   Hi {{1}}, your Lynx quotation {{2}} for {{3}} ({{4}}) is ready: {{5}}
   ```

   Example: `Hi Priya, your Lynx quotation QT-1042 for Storefront rebuild (₹1,80,000) is ready: https://…`

5. Submit both templates for approval (usually same day for utility templates).

## Environment variables

```bash
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_PAYMENT_TEMPLATE=payment_confirmation
WHATSAPP_QUOTE_TEMPLATE=quotation_ready
WHATSAPP_TEMPLATE_LANG=en
```

Optional: keep `NEXT_PUBLIC_WHATSAPP_NUMBER` for the website click-to-chat widget.

## Behaviour in Lynx

After Cashfree marks a quote advance or invoice payment paid, settlement:

1. Emails the receipt (existing path)
2. Calls `sendPaymentWhatsApp` with the payer’s phone from the transaction
3. Writes a row to `whatsapp_log` (`sent` / `failed` / `skipped`)

If Cloud API credentials are missing, payment still succeeds — WhatsApp is
logged as `skipped` and Admin → Settings shows the gap.

## Testing

1. Use Meta’s test numbers in the developer console first.
2. Pay a sandbox invoice with a phone you control.
3. Confirm Admin → Settings → WhatsApp log shows `sent`.
4. Switch the Cashfree + WhatsApp apps to production together.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `skipped` in log | Env vars missing |
| `failed` · template name | Template not approved or name mismatch |
| `failed` · (#131030) | Recipient not opted in / test number limit |
| Message never arrives | Wrong country code — Lynx normalises 10-digit Indian mobiles to `91…` |
