import type { Metadata } from 'next';
import { config } from '@fortawesome/fontawesome-svg-core';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

config.autoAddCss = false;

export const metadata: Metadata = {
  metadataBase: new URL('https://forceagainstsomething.com'),
  title: 'Force Against Something — Find your way to act',
  description: 'A curated directory of verified petitions, lawsuits, and campaigns fighting for the issue you choose.',
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
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Force Against Something',
    title: 'Force Against Something — Find your way to act',
    description: 'One issue. Every verified way to act.',
    images: [{ url: '/og.png', width: 1200, height: 628, alt: 'Force Against Something' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Force Against Something — Find your way to act',
    description: 'One issue. Every verified way to act.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
