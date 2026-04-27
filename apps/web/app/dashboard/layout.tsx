import { Sidebar } from '@/components/Sidebar';
import { OnboardingModal } from '@/components/OnboardingModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-gray-50 overflow-hidden">
      <OnboardingModal />
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}
