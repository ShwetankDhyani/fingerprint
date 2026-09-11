import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import { siteConfig } from "@/lib/site";

export type AdvanceReceiptProps = {
  customerName: string;
  planName: string;
  amountInr: number;
  orderId: string;
  invoiceNumber?: string | null;
};

function formatInr(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AdvanceReceiptEmail({
  customerName,
  planName,
  amountInr,
  orderId,
  invoiceNumber,
}: AdvanceReceiptProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Advance received — {planName} · {formatInr(amountInr)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Advance payment received</Heading>
          <Text style={styles.text}>Hi {customerName},</Text>
          <Text style={styles.text}>
            Thanks for booking with {siteConfig.name}. We’ve received your
            project advance for <strong>{planName}</strong>.
          </Text>
          <Text style={styles.text}>
            <strong>Amount paid:</strong> {formatInr(amountInr)}
            <br />
            <strong>Order ID:</strong> {orderId}
            {invoiceNumber ? (
              <>
                <br />
                <strong>Invoice:</strong> {invoiceNumber}
              </>
            ) : null}
          </Text>
          <Text style={styles.text}>
            This is a booking advance — not the full project fee. The remaining
            balance is due before go-live (or per the milestones in your plan).
            A Lynx engineer will email kickoff details within one business day.
          </Text>
          <Text style={styles.text}>
            Questions? Reply to this email or write to {siteConfig.email}.
          </Text>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            {siteConfig.name} · {siteConfig.url.replace(/^https?:\/\//, "")} ·
            Since {siteConfig.founded}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AdvanceReceiptEmail;

const styles = {
  body: {
    backgroundColor: "#e7ece9",
    fontFamily:
      'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    backgroundColor: "#f2f5f3",
    margin: "40px auto",
    padding: "32px",
    borderRadius: "12px",
    maxWidth: "560px",
  },
  heading: {
    color: "#0f3d2e",
    fontSize: "24px",
    margin: "0 0 16px",
  },
  text: {
    color: "#0c1612",
    fontSize: "15px",
    lineHeight: "1.6",
  },
  hr: { borderColor: "#c5cec8", margin: "24px 0" },
  footer: { color: "#4f5c56", fontSize: "12px" },
} as const;
