import type { Metadata, Viewport } from 'next';
import { Barlow_Condensed, Instrument_Sans, Heebo, Rubik } from 'next/font/google';
import { LOCALES, dirFor, isLocale, type Locale } from '@/i18n/config';
import { getDict } from '@/i18n';
import { I18nProvider } from '@/i18n/provider';
import '../globals.css';

const barlow = Barlow_Condensed({
  variable: '--font-barlow',
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
});

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  display: 'swap',
});

const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

const rubik = Rubik({
  variable: '--font-rubik',
  weight: ['600', '700'],
  subsets: ['hebrew', 'latin'],
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDict(isLocale(locale) ? locale : 'en');
  return {
    title: {
      default: dict.app.name,
      template: `%s · ${dict.app.name}`,
    },
    description: dict.app.tagline,
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: dict.app.name },
  };
}

export const viewport: Viewport = {
  themeColor: '#17402B',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const dict = getDict(locale);

  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <body
        className={`${barlow.variable} ${instrument.variable} ${heebo.variable} ${rubik.variable} antialiased`}
      >
        <I18nProvider locale={locale} dict={dict}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
