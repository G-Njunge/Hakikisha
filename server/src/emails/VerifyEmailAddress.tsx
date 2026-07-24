import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export interface VerifyEmailAddressProps {
  fullName: string;
  verifyUrl: string;
}

export default function VerifyEmailAddress({ fullName, verifyUrl }: VerifyEmailAddressProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email address for Hakikisha</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify your email</Heading>
          <Text style={paragraph}>Hi {fullName},</Text>
          <Text style={paragraph}>
            Thanks for registering with Hakikisha. Click the button below to verify your email
            address — this link expires in 24 hours.
          </Text>

          <Button href={verifyUrl} style={button}>
            Verify email address
          </Button>

          <Text style={paragraph}>
            Or paste this link into your browser:
            <br />
            {verifyUrl}
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            If you didn't create a Hakikisha account, you can safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data for react-email's local preview server.
VerifyEmailAddress.PreviewProps = {
  fullName: "Grace Njunge",
  verifyUrl: "https://hakikisha-production-544a.up.railway.app/api/auth/verify-email?token=sample-token",
} satisfies VerifyEmailAddressProps;

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
  wordBreak: "break-all" as const,
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
  margin: "20px 0",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "20px 0",
};

const footer = {
  fontSize: "12px",
  color: "#9ca3af",
  lineHeight: "18px",
};
