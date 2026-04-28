'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, CheckCircle, BarChart2, LogOut, UploadCloud, Menu, X, Terminal } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navigation = [
    { name: 'Home', href: '/dashboard/home', icon: BarChart2 }, // Assuming BarChart2 as placeholder for Home if Home icon is missing
    { name: 'Talk to Nex', href: '/shell', icon: Terminal },
    { name: 'Prospects', href: '/dashboard/leads', icon: Users },
    { name: 'Add Prospects', href: '/dashboard/import', icon: UploadCloud },
    { name: "Nex's Drafts", href: '/dashboard/approvals', icon: CheckCircle },
    { name: 'Outbox', href: '/dashboard/history', icon: CheckCircle },
    { name: 'Insights', href: '/dashboard/analytics', icon: BarChart2 },
    { name: 'Settings', href: '/dashboard/billing', icon: BarChart2 },
  ];

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-bold text-gray-900">Nexus OS</h1>
        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-500 hover:text-gray-900">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out md:static md:translate-x-0 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center px-6 border-b md:border-b-0 border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 hidden md:block">Nexus OS</h1>
          <button onClick={() => setIsOpen(false)} className="md:hidden ml-auto text-gray-500 hover:text-gray-900">
            <X className="h-6 w-6" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`group flex items-center rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 h-5 w-5 flex-shrink-0 ${
                    isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
