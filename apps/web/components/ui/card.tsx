import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-xs',
        className,
      )}
      {...props}
    />
  );
}
