'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Palette, Users } from 'lucide-react';
import { GymBranding } from '@/features/branding/gym-branding';
import { AccessManagement } from '@/features/access/access-management';

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const currentTab = searchParams.get('tab') === 'access' ? 'access' : 'branding';

  function setTab(tab: 'branding' | 'access') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-8">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-4">
        <button
          type="button"
          onClick={() => setTab('branding')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'branding'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Palette size={16} />
          Gym Brand & Logo
        </button>
        <button
          type="button"
          onClick={() => setTab('access')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
            currentTab === 'access'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Users size={16} />
          Team & Access
        </button>
      </div>

      {/* Tab Content */}
      {currentTab === 'branding' ? <GymBranding /> : <AccessManagement />}
    </div>
  );
}
