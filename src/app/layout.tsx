import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Figtree, JetBrains_Mono, Syne } from "next/font/google";
import { RootChrome } from "@/components/layout/root-chrome";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { siteConfig } from "@/lib/site";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | Precision web engineering since ${siteConfig.founded}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [
    "Lynx Web Solutions",
    "web development agency",
    "Next.js agency India",
    "SaaS engineering",
    "ecommerce development",
    "technical SEO",
    "lynxweb.in",
  ],
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${figtree.variable} ${syne.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <RootChrome>{children}</RootChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
