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

export type AdvancePaidAlertProps = {
  customerName: string;
  customerEmail?: string | null;
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

export function AdvancePaidAlertEmail(props: AdvancePaidAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>
        Advance paid: {props.planName} · {formatInr(props.amountInr)}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Project advance paid</Heading>
          <Text style={styles.meta}>Cashfree · ready for kickoff</Text>
          <Text style={styles.row}>
            <strong>Client:</strong> {props.customerName}
          </Text>
          {props.customerEmail ? (
            <Text style={styles.row}>
              <strong>Email:</strong> {props.customerEmail}
            </Text>
          ) : null}
          <Text style={styles.row}>
            <strong>Plan:</strong> {props.planName}
          </Text>
          <Text style={styles.row}>
            <strong>Advance:</strong> {formatInr(props.amountInr)}
          </Text>
          <Text style={styles.row}>
            <strong>Order:</strong> {props.orderId}
          </Text>
          {props.invoiceNumber ? (
            <Text style={styles.row}>
              <strong>Invoice:</strong> {props.invoiceNumber}
            </Text>
          ) : null}
          <Hr style={styles.hr} />
          <Text style={styles.row}>
            Reply within one business day with kickoff timing and next milestones.
            Remaining balance is due before go-live.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default AdvancePaidAlertEmail;

const styles = {
  body: {
    backgroundColor: "#0b1210",
    fontFamily:
      'Figtree, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    backgroundColor: "#121a17",
    margin: "40px auto",
    padding: "32px",
    borderRadius: "12px",
    maxWidth: "560px",
  },
  heading: { color: "#d4b45a", fontSize: "22px", margin: "0 0 8px" },
  meta: { color: "#9aaba2", fontSize: "12px", marginBottom: "20px" },
  row: { color: "#e8eee9", fontSize: "14px", lineHeight: "1.5", margin: "6px 0" },
  hr: { borderColor: "#24302b", margin: "20px 0" },
} as const;
