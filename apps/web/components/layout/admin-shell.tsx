'use client';
import { Fragment, useState, type ReactNode } from 'react';
import { Menu } from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryError } from '@/components/shared/query-error';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
export function AdminShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const {
    current,
    branchId,
    businesses,
    pending,
    error,
    invalidBusiness,
    retry,
    selectBusiness,
  } = useAdminContext();
  return (
    <div className="min-h-screen bg-[#f6f6f4] text-slate-900">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[70] focus:rounded-md focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <AdminSidebar />
      </aside>
      <div className="min-w-0 lg:pl-60">
        <Sheet open={open} onOpenChange={setOpen}>
          <AdminTopbar
            mobileTrigger={
              <SheetTrigger asChild>
                <button
                  className="rounded-md bg-transparent p-1.5 text-slate-600 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={21} aria-hidden="true" />
                </button>
              </SheetTrigger>
            }
          />
          <SheetContent>
            <SheetTitle className="sr-only">Gym navigation</SheetTitle>
            <SheetDescription className="sr-only">
              Navigate your gym workspace.
            </SheetDescription>
            <AdminSidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main
          id="admin-content"
          tabIndex={-1}
          className="mx-auto max-w-[1440px] p-4 outline-none sm:p-7 xl:p-8"
        >
          {pending ? (
            <div
              role="status"
              aria-label="Loading workspace"
              className="space-y-6"
            >
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : error ? (
            <QueryError message={error.message} retry={retry} />
          ) : invalidBusiness ? (
            <QueryError
              title="Business unavailable"
              message="Choose a business you have access to."
              retry={() => selectBusiness(businesses[0]!.businessId)}
            />
          ) : current ? (
            <Fragment key={`${current.businessId}:${branchId || 'all'}`}>
              {children}
            </Fragment>
          ) : (
            <p role="status" className="muted">
              Taking you to business setup…
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
