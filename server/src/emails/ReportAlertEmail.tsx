import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface ReportAlertEmailProps {
  productName: string;
  // Where the counterfeit was found/reported — this is report.country, not
  // necessarily the reporting user's own account country.
  country: string;
  description: string;
  dateFiled: string;
}

export default function ReportAlertEmail({
  productName,
  country,
  description,
  dateFiled,
}: ReportAlertEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New counterfeit report filed: {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>New Counterfeit Report</Heading>
          <Text style={paragraph}>
            A new counterfeit medicine report has been filed and recorded in the Hakikisha
            system.
          </Text>

          <Hr style={hr} />

          <Section>
            <Text style={label}>Product</Text>
            <Text style={value}>{productName}</Text>

            <Text style={label}>Country</Text>
            <Text style={value}>{country}</Text>

            <Text style={label}>Date filed</Text>
            <Text style={value}>{dateFiled}</Text>

            <Text style={label}>Description</Text>
            <Text style={value}>{description}</Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            This report is in the Hakikisha system and is pending review. No action is required
            from this email — visit the admin dashboard to approve or dismiss it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data react-email's local preview server (and its dev-server UI)
// renders this template with by default — lets you open it in a browser
// without wiring up a real report first.
ReportAlertEmail.PreviewProps = {
  productName: "Panadol",
  country: "Kenya",
  description:
    "The foil seal was already broken when purchased, and the tablets looked a slightly different colour than usual.",
  dateFiled: "July 22, 2026",
} satisfies ReportAlertEmailProps;

const main = {
  backgroundColor: "#f9fafb",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "32px",
  maxWidth: "480px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
};

const heading = {
  fontSize: "20px",
  color: "#111827",
  marginBottom: "8px",
};

const paragraph = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "22px",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "20px 0",
};

const label = {
  fontSize: "11px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "#6b7280",
  margin: "0 0 4px",
};

const value = {
  fontSize: "14px",
  color: "#111827",
  margin: "0 0 16px",
  fontWeight: 500,
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
  lineHeight: "18px",
};
