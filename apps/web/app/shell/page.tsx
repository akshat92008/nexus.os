'use client';

import { TerminalUI } from '@/components/shell/TerminalUI';
import { Sidebar } from '@/components/Sidebar';
import { OnboardingModal } from '@/components/OnboardingModal';

export default function ShellDashboard() {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-50 overflow-hidden">
      <OnboardingModal />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Executive Shell</h1>
            <p className="mt-1 text-sm text-gray-500">
              Command the Nexus OS MasterBrain directly.
            </p>
          </div>
          
          <TerminalUI />
        </div>
      </main>
    </div>
  );
}
