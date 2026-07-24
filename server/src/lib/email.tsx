import type { ReactElement } from "react";
import { Resend } from "resend";
import { render } from "@react-email/render";
import VerifyEmailAddress from "../emails/VerifyEmailAddress";
import ReportAlertEmail from "../emails/ReportAlertEmail";

// Resend's sandbox sender; only deliverable to the account owner's own
// verified address until a real sending domain is verified. Override via
// EMAIL_FROM once one is.
const EMAIL_FROM = process.env.EMAIL_FROM ?? "Hakikisha <onboarding@resend.dev>";

// Constructed lazily, only when actually sending — constructing it eagerly
// at module load time meant merely *importing* this file (e.g. transitively,
// via app.ts, in tests that never send an email) required
// RESEND_EMAIL_API_KEY to be set, which broke the test suite.
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  resendClient ??= new Resend(process.env.RESEND_EMAIL_API_KEY);
  return resendClient;
}

async function sendReactEmail(params: { to: string; subject: string; react: ReactElement }): Promise<void> {
  const html = await render(params.react);

  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html,
  });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

export async function sendVerificationEmail(to: string, fullName: string, token: string): Promise<void> {
  // The server's own public URL — the link needs to point at the API
  // endpoint that consumes the token, not the frontend.
  const baseUrl = process.env.API_BASE_URL ?? "http://localhost:5000";
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  await sendReactEmail({
    to,
    subject: "Verify your email address",
    react: <VerifyEmailAddress fullName={fullName} verifyUrl={verifyUrl} />,
  });
}

export async function sendReportAlertEmail(
  to: string,
  params: { productName: string; country: string; description: string; dateFiled: string }
): Promise<void> {
  await sendReactEmail({
    to,
    subject: `New counterfeit report: ${params.productName}`,
    react: <ReportAlertEmail {...params} />,
  });
}
