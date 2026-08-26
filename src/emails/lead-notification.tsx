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

export type LeadNotificationProps = {
  name: string;
  email: string;
  company: string;
  projectType: string;
  budget: string;
  timeline: string;
  selectedPlan?: string;
  scope: string;
  leadId?: string;
};

export function LeadNotificationEmail(props: LeadNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>
        New lead: {props.name} · {props.company}
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.heading}>New project inquiry</Heading>
          <Text style={styles.meta}>
            {props.leadId ? `Lead ID: ${props.leadId}` : "Lead captured"}
          </Text>
          <Text style={styles.row}>
            <strong>Name:</strong> {props.name}
          </Text>
          <Text style={styles.row}>
            <strong>Email:</strong> {props.email}
          </Text>
          <Text style={styles.row}>
            <strong>Company:</strong> {props.company}
          </Text>
          <Text style={styles.row}>
            <strong>Type:</strong> {props.projectType}
          </Text>
          <Text style={styles.row}>
            <strong>Budget:</strong> {props.budget}
          </Text>
          <Text style={styles.row}>
            <strong>Timeline:</strong> {props.timeline}
          </Text>
          {props.selectedPlan ? (
            <Text style={styles.row}>
              <strong>Plan:</strong> {props.selectedPlan}
            </Text>
          ) : null}
          <Hr style={styles.hr} />
          <Text style={styles.row}>
            <strong>Scope</strong>
          </Text>
          <Text style={styles.scope}>{props.scope}</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default LeadNotificationEmail;

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
  scope: {
    color: "#e8eee9",
    fontSize: "14px",
    lineHeight: "1.6",
    whiteSpace: "pre-wrap" as const,
  },
  hr: { borderColor: "#24302b", margin: "20px 0" },
} as const;
