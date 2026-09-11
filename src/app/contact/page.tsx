import type { Metadata } from "next";
import { headers } from "next/headers";
import { ProjectIntakeForm } from "@/components/contact/project-intake-form";
import { SectionHeading } from "@/components/ui/section-heading";
import { getPlanBySlug, sellableAddOns } from "@/lib/plans";
import { resolveDefaultPhoneCountry } from "@/lib/phone";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Start a project or book a website plan with Lynx Web Solutions. Tell us who you are and what you need — we reply within one business day.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: `Contact | ${siteConfig.name}`,
    description:
      "Start a conversation about websites, SaaS, ecommerce, SEO, or a packaged plan.",
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
  const headerStore = await headers();
  const defaultPhoneCountry = resolveDefaultPhoneCountry(headerStore);

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
                ? `Project total ${plan.priceLabel} · ${plan.paymentTerms} · ${plan.delivery}. Fill the intake and we’ll confirm scope, then share the advance invoice / kickoff steps.`
                : addon
                  ? `${addon.summary} Tell us which site this attaches to and we’ll quote turnaround.`
                  : "A short note is enough to start. Prefer a packaged website? Book an advance on Plans."
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
          defaultPhoneCountry={defaultPhoneCountry}
        />
      </div>
    </section>
  );
}
