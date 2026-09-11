import Link from "next/link";
import { Suspense } from "react";

import { LynxLogo } from "@/components/brand/lynx-logo";
import { PaymentConfirmationClient } from "@/components/payments/payment-confirmation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payment confirmation" };

export default async function PaymentConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order_id?: string; orderId?: string }>;
}) {
  const params = await searchParams;
  const orderId = params.order_id || params.orderId || "";

  return (
    <div className="dark min-h-screen bg-[#0b1210] px-4 py-10 text-[#e8eee9]">
      <div className="mx-auto max-w-lg rounded-xl border border-[#24302b] bg-[#121a17] p-6 shadow-[0_0_0_1px_rgba(176,141,31,0.08)] md:p-8">
        <LynxLogo href="/" size="md" />
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[#b08d1f]">
          Payment confirmation
        </p>
        <Suspense
          fallback={
            <p className="mt-4 text-sm text-[#9aaba2]">Confirming payment…</p>
          }
        >
          <PaymentConfirmationClient orderId={orderId} />
        </Suspense>
        <div className="mt-8 flex flex-wrap gap-3 border-t border-[#24302b] pt-6">
          <Link
            href="/client/billing"
            className={cn(buttonVariants())}
          >
            Open billing
          </Link>
          <Link
            href="/client"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Client portal
          </Link>
        </div>
      </div>
    </div>
  );
}
