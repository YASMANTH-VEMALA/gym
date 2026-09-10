'use client';
import { useController, type Control } from 'react-hook-form';
import type { PlanFormValues } from './plan-schema';
type BranchOption = { id: string; name: string; status: 'ACTIVE' | 'ARCHIVED' };
export function BranchApplicabilitySelector({
  control,
  branches,
  retained,
}: {
  control: Control<PlanFormValues>;
  branches: BranchOption[];
  retained: string[];
}) {
  const all = useController({ name: 'appliesToAllBranches', control });
  const selected = useController({ name: 'branchIds', control });
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Branch availability
      </legend>
      <label className="flex-row items-center">
        <input
          className="size-4 w-auto"
          type="radio"
          name="applicability"
          checked={all.field.value}
          onChange={() => all.field.onChange(true)}
        />
        All active branches
      </label>
      <label className="flex-row items-center">
        <input
          className="size-4 w-auto"
          type="radio"
          name="applicability"
          checked={!all.field.value}
          onChange={() => all.field.onChange(false)}
        />
        Selected branches
      </label>
      {all.field.value ? (
        <p className="text-xs text-slate-500">
          New active branches will automatically be included.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {branches
              .filter(
                (branch) =>
                  branch.status === 'ACTIVE' || retained.includes(branch.id),
              )
              .map((branch) => (
                <label
                  className="flex-row items-center rounded-lg border border-slate-200 p-3"
                  key={branch.id}
                >
                  <input
                    className="size-4 w-auto"
                    type="checkbox"
                    disabled={branch.status === 'ARCHIVED'}
                    checked={selected.field.value.includes(branch.id)}
                    onChange={(event) =>
                      selected.field.onChange(
                        event.target.checked
                          ? [...selected.field.value, branch.id]
                          : selected.field.value.filter(
                              (id) => id !== branch.id,
                            ),
                      )
                    }
                  />
                  <span>
                    {branch.name}
                    {branch.status === 'ARCHIVED'
                      ? ' (archived, retained)'
                      : ''}
                  </span>
                </label>
              ))}
          </div>
          {selected.fieldState.error && (
            <p role="alert" className="text-xs text-red-700">
              {selected.fieldState.error.message}
            </p>
          )}
        </>
      )}
    </fieldset>
  );
}
