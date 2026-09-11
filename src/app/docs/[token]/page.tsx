import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  documentAmountLabel,
  getBusinessDocumentByToken,
} from "@/lib/documents";
import { siteConfig } from "@/lib/site";

type Props = {
  params: Promise<{ token: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const doc = await getBusinessDocumentByToken(token);
  if (!doc) return { title: "Document not found" };
  return {
    title: `${doc.type === "invoice" ? "Invoice" : "Quotation"} ${doc.number}`,
    robots: { index: false, follow: false },
  };
}

export default async function DocumentPage({ params }: Props) {
  const { token } = await params;
  const doc = await getBusinessDocumentByToken(token);
  if (!doc) notFound();

  const title = doc.type === "invoice" ? "Invoice" : "Quotation";
  const amount = documentAmountLabel(doc);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        {siteConfig.name}
      </p>
      <h1 className="mt-3 font-display text-3xl tracking-tight text-forest dark:text-gold">
        {title} {doc.number}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Issued {new Date(doc.createdAt).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </p>

      <dl className="mt-8 grid gap-4 rounded-2xl border border-forest/15 bg-card/80 p-6 dark:border-white/10">
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">
            Bill to
          </dt>
          <dd className="mt-1 font-medium">
            {doc.customerName}
            {doc.company ? ` · ${doc.company}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">
            Amount
          </dt>
          <dd className="mt-1 font-display text-2xl text-forest dark:text-gold">
            {amount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground uppercase tracking-wide">
            Details
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
            {doc.summary}
          </dd>
        </div>
      </dl>

      <p className="mt-8 text-sm text-muted-foreground">
        Questions? Email{" "}
        <a className="underline underline-offset-4" href={`mailto:${siteConfig.email}`}>
          {siteConfig.email}
        </a>{" "}
        or reply on WhatsApp.
      </p>
    </div>
  );
}
