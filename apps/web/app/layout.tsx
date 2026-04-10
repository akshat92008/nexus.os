import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nexus OS — Agentic Orchestration Platform',
  description:
    'The OS layer for AI. Route goals to parallel agents, track artifacts via MCP, and pay only for what you use.',
  icons: { icon: '/favicon.ico' },
};

import ErrorBoundary from '../components/shared/ErrorBoundary';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-[#08090d] text-slate-200 overflow-hidden">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
