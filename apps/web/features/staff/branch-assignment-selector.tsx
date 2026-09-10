'use client';
import { useController, type Control } from 'react-hook-form';
import type { StaffFormValues } from './staff-schema';
type BranchOption = { id: string; name: string };
export function BranchAssignmentSelector({
  control,
  active,
  retained,
}: {
  control: Control<StaffFormValues>;
  active: BranchOption[];
  retained: BranchOption[];
}) {
  const { field, fieldState } = useController({ name: 'branchIds', control });
  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium">Branch Assignment *</legend>
      <p className="mt-1 text-xs text-slate-500">
        Select one or more active branches in this business.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {active.map((branch, index) => (
          <label
            key={branch.id}
            className="flex-row items-center rounded-lg border border-slate-200 p-3"
          >
            <input
              ref={index === 0 ? field.ref : undefined}
              className="size-4 w-auto"
              type="checkbox"
              checked={field.value.includes(branch.id)}
              onBlur={field.onBlur}
              onChange={(event) =>
                field.onChange(
                  event.target.checked
                    ? [...field.value, branch.id]
                    : field.value.filter((id) => id !== branch.id),
                )
              }
            />
            <span>{branch.name}</span>
          </label>
        ))}
        {retained.map((branch) => (
          <label
            key={branch.id}
            className="flex-row items-center rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-500"
          >
            <input
              className="size-4 w-auto"
              type="checkbox"
              checked
              disabled
              readOnly
            />
            <span>{branch.name} (archived, retained)</span>
          </label>
        ))}
      </div>
      {!active.length && !retained.length && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          Create an active branch before adding staff.
        </p>
      )}
      {fieldState.error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {fieldState.error.message}
        </p>
      )}
    </fieldset>
  );
}
