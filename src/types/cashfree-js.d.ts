declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeCheckoutResult = {
    error?: { message?: string; code?: string };
    redirect?: boolean;
    paymentDetails?: unknown;
  };

  export type CashfreeInstance = {
    checkout: (options: {
      paymentSessionId: string;
      redirectTarget?: "_self" | "_blank" | "_top" | "_modal";
    }) => Promise<CashfreeCheckoutResult>;
  };

  export function load(options: {
    mode: "sandbox" | "production";
  }): Promise<CashfreeInstance>;
}
