'use client';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useStaffMutation } from './use-staff';
export function ArchiveStaffDialog({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const mutation = useStaffMutation('archive', id);
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!mutation.isPending) {
          setOpen(value);
          mutation.reset();
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className="bg-white text-red-700 ring-1 ring-red-200">
          Archive Staff
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
          <Dialog.Title className="break-words text-xl font-semibold">
            Archive {name}?
          </Dialog.Title>
          <Dialog.Description className="text-sm leading-6 text-slate-600">
            This staff member will be removed from active lists and cannot
            receive new branch assignments. Their historical record and existing
            assignments will be preserved.
          </Dialog.Description>
          {mutation.error && (
            <p role="alert" className="text-sm text-red-700">
              {mutation.error.message}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <button
                disabled={mutation.isPending}
                className="bg-slate-100 text-slate-700"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              disabled={mutation.isPending}
              className="bg-red-700"
              onClick={async () => {
                try {
                  await mutation.mutateAsync({});
                  setOpen(false);
                } catch {}
              }}
            >
              {mutation.isPending ? 'Archiving…' : 'Confirm archive'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
