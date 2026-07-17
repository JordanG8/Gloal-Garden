import 'server-only';
import type { Locale } from '@/i18n/config';

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

const COPY = {
  en: {
    dir: 'ltr',
    brand: 'GLOBAL GARDEN',
    verifySubject: 'Verify your email · Global Garden',
    verifyTitle: 'Welcome to the garden',
    verifyBody:
      'Confirm your email address to start planting, watering, and earning karma. This link expires in 24 hours.',
    verifyCta: 'Verify my email',
    resetSubject: 'Reset your password · Global Garden',
    resetTitle: 'Reset your password',
    resetBody:
      "Someone (hopefully you) asked to reset the password for your Global Garden account. This link expires in 1 hour; if you didn't ask for it, your password stays unchanged.",
    resetCta: 'Choose a new password',
    paste: 'Or paste this link into your browser:',
    footer:
      "You received this because of activity on your Global Garden account. If this wasn't you, you can safely ignore this email.",
  },
  he: {
    dir: 'rtl',
    brand: 'הגינה העולמית',
    verifySubject: 'אימות אימייל · הגינה העולמית',
    verifyTitle: 'ברוכים הבאים לגינה',
    verifyBody: 'אשרו את כתובת האימייל כדי להתחיל לשתול, להשקות ולצבור קארמה. הקישור תקף ל־24 שעות.',
    verifyCta: 'אימות האימייל שלי',
    resetSubject: 'איפוס סיסמה · הגינה העולמית',
    resetTitle: 'איפוס סיסמה',
    resetBody:
      'מישהו (בתקווה אתם) ביקש לאפס את הסיסמה לחשבון שלכם. הקישור תקף לשעה; אם לא ביקשתם — הסיסמה נשארת ללא שינוי.',
    resetCta: 'בחירת סיסמה חדשה',
    paste: 'או הדביקו את הקישור בדפדפן:',
    footer: 'קיבלתם את ההודעה בגלל פעילות בחשבון הגינה העולמית שלכם. אם זה לא הייתם אתם, אפשר להתעלם מהמייל.',
  },
} as const;

/** Grove-styled shell shared by every email the app sends. */
function emailLayout(locale: Locale, title: string, bodyHtml: string): string {
  const c = COPY[locale];
  return `<!doctype html>
<html dir="${c.dir}" lang="${locale}">
  <body style="margin:0;padding:0;background:#ECE9E0;font-family:'Helvetica Neue',Arial,sans-serif;color:#20251C;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;" dir="${c.dir}">
      <div style="background:#17402B;border-radius:20px;padding:28px;">
        <p style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#DCE7D6;margin:0 0 20px;font-weight:700;">${c.brand}</p>
        <h1 style="font-size:26px;font-weight:800;margin:0 0 14px;color:#FAF8F2;">${title}</h1>
        <div style="font-size:15px;line-height:1.6;color:rgba(250,248,242,0.85);">${bodyHtml}</div>
      </div>
      <p style="font-size:12px;color:#857D6C;margin-top:24px;line-height:1.5;">${c.footer}</p>
    </div>
  </body>
</html>`;
}

function ctaButton(locale: Locale, href: string, label: string): string {
  const c = COPY[locale];
  return `<p style="margin:26px 0 18px;">
    <a href="${href}" style="background:#C9A22B;color:#1D1607;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:15px;font-weight:700;display:inline-block;">${label}</a>
  </p>
  <p style="font-size:12px;color:rgba(250,248,242,0.6);word-break:break-all;">${c.paste}<br>${href}</p>`;
}

export function verificationEmail(to: string, link: string, locale: Locale = 'en'): EmailMessage {
  const c = COPY[locale];
  return {
    to,
    subject: c.verifySubject,
    text: `${c.verifyTitle}\n\n${c.verifyBody}\n${link}`,
    html: emailLayout(locale, c.verifyTitle, `<p style="margin:0;">${c.verifyBody}</p>${ctaButton(locale, link, c.verifyCta)}`),
  };
}

export function passwordResetEmail(to: string, link: string, locale: Locale = 'en'): EmailMessage {
  const c = COPY[locale];
  return {
    to,
    subject: c.resetSubject,
    text: `${c.resetTitle}\n\n${c.resetBody}\n${link}`,
    html: emailLayout(locale, c.resetTitle, `<p style="margin:0;">${c.resetBody}</p>${ctaButton(locale, link, c.resetCta)}`),
  };
}
