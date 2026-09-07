import type { Metadata } from 'next';
import '@fontsource/caveat/700.css';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { s } from '@/app/tailwind-styles';
import { createSiteMetadata, SITE_URL } from '@/lib/site-metadata';
import './globals.css';

config.autoAddCss = false;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  ...createSiteMetadata({
    title: 'Force Against — Find your way to act',
    openGraphTitle: 'Force Against - Do Your Part.',
    description: 'A curated directory of verified petitions, lawsuits, and campaigns organized by issue so you can find your way to act.',
    path: '/',
  }),
  icons: {
    icon: [
      { url: '/favicon-star.ico', sizes: '48x48' },
      { url: '/favicon-star-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-star-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-star-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-star-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon-star.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon-star.ico'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="scroll-smooth motion-reduce:scroll-auto" lang="en" data-scroll-behavior="smooth">
      <body className={s.pageBody}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
