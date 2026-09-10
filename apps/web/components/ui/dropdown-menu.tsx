'use client';
import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export const DropdownMenuLabel = Menu.Label;
export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof Menu.Content>) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 min-w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-sm text-slate-900 shadow-lg',
          className,
        )}
        {...props}
      />
    </Menu.Portal>
  );
}
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Menu.Item>) {
  return (
    <Menu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
export function DropdownMenuSeparator(
  props: ComponentProps<typeof Menu.Separator>,
) {
  return <Menu.Separator className="my-1 h-px bg-slate-100" {...props} />;
}
