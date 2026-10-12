# veldmesh.io

Marketing site for **Veldmesh** — the zero-trust mesh VPN built on Noise IK.
Next.js (App Router) + Tailwind CSS.

## Development

```bash
npm install
npm run dev        # local dev server
npm run build      # production build
npm run lint       # eslint (flat config, eslint-config-next)
npm test           # vitest, single run (CI=true also works)
```

## Waitlist

Visitors can join the waitlist from the home page, the end of the features and
docs pages, or the dedicated `/waitlist` page. The shared form component
(`components/waitlist-form.tsx`) posts to **our own** API route,
`POST /api/waitlist` — the browser never talks to any other server.

### Flow: route → mesh → queue fallback

1. **Validation** (`app/api/waitlist/route.ts`) — the route requires a valid,
   non-disposable email address (blocklist in `data/disposable-domains.json`)
   and an explicit `consent: true`. The moment of consent is recorded
   server-side (`consent_at`, UTC ISO 8601) together with `consent_version`
   and a SHA-256 `consent_text_hash` of the exact checkbox label, so what the
   user agreed to is auditable. Rejections return `400`.
2. **Honeypot** — the form contains a hidden `company_website` field.
   Submissions that fill it are bots: they receive the normal generic success
   response, but the signup is dropped and never forwarded anywhere.
3. **Delivery** (`lib/mesh.ts`) — valid signups are forwarded server-side to
   the operator's server, reached over the Veld mesh, with a bearer token.
   The payload carries `email`, `source`, `consent_at`, `consent_version`,
   `consent_text_hash`, any `utm_*` tags, the referrer, and an
   `idempotency_key` so retries can be deduplicated. `source` is always set:
   forms send the page they live on (`home`, `features`, `docs`, `waitlist`)
   or the visitor's free-text answer; anything else defaults to `website`.
4. **Queue fallback** (`lib/queue.ts`) — if delivery fails with a *retryable*
   error (network error, timeout, 408, 429 or 5xx), the signup is written to
   the local queue directory as
   `{"idempotency_key","next_retry_at","retry_count","ciphertext"}` and the
   visitor gets `202`. The `ciphertext` is the signup payload encrypted with
   age using **only the public key** configured in `QUEUE_ENCRYPTION_KEY` —
   this web server cannot decrypt its own queue, and there is deliberately
   no private key on this host. A *permanent* failure — any other 4xx — is
   never queued: the visitor gets a `400` (validation-type rejection) or
   `500`, and the rejection is logged.
5. **Retry worker** (`scripts/waitlist-worker.ts`, logic in
   `lib/queue-worker.ts`) — a background process scans the queue every 30
   seconds and re-POSTs each due entry's ciphertext, unchanged, to the
   operator's server (`POST /api/waitlist/queued`, body
   `{idempotency_key, ciphertext}`). The operator's server holds the age
   **private key**, decrypts there, and deduplicates on `idempotency_key`.
   Retries back off exponentially (30s → 60s → 120s … capped at 5 minutes).
   On a 2xx the queue entry is deleted. Entries older than 24 hours, or
   permanently rejected by the server, are logged at ERROR with their
   `idempotency_key` (never silently dropped) and removed.

   > The `POST /api/waitlist/queued` endpoint on the operator's server is to
   > be added in a separate deployment. Until it exists, queued entries
   > cannot be redelivered.

### Rate limiting and client IPs

Signups are rate-limited to 5 requests per minute per client IP
(`lib/rate-limit.ts`, in-memory — per-process, not shared between
instances). **The app must sit behind exactly one trusted reverse proxy**
that appends the client IP to `x-forwarded-for` or sets `x-real-ip`.
The route uses the **last** `x-forwarded-for` entry (the one appended by our
own proxy) or `x-real-ip`; earlier entries are client-controlled and are never
trusted for limiting. Requests that arrive without either header never went through the
trusted proxy — each gets a private per-request bucket, so such clients
cannot block anyone else, but that traffic is not per-client rate limited.
The origin should never be exposed directly.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `WAITLIST_FORWARD_URL` | Base URL of the operator's server, reached over the Veld mesh |
| `WAITLIST_BEARER_TOKEN` | Bearer token sent to the operator's server |
| `QUEUE_ENCRYPTION_KEY` | age **public** key (`age1…`) used to encrypt queued entries. The matching private key lives only on the operator's server — never on this host |
| `LOG_SALT` | Salt for the SHA-256 `email_hash` used in logs (required in production) |
| `WAITLIST_QUEUE_DIR` | Queue directory (default `/var/lib/veldsite/waitlist-queue`) |
| `MAX_QUEUE_FILES`, `MAX_QUEUE_SIZE_MB` | Optional caps; new signups are rejected with `503` when the queue is full |

See `.env.example`. Never commit real values.

### Privacy

Logs never contain raw emails, referrers or UTM tags — only the salted
`email_hash`, `consent_at` and error codes. Queue files contain no plaintext
personal data: everything except the retry metadata is encrypted. What the
waitlist collects and why is documented on
[`/privacy`](https://veldmesh.io/privacy) — keep that page in sync with any
change to the collected fields.

### Tests

`CI=true npm test` runs the vitest suite in `__tests__/` against the real
route handler with mocked mesh/network. Covered: email validation and
disposable-domain rejection, rate limiting, client-IP extraction from proxy
headers, honeypot behavior, source defaults, permanent-vs-retryable mesh
failures, queue envelope write/read, age encryption (ciphertext is opaque and
recoverable only with the private key), and the retry worker's delivery,
backoff, expiry and permanent-rejection paths.
