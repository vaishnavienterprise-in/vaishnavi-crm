import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { FirebaseProvider } from '@/components/firebase-provider';
import ServiceWorkerRegister from '@/components/sw-register';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vaishnavi Enterprise Sales CRM',
  description: 'Production-ready Sales CRM & Quotation Generator for Vaishnavi Enterprise label solutions.',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#092E20',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Vaishnavi CRM" />
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900 h-full min-h-screen flex flex-col" suppressHydrationWarning>
        <FirebaseProvider>
          {children}
          <ServiceWorkerRegister />
        </FirebaseProvider>
      </body>
    </html>
  );
}
