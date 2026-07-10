import 'server-only';

/**
 * Outbound email. Uses the Resend HTTP API when RESEND_API_KEY is set;
 * otherwise logs the message to the server console so every flow stays
 * fully testable in development without any provider configured.
 */

const FROM = process.env.EMAIL_FROM || 'Global Garden <onboarding@resend.dev>';

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  if (!isEmailEnabled()) {
    console.log(
      `[email:dev] To: ${message.to}\n[email:dev] Subject: ${message.subject}\n[email:dev] ${message.text}`
    );
    return { delivered: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return { delivered: true };
}

/** Shared shell so every email the app sends looks like it came from one place. */
function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FAF7F0;font-family:Georgia,'Times New Roman',serif;color:#2C2A27;">
    <div style="max-width:520px;margin:0 auto;padding:48px 24px;">
      <p style="font-size:14px;letter-spacing:0.2em;text-transform:uppercase;color:#2D5016;margin:0 0 32px;">Global Garden</p>
      <h1 style="font-size:26px;font-weight:600;margin:0 0 16px;">${title}</h1>
      ${bodyHtml}
      <p style="font-size:12px;color:#8B8478;margin-top:48px;border-top:1px solid #EFE9DD;padding-top:16px;">
        You received this because of activity on your Global Garden account. If this wasn't you, you can safely ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<p style="margin:32px 0;">
    <a href="${href}" style="background:#2D5016;color:#FAF7F0;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;display:inline-block;">${label}</a>
  </p>
  <p style="font-size:13px;color:#8B8478;word-break:break-all;">Or paste this link into your browser:<br>${href}</p>`;
}

export function verificationEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Verify your email · Global Garden',
    text: `Welcome to Global Garden!\n\nConfirm your email address to start planting, watering, and earning karma:\n${link}\n\nThis link expires in 24 hours.`,
    html: emailLayout(
      'Welcome to the garden',
      `<p style="font-size:15px;line-height:1.6;">Confirm your email address to start planting, watering, and earning karma. This link expires in 24 hours.</p>${ctaButton(link, 'Verify my email')}`
    ),
  };
}

export function passwordResetEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: 'Reset your password · Global Garden',
    text: `Someone (hopefully you) asked to reset the password for your Global Garden account.\n\nChoose a new password here:\n${link}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email — your password is unchanged.`,
    html: emailLayout(
      'Reset your password',
      `<p style="font-size:15px;line-height:1.6;">Someone (hopefully you) asked to reset the password for your Global Garden account. This link expires in 1 hour; if you didn't ask for it, your password stays unchanged.</p>${ctaButton(link, 'Choose a new password')}`
    ),
  };
}
