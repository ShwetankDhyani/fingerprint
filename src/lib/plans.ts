export const sellablePlans = [
  {
    slug: "starter",
    label: "Starter",
    name: "Local Business Starter",
    planCode: "Starter - Local Business Website",
    priceInr: 14999,
    priceLabel: "₹14,999",
    /** Professional booking: 50% advance to start, 50% before go-live. */
    advancePercent: 50,
    advanceInr: 7500,
    advanceLabel: "₹7,500",
    balanceLabel: "₹7,499",
    paymentTerms: "50% advance to book · 50% before go-live",
    blurb: "Best for freelancers and local businesses",
    delivery: "7–10 days",
    popular: false,
    features: [
      "Up to 5 pages",
      "Mobile-responsive design",
      "Contact + WhatsApp integration",
      "Google Maps + local SEO basics",
      "Kickoff within 48 hours of advance",
    ],
  },
  {
    slug: "growth",
    label: "Growth",
    name: "Lead Generation Pro",
    planCode: "Growth - Lead Generation Website",
    priceInr: 34999,
    priceLabel: "₹34,999",
    advancePercent: 25,
    advanceInr: 8750,
    advanceLabel: "₹8,750",
    balanceLabel: "₹26,249",
    paymentTerms: "25% advance to book · balance before go-live",
    blurb: "Most popular for service and B2B companies",
    delivery: "2–3 weeks",
    popular: true,
    features: [
      "Up to 12 pages",
      "Custom UI + trust-building sections",
      "Lead capture + WhatsApp + email flow",
      "Speed, SEO, and analytics dashboard",
      "Design sign-off before final build",
    ],
  },
  {
    slug: "premium",
    label: "Premium",
    name: "E-commerce or Premium Brand Site",
    planCode: "Premium - Ecommerce or Brand Website",
    priceInr: 69999,
    priceLabel: "₹69,999",
    advancePercent: 25,
    advanceInr: 17500,
    advanceLabel: "₹17,500",
    balanceLabel: "₹52,499",
    paymentTerms: "25% advance to book · balance in milestones",
    blurb: "For scaling brands needing premium presence",
    delivery: "4–6 weeks",
    popular: false,
    features: [
      "Up to 20 pages",
      "Advanced interactions + premium design",
      "E-commerce or multi-funnel setup",
      "Events, heatmaps, and conversion tracking",
      "Milestone reviews with written approvals",
    ],
  },
] as const;

export const sellableServices = [
  {
    slug: "custom-web-development",
    title: "Custom Web Development",
    summary:
      "End-to-end website and web app development: business sites, portals, dashboards, and custom workflows.",
    note: "Primary service for long-term, high-value projects",
  },
  {
    slug: "lead-gen-websites",
    title: "Lead-Gen Business Websites",
    summary:
      "Fast, conversion-first websites for consultants, clinics, agencies, and local service businesses.",
    note: "Highest demand + fastest close in India market",
  },
  {
    slug: "landing-pages-ads",
    title: "Landing Pages for Ads",
    summary:
      "Dedicated pages for Meta/Google campaigns with strong CTAs, WhatsApp click-to-chat, and form capture.",
    note: "Great for monthly retainers and A/B iteration",
  },
  {
    slug: "ecommerce-store-launch",
    title: "E-commerce Store Launch",
    summary:
      "Shopify/WooCommerce setup, payments, product pages, shipping rules, and conversion-ready checkout flows.",
    note: "In demand for D2C brands and Instagram sellers",
  },
  {
    slug: "ai-chatbot",
    title: "AI Chatbot + FAQ Assistant",
    summary:
      "Website assistant that answers common questions, qualifies leads, and drives inquiries 24/7.",
    note: "Low effort add-on with high perceived value",
  },
  {
    slug: "seo-speed",
    title: "SEO and Speed Optimization",
    summary:
      "Technical fixes, Core Web Vitals improvements, local SEO setup, and keyword-focused page structure.",
    note: "Easy upsell for older slow websites",
  },
  {
    slug: "maintenance-retainers",
    title: "Maintenance + Automation Retainers",
    summary:
      "Monthly updates, backups, issue fixes, analytics reporting, and CRM/WhatsApp automation enhancements.",
    note: "Recurring revenue model with stable delivery",
  },
] as const;

export const sellableAddOns = [
  {
    slug: "gbp-setup",
    title: "Google Business Profile Setup",
    summary:
      "Local visibility setup with profile optimization, categories, and action-ready contact details.",
  },
  {
    slug: "whatsapp-automation",
    title: "WhatsApp Lead Automation",
    summary:
      "Auto-replies, lead routing, and follow-up flow integration to improve response speed and conversions.",
  },
  {
    slug: "reporting-dashboard",
    title: "Monthly Reporting Dashboard",
    summary:
      "Simple report of traffic, leads, and conversion trends for clients who want clear business outcomes.",
  },
] as const;

export type SellablePlanSlug = (typeof sellablePlans)[number]["slug"];

export function getPlanBySlug(slug: string | undefined | null) {
  if (!slug) return undefined;
  return sellablePlans.find((plan) => plan.slug === slug);
}

/** Amount charged online today (project advance / booking fee). */
export function getAdvanceAmountInr(plan: (typeof sellablePlans)[number]) {
  return plan.advanceInr;
}

export function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
