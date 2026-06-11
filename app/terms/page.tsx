// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
export const metadata = {
  title: "Terms of Service — Veldmesh",
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-900">Terms of Service</h1>
        <p className="mb-10 text-sm text-slate-500">Effective date: June 11, 2026</p>

        <section className="prose prose-slate max-w-none">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
            Veldmesh service, website, and software (collectively, the &ldquo;Service&rdquo;)
            provided by <strong>Ironfeast Media, LLC</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;,
            &ldquo;us&rdquo;). By creating an account or using the Service, you agree to these
            Terms.
          </p>

          <h2>1. Eligibility</h2>
          <p>
            You must be at least 18 years old and have the legal authority to enter into these
            Terms on behalf of yourself or your organization. If you are accepting on behalf of a
            company, you represent that you have authority to bind that company.
          </p>

          <h2>2. Account Registration</h2>
          <p>
            You are responsible for maintaining the security of your account credentials. You must
            notify us immediately at{" "}
            <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a> if you suspect unauthorized
            access. We are not liable for losses resulting from unauthorized use of your account.
          </p>

          <h2>3. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable law or regulation</li>
            <li>Transmit malware, spyware, or any malicious code</li>
            <li>Attempt to gain unauthorized access to any system or network</li>
            <li>Interfere with or disrupt the Service or its infrastructure</li>
            <li>Resell or sublicense access to the Service without our written consent</li>
            <li>Circumvent any usage limits or technical restrictions</li>
          </ul>

          <h2>4. Subscription and Billing</h2>
          <p>
            Paid plans are billed monthly or annually in advance. Prices are listed at{" "}
            <a href="/pricing">veldmesh.io/pricing</a>. We reserve the right to change pricing
            with 30 days&rsquo; notice to existing subscribers.
          </p>
          <p>
            Payments are processed by Stripe. By subscribing, you authorize us to charge your
            payment method on a recurring basis until you cancel.
          </p>

          <h2>5. Cancellation and Refunds</h2>
          <p>
            You may cancel your subscription at any time from the dashboard. Cancellation takes
            effect at the end of the current billing period; you retain access until then.
          </p>
          <p>
            We do not offer refunds for partial billing periods. If you believe you were charged
            in error, contact <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a> within 30
            days of the charge.
          </p>

          <h2>6. Free Tier and Trial</h2>
          <p>
            The free tier is provided &ldquo;as is&rdquo; without service level guarantees. We
            reserve the right to modify or discontinue the free tier with 30 days&rsquo; notice.
          </p>

          <h2>7. Open Source Software</h2>
          <p>
            The Veldmesh daemon and CLI are released under the MIT License. The coordination
            server is released under the Business Source License 1.1 (BSL-1.1). Your use of those
            components is additionally governed by those licenses.
          </p>

          <h2>8. Intellectual Property</h2>
          <p>
            The Veldmesh name, logo, and dashboard are the property of Ironfeast Media, LLC. You
            may not use our trademarks without written permission.
          </p>

          <h2>9. Disclaimer of Warranties</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM
            ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS
            FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>

          <h2>10. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IRONFEAST MEDIA, LLC SHALL NOT BE LIABLE FOR
            ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
            PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA,
            USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
          </p>
          <p>
            OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM OR RELATING TO THESE TERMS OR THE
            SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>

          <h2>11. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless Ironfeast Media, LLC and its officers,
            directors, and employees from any claims, damages, or expenses arising from your use
            of the Service or violation of these Terms.
          </p>

          <h2>12. Termination</h2>
          <p>
            We may suspend or terminate your account at any time for violation of these Terms. You
            may delete your account at any time from the dashboard or by contacting us.
          </p>

          <h2>13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to its
            conflict-of-law provisions. Any disputes shall be resolved in the courts of Texas.
          </p>

          <h2>14. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify registered users of
            material changes by email at least 14 days before they take effect. Continued use of
            the Service after changes take effect constitutes acceptance.
          </p>

          <h2>15. Contact</h2>
          <p>
            Ironfeast Media, LLC
            <br />
            <a href="mailto:hello@veldmesh.io">hello@veldmesh.io</a>
          </p>
        </section>
    </div>
  )
}
