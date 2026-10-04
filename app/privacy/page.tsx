// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
export const metadata = {
  title: "Privacy Policy — Veldmesh",
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Privacy Policy</h1>
        <p className="mb-10 text-sm text-slate-500">Effective date: June 11, 2026</p>

        <section className="prose prose-slate max-w-none">
          <p>
            Veldmesh (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is operated by{" "}
            <strong>Ironfeast Media, LLC</strong>. This Privacy Policy explains how we collect,
            use, and protect information when you use our website at{" "}
            <a href="https://veldmesh.io">veldmesh.io</a>, our dashboard at{" "}
            <a href="https://app.veldmesh.io">app.veldmesh.io</a>, and our software (collectively,
            the &ldquo;Service&rdquo;).
          </p>

          <h2>1. Information We Collect</h2>
          <h3>Account information</h3>
          <p>
            When you create an account we collect your email address and a hashed password. We do
            not store your password in plaintext.
          </p>
          <h3>Network and machine metadata</h3>
          <p>
            We store the names, IP addresses, and public keys of machines you register with the
            coordination server. The coordination server never sees or stores your VPN traffic —
            all data-plane communication is end-to-end encrypted with Noise IK. When direct
            connection isn't possible, traffic routes through a relay peer that cannot read
            it (encryption is end-to-end between your devices).
          </p>
          <h3>Billing information</h3>
          <p>
            Payments are processed by Stripe. We store only your Stripe customer ID; we never
            store full card numbers or bank details.
          </p>
          <h3>Usage data</h3>
          <p>
            We collect basic server logs (IP address, timestamp, HTTP method, path) for security
            and abuse prevention. Logs are retained for 30 days.
          </p>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>Provide and operate the Service</li>
            <li>Process payments and send billing receipts</li>
            <li>Respond to support requests</li>
            <li>Detect and prevent abuse or unauthorized access</li>
            <li>Send transactional emails (password reset, subscription notices)</li>
          </ul>
          <p>We do not sell your data to third parties. We do not use your data for advertising.</p>

          <h2>3. Data Sharing</h2>
          <p>We share data only with the following service providers:</p>
          <ul>
            <li>
              <strong>Stripe</strong> — payment processing
            </li>
            <li>
              <strong>Neon / PostgreSQL</strong> — database hosting
            </li>
            <li>
              <strong>Railway</strong> — API hosting
            </li>
            <li>
              <strong>Vercel</strong> — web hosting
            </li>
          </ul>
          <p>
            Each provider is contractually bound to protect your data and may not use it for their
            own purposes.
          </p>

          <h2>4. Data Retention</h2>
          <p>
            Account data is retained for the duration of your account. You may request deletion at
            any time by emailing{" "}
            <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a>. Deleted accounts are
            purged within 30 days. Billing records may be retained longer as required by law.
          </p>

          <h2>5. Security</h2>
          <p>
            We use TLS for all data in transit. Database credentials are encrypted at rest. Access
            to production systems is restricted to authorized personnel.
          </p>

          <h2>6. Your Rights</h2>
          <p>
            Depending on your location, you may have rights to access, correct, or delete your
            personal data, or to object to or restrict certain processing. To exercise any of
            these rights, contact us at{" "}
            <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a>.
          </p>

          <h2>7. Cookies</h2>
          <p>
            The marketing site does not use tracking cookies. The dashboard uses a single
            session cookie (NextAuth) required for authentication. No third-party analytics
            cookies are set.
          </p>

          <h2>8. Children</h2>
          <p>
            The Service is not directed to children under 13. We do not knowingly collect
            information from children under 13.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. We will notify registered users of
            material changes by email. Continued use of the Service after changes constitutes
            acceptance of the updated policy.
          </p>

          <h2>10. Contact</h2>
          <p>
            Ironfeast Media, LLC
            <br />
            <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a>
          </p>
        </section>
    </div>
  )
}
