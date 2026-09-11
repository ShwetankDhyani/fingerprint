export const siteConfig = {
  name: "Lynx Web Solutions",
  shortName: "Lynx",
  url: "https://www.lynxweb.in",
  email: "care@lynxweb.in",
  phones: ["+91 99998 03332", "+91 99998 03336"] as const,
  /** Primary WhatsApp / click-to-chat number (digits with country code). */
  whatsappE164: "919999803336",
  founded: 2011,
  description:
    "Web engineering for founders and product teams. Websites, SaaS, and ecommerce built for speed, SEO, and scale — India and global, since 2011. Support every day of the week.",
  tagline: "Web products built with precision and pace.",
  locations: [
    {
      name: "India",
      areaServed: "IN",
      description: "Engineering hub serving Indian and international clients",
    },
    {
      name: "Global",
      areaServed: "Worldwide",
      description: "Remote delivery for US, EU, MENA, and APAC teams",
    },
  ],
  nav: [
    { href: "/services", label: "Services" },
    { href: "/plans", label: "Plans" },
    { href: "/work", label: "Work" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ],
  social: {
    linkedin: "https://www.linkedin.com/company/lynx-web-solutions",
  },
} as const;

export const metrics = [
  { label: "Years shipping", value: "2011+" },
  { label: "Support", value: "24×7" },
  { label: "Live client sites", value: "13+" },
  { label: "Markets served", value: "India · Global" },
] as const;

export const services = [
  {
    slug: "web-development",
    title: "High-end web development",
    summary:
      "Marketing and product sites with ruthless performance, clear IA, and conversion paths that don’t feel templated.",
    details: [
      "Next.js / modern frontends",
      "Design systems & CMS",
      "Accessibility & CWV hardening",
    ],
  },
  {
    slug: "saas-engineering",
    title: "Custom SaaS engineering",
    summary:
      "Multi-tenant apps, dashboards, and workflows built by people who’ve lived production incidents — not a ticket farm.",
    details: [
      "Auth, billing, roles",
      "API & data modeling",
      "Observability from day one",
    ],
  },
  {
    slug: "ecommerce",
    title: "High-performance ecommerce",
    summary:
      "Storefronts and commerce experiences tuned for conversion, catalog complexity, and peak-traffic composure.",
    details: [
      "Headless & hybrid stacks",
      "Checkout & catalog UX",
      "Speed under load",
    ],
  },
  {
    slug: "seo-growth",
    title: "SEO & growth architecture",
    summary:
      "Technical SEO, content architecture, and measurement that compound — not a monthly PDF of keyword theater.",
    details: [
      "Schema & crawl health",
      "Content systems",
      "Analytics that explain",
    ],
  },
] as const;

export const portfolioCategories = [
  "All",
  "Ecommerce",
  "Travel",
  "Platforms",
  "Corporate",
  "Wellness",
] as const;

export type PortfolioCategory =
  (typeof portfolioCategories)[number] extends "All"
    ? Exclude<(typeof portfolioCategories)[number], "All">
    : never;

/**
 * Live client work in the Lynx portfolio.
 * Order matters: strongest product/design work first (featured card + homepage picks).
 */
export const portfolioProjects = [
  {
    slug: "chessreview",
    title: "ChessReview.org",
    category: "Platforms",
    industry: "Sports tech",
    market: "Global",
    summary:
      "Free Stockfish game review for club players — paste a Chess.com or Lichess link for move ratings, accuracy, and eval graphs with no sign-up.",
    url: "https://chessreview.org",
    logo: "/portfolio/chess-review-org.png",
    featured: true,
  },
  {
    slug: "getsetgoa",
    title: "GetSetGoa",
    category: "Travel",
    industry: "Hospitality",
    market: "India",
    summary:
      "Premium Goa experiences — off-market cliffside villas, Yoga Alliance retreats, and PADI diving, curated as trips rather than packages.",
    url: "https://getsetgoa.com",
    logo: "/portfolio/getsetgoa-logo.svg",
    featured: true,
  },
  {
    slug: "monk-run",
    title: "monk.run",
    category: "Platforms",
    industry: "Multiplayer games",
    market: "Global",
    summary:
      "Multiplayer globe guesser — drop into Street View with friends, pin the map, and race for the closest call.",
    url: "https://monk.run",
    logo: "/portfolio/monk-run.svg",
    featured: true,
  },
  {
    slug: "tamron-india",
    title: "Tamron India",
    category: "Ecommerce",
    industry: "Photography",
    market: "India",
    summary:
      "Official India presence for Tamron photography lenses — product catalog, support paths, and premium brand storytelling.",
    url: "https://tamron.in",
    logo: "/portfolio/tamron.svg",
    featured: true,
  },
  {
    slug: "roviq",
    title: "ROVIQ",
    category: "Platforms",
    industry: "Defense tech",
    market: "Global",
    summary:
      "Counter-drone and airspace defense platform UI built for real-time threat detection and tracking.",
    url: "https://webpez.com/roviq/",
    logo: "/portfolio/roviq-logo.png",
    featured: true,
  },
  {
    slug: "bct-touristik",
    title: "BCT Touristik",
    category: "Travel",
    industry: "Education travel",
    market: "Germany / Asia",
    summary:
      "German cultural travel portal for guided study tours and educational trips across Asia.",
    url: "https://bct-touristik.de",
    logo: "/portfolio/bct-touristik.png",
    featured: true,
  },
  {
    slug: "kuku-prints",
    title: "Kuku Prints",
    category: "Ecommerce",
    industry: "Apparel",
    market: "India",
    summary:
      "Custom apparel and merchandise storefront tuned for catalog clarity, speed, and a clean shopping flow.",
    url: "https://kukuprints.com",
    logo: "/portfolio/kuku-logo.webp",
    featured: false,
  },
  {
    slug: "carvan-india",
    title: "Carvan India",
    category: "Travel",
    industry: "Tourism",
    market: "India",
    summary:
      "Group travel portal for Himalayan expeditions and custom bus-and-van itineraries across India.",
    url: "https://carvan.in",
    logo: "/portfolio/carvan-logo.png",
    featured: false,
  },
  {
    slug: "fabtech-consultant",
    title: "FabTech Consultant",
    category: "Corporate",
    industry: "Engineering",
    market: "India",
    summary:
      "Structural steel and BIM consultancy site that presents complex engineering services with clarity.",
    url: "https://fabtechconsultant.com/new",
    logo: "/portfolio/fabtech-logo.png",
    featured: false,
  },
  {
    slug: "ikki-world",
    title: "IKKI World",
    category: "Travel",
    industry: "Luxury travel",
    market: "India",
    summary:
      "Luxury travel agency for tailor-made domestic and international holidays.",
    url: "https://ikkiworld.com",
    logo: "/portfolio/ikki-logo-dark.png",
    featured: false,
  },
  {
    slug: "bondnsync",
    title: "BONDnSYNC",
    category: "Wellness",
    industry: "Studio",
    market: "India",
    summary:
      "Wellness studio site for yoga, breathwork, sound healing, and retreats.",
    url: "https://bondnsync.com",
    logo: "/portfolio/BONDnSYNC.webp",
    featured: false,
  },
  {
    slug: "candorview",
    title: "Candorview",
    category: "Corporate",
    industry: "Professional services",
    market: "Global",
    summary:
      "Corporate services website with modern branding and a clear offering structure.",
    url: "https://candorview.com",
    logo: "/portfolio/candorview.png",
    featured: false,
  },
  {
    slug: "flowbros",
    title: "FlowBros",
    category: "Ecommerce",
    industry: "Lifestyle",
    market: "India",
    summary:
      "Handcrafted Dapostars and flow-arts gear store with an interactive shopping experience.",
    url: "https://flowbros.in",
    logo: "/portfolio/flowbros-logo.png",
    featured: false,
  },
] as const;

export const testimonials = [
  {
    quote:
      "We talked to the people writing the code the whole way. No handoffs, no surprise juniors — just clear scope and a site that shipped on time.",
    name: "Priya N.",
    role: "VP Engineering, product team",
  },
  {
    quote:
      "Small team, serious craft. Performance and SEO weren’t afterthoughts — they were in the first build.",
    name: "Marcus T.",
    role: "Founder, DTC brand",
  },
  {
    quote:
      "Clear scope, honest timelines, and a site that still feels fast years later. That’s rare.",
    name: "Ananya R.",
    role: "Head of Marketing, B2B services",
  },
] as const;
