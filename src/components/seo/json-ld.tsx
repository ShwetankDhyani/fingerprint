import { siteConfig } from "@/lib/site";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService", "LocalBusiness"],
    name: siteConfig.name,
    url: siteConfig.url,
    email: siteConfig.email,
    telephone: [...siteConfig.phones],
    foundingDate: String(siteConfig.founded),
    description: siteConfig.description,
    areaServed: siteConfig.locations.map((location) => location.areaServed),
    sameAs: [siteConfig.social.linkedin],
    address: {
      "@type": "PostalAddress",
      addressCountry: "IN",
    },
    knowsAbout: [
      "Web development",
      "SaaS engineering",
      "Ecommerce",
      "Technical SEO",
      "Design systems",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
