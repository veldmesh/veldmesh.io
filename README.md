# veldmesh.io

Marketing site for **Veldmesh** — the zero-trust mesh VPN built on Noise IK.
Next.js (App Router) + Tailwind CSS, deployed with Vercel.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run lint       # eslint (flat config, eslint-config-next)
npm test           # vitest, single run (CI=true also works)
```

## Waitlist

Visitors can join the waitlist from the home page hero, the end of the
features and docs pages, or the dedicated `/waitlist` page. The compact
signup form (`components/waitlist-form.tsx`) posts to **our own** API route,
`/api/waitlist` — the browser never calls a third party. All forwarding to
external systems happens server-side in that route.

### What the route does

`app/api/waitlist/route.ts` (with helpers in `lib/waitlist/`):

- **Validation** — accepts JSON only; requires a syntactically valid email
  (≤ 254 chars, normalized to lowercase) and an explicit `consent: true`
  checkbox. Rejections return `400`.
- **Consent** — the moment of consent is recorded server-side
  (`consent_at`, UTC ISO 8601) and forwarded with every signup.
- **Honeypot** — the form contains a hidden `company_website` field.
  Submissions that fill it are bots: they receive the normal generic success
  response but the signup is dropped and never forwarded.
- **Rate limiting** — in-memory token bucket, 5 requests per client IP
  (refill: 1 token/minute). `429` when exhausted. This state is
  **per-instance**: on a single long-lived server (e.g. the VPS) it is
  process-global, but on serverless platforms each instance enforces
  its own bucket. It is a best-effort abuse guard, not a hard guarantee.
  Buckets idle for ≥ 5 minutes are fully refilled, so they are swept and
  dropped; the tracked-IP map stays bounded to recently active clients
  and never grows without limit.
  The client IP is taken from `x-forwarded-for` (first entry) or
  `x-real-ip`. Deployments must sit behind a reverse proxy (nginx, Vercel)
  that sets one of these headers, and the origin should never be exposed
  directly. Requests arriving without any proxy header get a private
  per-request bucket, so they cannot block other clients, but that
  traffic is not per-client rate limited.
- **Body size** — requests over 8 KB are rejected with `413`.
- **UTM / referrer** — the form captures `utm_source`, `utm_medium`,
  `utm_campaign` (from the page URL) and `document.referrer` and sends them
  along; the route sanitizes them (trimmed, control chars stripped, capped
  at 512 chars) and forwards `null` when absent.

### Sinks

Each sink is enabled **only when its environment variables are set**. Set
them in your environment (never commit values — see `.env.example`):

| Sink   | Enabled when                                                                 | Variables                                                                                                                          |
| ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Webhook | `WAITLIST_WEBHOOK_URL` is set                                                | `WAITLIST_WEBHOOK_URL`, `WAITLIST_WEBHOOK_TOKEN` (optional; sent as `Authorization: Bearer <token>`)                              |
| Email  | `SMTP_HOST`, `SMTP_USER` **and** `WAITLIST_NOTIFY_TO` are set                | `SMTP_HOST`, `SMTP_PORT` (default `587`; `465` switches to implicit TLS), `SMTP_USER` (required; also the From address), `SMTP_PASS` (optional), `WAITLIST_NOTIFY_TO` |

**Webhook** — POSTs the signup as JSON:

```json
{
  "email": "user@example.com",
  "source": "veldmesh.io",
  "utm_source": null,
  "utm_medium": null,
  "utm_campaign": null,
  "referrer": null,
  "consent_at": "2026-10-08T12:00:00.000Z"
}
```

Point `WAITLIST_WEBHOOK_URL` at any endpoint that accepts this shape —
for example the operator's internal waitlist collector.

**Email** — sends the signup to the owner's inbox via SMTP using
[nodemailer](https://nodemailer.com). We chose nodemailer rather than
hand-rolling an SMTP client because SMTP (STARTTLS, AUTH, connection
reuse, edge cases) is easy to get subtly wrong; nodemailer is small, has no
runtime dependencies beyond SMTP itself, and is the standard, well-
maintained choice in the Node ecosystem. One pooled transporter is created
per SMTP configuration and reused across signups, so each signup reuses an
established SMTP connection instead of paying for a fresh TCP/TLS
handshake. The message is sent from `SMTP_USER`, which must be an address
the relay is authorized to send from (SPF/DKIM alignment) — the sink stays
disabled without it.

### Response behavior

| Situation                                | Status | Behavior                                                                                       |
| ---------------------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| Valid signup, ≥ 1 sink succeeded         | `200`  | Generic success message — identical whether the email was new or already registered             |
| No sink configured                       | `503`  | The form shows a friendly "not open yet" message. Signups are never silently dropped            |
| All configured sinks failed              | `502`  | Error returned so the visitor can retry                                                        |
| Some sinks failed, at least one succeeded | `200`  | Success (as long as one sink has the signup, the user is safe to succeed)                      |
| Honeypot tripped                          | `200`  | Generic success, signup dropped (bots only)                                                    |
| Invalid email / missing consent / bad JSON | `400` | Validation error message                                                                       |
| Over 8 KB body                            | `413`  | Rejected                                                                                       |
| Over the per-IP rate limit               | `429`  | Rate-limit message, retry after ~1 minute                                                     |

### Privacy

What the waitlist collects and why is documented on
[`/privacy`](https://veldmesh.io/privacy) (what, why, where it is kept, how
to be removed, retention). Keep that page in sync with any change to the
collected fields.

### Tests

`CI=true npm test` runs the vitest suite in `tests/` against the real route
handler with fully mocked sinks (fetch and nodemailer). Covered: email
validation, consent enforcement, JSON/body-size rejection, honeypot
behavior, per-IP rate limiting (burst, block, refill, stale-bucket sweep,
requests without proxy headers), sink selection, sink failure fallback,
SMTP transporter reuse, the `SMTP_USER` requirement, `503` when
unconfigured, and the generic success contract.
