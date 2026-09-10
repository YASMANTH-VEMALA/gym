'use client';
import * as Dialog from '@radix-ui/react-dialog';
import type { ComponentProps } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetTitle = Dialog.Title;
export const SheetDescription = Dialog.Description;
export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Dialog.Content>) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/30" />
      <Dialog.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[min(19rem,90vw)] flex-col bg-white shadow-xl outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-3 top-4 rounded-md bg-transparent p-2 text-slate-500 hover:bg-slate-100">
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Close navigation</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
