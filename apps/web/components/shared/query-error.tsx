import { AlertCircle, RotateCw } from 'lucide-react';
export function QueryError({
  title = 'Unable to load this page',
  message,
  retry,
}: {
  title?: string;
  message: string;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 rounded-xl border border-red-200 bg-white p-5"
    >
      <AlertCircle
        className="shrink-0 text-red-600"
        size={22}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-base">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{message}</p>
      </div>
      <button className="secondary gap-2" onClick={retry}>
        <RotateCw size={15} aria-hidden="true" />
        Retry
      </button>
    </div>
  );
}
