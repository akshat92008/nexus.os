'use client';

/**
 * Nexus OS — Error Boundary v2.1 (Stabilized)
 *
 * Provides graceful recovery UI for component crashes.
 * Supports custom fallback components and labeled reporting.
 */

import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label shown in the error card — helps identify which view crashed */
  label?: string;
  /** Optional custom fallback instead of the default error card */
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Standard error logging (to be wired to Sentry/LogFlare later)
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[220px] p-10 rounded-3xl border border-zinc-800 bg-zinc-950/50 text-center gap-5 backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4M12 17h.01" stroke="#f87171" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="12" cy="12" r="9" stroke="#f87171" strokeWidth="2"/>
          </svg>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-zinc-100 font-bold text-base">
            {this.props.label ? `${this.props.label} Crashed` : 'Something went wrong'}
          </h3>
          <p className="text-zinc-500 text-sm max-w-[280px] leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred in this view. The system state remains stable.'}
          </p>
        </div>
        <button
          onClick={this.handleReset}
          className="mt-2 px-6 py-2 rounded-xl bg-zinc-800 text-zinc-100 text-sm font-bold hover:bg-zinc-700 transition-all border border-zinc-700 shadow-lg"
        >
          Restore View
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
