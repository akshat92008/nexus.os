import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NeuroNest — Agentic OS',
  description:
    'The modular command center for AI. Orchestrate agents, manage workflows, and track activity in a premium dashboard.',
  icons: { icon: '/favicon.ico' },
};

import ErrorBoundary from '../components/shared/ErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#0D0D0D] text-slate-200 overflow-hidden">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
