"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy Cashfree return handler for older return_url values that still land
 * on /plans, /q/*, or /client/billing. Forwards to the full confirmation screen.
 */
export function CashfreeReturnHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const orderId = searchParams.get("order_id");
    if (checkout !== "cashfree" || !orderId) return;
    router.replace(
      `/payments/confirmation?order_id=${encodeURIComponent(orderId)}`,
    );
  }, [router, searchParams]);

  return null;
}
