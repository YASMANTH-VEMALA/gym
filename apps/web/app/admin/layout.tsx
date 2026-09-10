import { Suspense, type ReactNode } from 'react';
import { AdminProvider } from '@/features/admin/admin-context';
import { AdminShell } from '@/components/layout/admin-shell';
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <main className="p-8" role="status">
          Loading workspace…
        </main>
      }
    >
      <AdminProvider>
        <AdminShell>{children}</AdminShell>
      </AdminProvider>
    </Suspense>
  );
}
