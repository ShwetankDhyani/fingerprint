import type { Metadata } from "next";
import { ProjectIntakeForm } from "@/components/contact/project-intake-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPlanBySlug, sellableAddOns } from "@/lib/plans";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Start a project or book a website plan with Lynx Web Solutions. Share scope, budget tier, and timeline — we reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${siteConfig.name}`,
    description:
      "High-end project intake for websites, SaaS, ecommerce, SEO, and packaged plans.",
    url: `${siteConfig.url}/contact`,
  },
};

type ContactSearchParams = {
  plan?: string;
  addon?: string;
  type?: string;
  mode?: string;
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<ContactSearchParams>;
}) {
  const params = await searchParams;
  const plan = getPlanBySlug(params.plan);
  const addon = sellableAddOns.find((item) => item.slug === params.addon);

  return (
    <section className="relative overflow-hidden bg-background">
      <div className="lynx-grid absolute inset-0 opacity-25" />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div>
          <SectionHeading
            eyebrow="Contact"
            title={
              plan
                ? params.mode === "discuss"
                  ? `Discuss ${plan.name}`
                  : `Book ${plan.name}`
                : addon
                  ? `Add-on: ${addon.title}`
                  : "Project kickoff."
            }
            description={
              plan
                ? `${plan.priceLabel} · ${plan.delivery}. Fill the intake and we’ll confirm scope, then share payment / kickoff steps.`
                : addon
                  ? `${addon.summary} Tell us which site this attaches to and we’ll quote turnaround.`
                  : "Frictionless intake — scope, budget tier, timeline, and technical notes. Or pick a packaged plan from Plans."
            }
          />
          <div className="mt-10 space-y-4 text-sm text-muted-foreground">
            <p>
              Email{" "}
              <a
                className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
                href={`mailto:${siteConfig.email}`}
              >
                {siteConfig.email}
              </a>
            </p>
            <p className="space-x-1">
              <span>Phone</span>
              {siteConfig.phones.map((phone, index) => (
                <span key={phone}>
                  {index > 0 ? <span> · </span> : null}
                  <a
                    className="font-medium text-forest underline-offset-4 hover:underline dark:text-gold"
                    href={`tel:${phone.replace(/\s/g, "")}`}
                  >
                    {phone}
                  </a>
                </span>
              ))}
            </p>
            <p>WhatsApp: same lines · 24×7</p>
            <p>Typical reply window: one business day for email briefs.</p>
            <p>Markets: India and global remote delivery.</p>
          </div>
        </div>
        <ProjectIntakeForm
          defaultPlanSlug={plan?.slug}
          defaultAddonSlug={addon?.slug}
        />
      </div>
    </section>
  );
}
