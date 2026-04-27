import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus OS — AI Sales Agent',
  description:
    'AI-powered sales automation for freelancers and agencies. Score leads, draft personalized emails, and book meetings — with human approval.',
  icons: { icon: '/favicon.ico' },
};

import ErrorBoundary from '../components/shared/ErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
