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

export type ClientAcknowledgmentProps = {
  name: string;
  company: string;
  selectedPlan?: string;
};

export function ClientAcknowledgmentEmail({
  name,
  company,
  selectedPlan,
}: ClientAcknowledgmentProps) {
  return (
    <Html>
      <Head />
      <Preview>We received your Lynx Web Solutions inquiry</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>Message received</Heading>
          <Text style={styles.text}>Hi {name},</Text>
          <Text style={styles.text}>
            Thanks for reaching out about {company}. A Lynx teammate will reply
            within one business day with fit, timing, and a first milestone.
          </Text>
          {selectedPlan ? (
            <Text style={styles.text}>
              Plan noted: <strong>{selectedPlan}</strong>
            </Text>
          ) : null}
          <Text style={styles.text}>
            Prefer WhatsApp in the meantime? Reply to this email or message us
            on the number listed on lynxwebsolutions.com.
          </Text>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>Lynx Web Solutions · Since 2011</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ClientAcknowledgmentEmail;

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
