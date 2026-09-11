import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Engagement, advance payment, and delivery terms for ${siteConfig.name}.`,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `Terms of Service | ${siteConfig.name}`,
    description: "Booking advances, project delivery, and acceptable use.",
    url: `${siteConfig.url}/terms`,
  },
};

export default function TermsPage() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8 sm:py-28">
        <SectionHeading
          eyebrow="Legal"
          title="Terms of Service"
          description={`Last updated ${new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}.`}
        />

        <div className="mt-12 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Agreement
            </h2>
            <p className="mt-3">
              By using {siteConfig.url.replace(/^https?:\/\//, "")}, submitting an
              inquiry, or paying a plan advance, you agree to these terms with{" "}
              {siteConfig.name}.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Packaged plans &amp; advances
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Published plan prices are project totals. Online checkout charges
                a <strong className="text-foreground">booking advance only</strong>{" "}
                (typically 40–50%), not the full fee.
              </li>
              <li>
                Kickoff begins after the advance clears and scope is confirmed in
                writing (email or signed brief).
              </li>
              <li>
                Remaining balance is due before go-live, or per milestones stated
                for Premium / custom work.
              </li>
              <li>
                Advances are generally non-refundable once kickoff work has
                started. If we decline a project before kickoff, we refund the
                advance in full.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Delivery &amp; client responsibilities
            </h2>
            <p className="mt-3">
              Delivery windows on the Plans page are estimates from kickoff,
              assuming timely content, feedback, and approvals. Delays on the
              client side may extend the schedule. You confirm you have rights to
              materials you provide (copy, logos, images, product data).
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Payments
            </h2>
            <p className="mt-3">
              Advances are processed by Cashfree. Failed, chargebacked, or
              fraudulent payments may pause or cancel delivery. Currency for
              packaged plans is INR unless we agree otherwise in writing.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Intellectual property
            </h2>
            <p className="mt-3">
              Upon full payment, you own the final delivered site assets created
              uniquely for you, excluding third-party libraries, fonts, stock,
              and Lynx’s pre-existing tools or frameworks. We may reference the
              work in our portfolio unless you ask us not to in writing.
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Limitation of liability
            </h2>
            <p className="mt-3">
              To the fullest extent permitted by law, Lynx’s total liability for
              a packaged plan engagement is limited to fees paid for that
              engagement. We are not liable for indirect or consequential losses
              (lost profits, data, or goodwill).
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Privacy
            </h2>
            <p className="mt-3">
              Personal data is handled as described in our{" "}
              <Link
                href="/privacy"
                className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div>
            <h2 className="font-display text-lg tracking-tight text-forest dark:text-foreground">
              Contact
            </h2>
            <p className="mt-3">
              Questions about these terms:{" "}
              <a
                href={`mailto:${siteConfig.email}`}
                className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
              >
                {siteConfig.email}
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
