<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lynx portal — auth safety (non-negotiable)

## Never rotate human admin passwords

Cloud agents previously reset `setu.dhyani@gmail.com` via the Supabase service
role so Playwright could screenshot `/admin`. That is why the owner kept
“losing” their password after agent changes. **That must never happen again.**

### Hard rules

1. **Do not** call `auth.admin.updateUserById` / `createUser` with a new
   password for any protected human account (`setu.dhyani@gmail.com`,
   `raghudhyani@gmail.com`, or `PORTAL_ADMIN_EMAIL`).
2. **Do not** write owner credentials into `/tmp/*login*.txt`.
3. For browser/UI verification, use the disposable QA panel login only:
   - Run `node scripts/ensure-qa-panel-user.cjs`
   - Read `/tmp/lynx-qa-panel-login.txt` (email + password)
   - Account: `qa.panel@lynxweb.in` (role `ADMIN`)
4. If the owner is locked out, **send a password-recovery email** or ask them
   what temporary password to set — never invent and silently apply one.
5. Product code must never overwrite staff passwords on invite accept (see
   `acceptInviteAction` guards + `src/lib/portal/auth-safety.ts`).

### Allowed auth mutations

- QA panel user only (`qa.panel@lynxweb.in`) via `scripts/ensure-qa-panel-user.cjs`
- Client QA users that are clearly disposable (`qa.*@lynxweb.in`) when the task
  is client-portal testing
- Invite/create flows initiated by the product UI for *new* emails
