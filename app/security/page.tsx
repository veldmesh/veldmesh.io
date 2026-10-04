// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
export const metadata = {
  title: "Security — Veldmesh",
}

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Security</h1>
        <p className="mb-10 text-sm text-slate-500">Vulnerability disclosure policy</p>

        <section className="prose prose-slate max-w-none">
          <p>
            If you believe you have found a security vulnerability in Veldmesh &mdash; this
            website, the dashboard, the daemon or CLI, or the coordination server &mdash; we
            would like to hear from you. We treat good-faith security research as a service to
            our users and ask that you follow the process below so we can respond quickly.
          </p>

          <h2>1. How to Report</h2>
          <p>
            Email <a href="mailto:security@veldmesh.io">security@veldmesh.io</a>. Please do not
            open a public issue for security reports.
          </p>
          <p>To help us reproduce and assess the issue, include:</p>
          <ul>
            <li>A description of the vulnerability and its potential impact</li>
            <li>Step-by-step instructions or a proof of concept that reproduces the issue</li>
            <li>The affected component (website, dashboard, daemon, CLI, coordination server)</li>
            <li>Any relevant URLs, request captures, logs, or screenshots</li>
          </ul>

          <h2>2. Our Commitments</h2>
          <ul>
            <li>We will acknowledge your report within 3 business days</li>
            <li>We will keep you updated on our progress toward a fix</li>
            <li>With your permission, we will credit you when the fix is announced</li>
          </ul>

          <h2>3. Safe Harbor</h2>
          <p>
            We will not pursue legal action against researchers who interact with the Service
            in good faith, provided they:
          </p>
          <ul>
            <li>Use only accounts and data that are their own or for which they have explicit
            permission</li>
            <li>Avoid accessing, modifying, or exfiltrating data belonging to others</li>
            <li>Avoid degrading, disrupting, or destroying our systems or data</li>
            <li>Give us a reasonable amount of time to fix the issue before public disclosure</li>
          </ul>

          <h2>4. Out of Scope</h2>
          <ul>
            <li>Denial of service, spam, or resource exhaustion testing</li>
            <li>Social engineering, phishing, or physical attacks</li>
            <li>Vulnerabilities in third-party services or libraries &mdash; please report those
            to the relevant provider or maintainer</li>
            <li>Automated scanner output without a demonstrated, reproducible issue</li>
          </ul>

          <h2>5. Bug Bounty</h2>
          <p>
            We do not currently operate a paid bug bounty program. Reports are voluntary, and we
            are grateful to everyone who takes the time to help us improve security.
          </p>
        </section>
    </div>
  )
}
