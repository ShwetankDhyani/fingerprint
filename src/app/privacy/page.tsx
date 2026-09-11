import type { Metadata } from "next";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${siteConfig.name} collects, uses, and protects personal information.`,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy | ${siteConfig.name}`,
    description: "Our privacy practices for inquiries, payments, and project work.",
    url: `${siteConfig.url}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="Legal"
          title="Privacy Policy"
          description={`Last updated ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}.`}
        />

        <div className="mt-12 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Who we are
            </h2>
            <p className="mt-3">
              {siteConfig.name} (“Lynx”, “we”, “us”) operates{" "}
              <a
                href={siteConfig.url}
                className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
              >
                {siteConfig.url.replace(/^https?:\/\//, "")}
              </a>
              . Contact:{" "}
              <a
                href={`mailto:${siteConfig.email}`}
                className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
              >
                {siteConfig.email}
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              What we collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Inquiry details you submit (name, email, company, project notes,
                selected plan).
              </li>
              <li>
                Payment booking details needed to create a Cashfree order (name,
                email, mobile) and payment status from Cashfree.
              </li>
              <li>
                Basic technical data (IP address for rate limiting, browser
                metadata) when you use forms or checkout.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              How we use it
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Respond to project inquiries and schedule kickoff.</li>
              <li>
                Process plan advances, confirm payment, and send receipts /
                internal alerts.
              </li>
              <li>Improve reliability, prevent abuse, and meet legal duties.</li>
            </ul>
            <p className="mt-3">
              We do not sell personal data. We do not use your information for
              unrelated advertising networks.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Processors we use
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Cashfree — payment processing.</li>
              <li>Resend — transactional email.</li>
              <li>Supabase — secure storage of leads and transactions.</li>
              <li>Vercel — hosting and edge delivery.</li>
            </ul>
            <p className="mt-3">
              These providers process data only as needed to run our service,
              under their own privacy terms.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Retention &amp; security
            </h2>
            <p className="mt-3">
              We keep inquiry and payment records as long as needed for project
              delivery, accounting, and dispute resolution, then delete or
              anonymize when no longer required. Access to production systems is
              limited to authorized operators; secrets stay server-side.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Your choices
            </h2>
            <p className="mt-3">
              Email {siteConfig.email} to request access, correction, or deletion
              of inquiry data we hold, subject to legal retention requirements
              (for example paid invoices).
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Changes
            </h2>
            <p className="mt-3">
              We may update this policy as products or processors change. The
              “Last updated” date above will change when we do.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
