'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import type { MonthlyMatrixResponse } from '@gym/types';
import { api } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
import { cn } from '@/lib/utils';
import { GoogleSheetsModal } from './google-sheets-modal';

export function MonthlySheet() {
  const queryClient = useQueryClient();
  const {
    current,
    branchId,
    isBranchLocked,
    assignedBranchName,
    selectBranch,
  } = useAdminContext();
  const businessId = current?.businessId;

  // Selected date state
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [googleSheetsOpen, setGoogleSheetsOpen] = useState(false);
  const [activeCellPopover, setActiveCellPopover] = useState<{
    memberId: string;
    date: string;
  } | null>(null);

  // Active branch
  const activeBranchId =
    branchId ||
    current?.assignedBranchId ||
    current?.business.branches[0]?.id ||
    '';

  const matrixQueryKey = [
    'monthly-matrix',
    businessId,
    activeBranchId,
    year,
    month,
    search,
  ];

  const { data, isPending, error, refetch } = useQuery<MonthlyMatrixResponse>({
    queryKey: matrixQueryKey,
    queryFn: () => {
      const q = new URLSearchParams({
        branchId: activeBranchId,
        year: String(year),
        month: String(month),
        ...(search ? { search } : {}),
      });
      return api<MonthlyMatrixResponse>(
        `/businesses/${businessId}/attendance/monthly-matrix?${q}`,
      );
    },
    enabled: !!businessId && !!activeBranchId,
  });

  // In-place matrix cell mutation
  const cellMutation = useMutation({
    mutationFn: (vars: {
      memberId: string;
      branchId: string;
      date: string;
      status: 'PRESENT' | 'ABSENT' | 'REST' | 'CLEAR';
    }) => api('/attendance/matrix-cell', vars),
    onMutate: async (newCell) => {
      await queryClient.cancelQueries({ queryKey: matrixQueryKey });
      const previous =
        queryClient.getQueryData<MonthlyMatrixResponse>(matrixQueryKey);

      if (previous) {
        queryClient.setQueryData<MonthlyMatrixResponse>(matrixQueryKey, {
          ...previous,
          members: previous.members.map((m) => {
            if (m.memberId !== newCell.memberId) return m;
            const updatedAtt = { ...m.attendance };
            if (newCell.status === 'CLEAR') {
              delete updatedAtt[newCell.date];
            } else {
              updatedAtt[newCell.date] = newCell.status;
            }
            return {
              ...m,
              attendance: updatedAtt,
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(matrixQueryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: matrixQueryKey });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', businessId],
      });
    },
  });

  // Mark all today mutation
  const markAllMutation = useMutation({
    mutationFn: () =>
      api('/attendance/mark-all-today', { branchId: activeBranchId }),
    onSuccess: () => {
      void refetch();
      void queryClient.invalidateQueries({
        queryKey: ['dashboard', businessId],
      });
    },
  });

  // Horizontal scroll ref to scroll to today
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  function scrollToToday() {
    if (!scrollContainerRef.current) return;
    const todayCol = scrollContainerRef.current.querySelector(
      '[data-is-today="true"]',
    );
    if (todayCol) {
      todayCol.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }

  function goToCurrentMonth() {
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    if (year === today.getFullYear() && month === today.getMonth() + 1) {
      scrollToToday();
    }
  }

  // Month navigation handlers
  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const selectedMonth = `${year}-${String(month).padStart(2, '0')}`;
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  function handleCellClick(
    memberId: string,
    date: string,
    currentStatus?: string,
  ) {
    // Quick cycling: undefined/REST -> PRESENT -> ABSENT -> CLEAR
    let nextStatus: 'PRESENT' | 'ABSENT' | 'REST' | 'CLEAR' = 'PRESENT';
    if (currentStatus === 'PRESENT') nextStatus = 'ABSENT';
    else if (currentStatus === 'ABSENT') nextStatus = 'CLEAR';
    else nextStatus = 'PRESENT';

    cellMutation.mutate({
      memberId,
      branchId: activeBranchId,
      date,
      status: nextStatus,
    });
  }

  function setExplicitStatus(
    memberId: string,
    date: string,
    status: 'PRESENT' | 'ABSENT' | 'REST' | 'CLEAR',
  ) {
    setActiveCellPopover(null);
    cellMutation.mutate({
      memberId,
      branchId: activeBranchId,
      date,
      status,
    });
  }

  return (
    <div className="space-y-4">
      {/* Top Header Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 text-xs">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <label className="gap-0">
              <span className="sr-only">Attendance month</span>
              <input
                aria-label="Attendance month"
                type="month"
                max={currentMonth}
                value={selectedMonth}
                onChange={(event) => {
                  const [nextYear, nextMonthValue] = event.target.value
                    .split('-')
                    .map(Number);
                  if (nextYear && nextMonthValue) {
                    setYear(nextYear);
                    setMonth(nextMonthValue);
                  }
                }}
                className="h-8 w-36 border-0 bg-transparent px-2 py-1 text-xs font-semibold shadow-none focus:ring-0"
              />
            </label>
            <button
              onClick={nextMonth}
              disabled={selectedMonth >= currentMonth}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={goToCurrentMonth}
            className="secondary flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg"
          >
            <Calendar size={14} className="text-blue-600" />
            This month
          </button>

          {/* Branch selector if not locked */}
          {!isBranchLocked &&
            current &&
            current.business.branches.length > 1 && (
              <div className="relative">
                <select
                  value={activeBranchId}
                  onChange={(e) => selectBranch(e.target.value)}
                  aria-label="Filter branch"
                  className="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-1 pr-7 text-xs font-semibold text-slate-700 shadow-2xs"
                >
                  {current.business.branches
                    .filter((b) => b.status === 'ACTIVE')
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

          {isBranchLocked && assignedBranchName && (
            <div className="flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-900">
              <Building2 size={13} className="text-purple-700" />
              <span>{assignedBranchName}</span>
            </div>
          )}
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search input */}
          <div className="relative w-40 sm:w-52">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-2.5 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs"
            />
          </div>

          {/* Quick Mark All Today */}
          <button
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
            className="secondary flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200"
          >
            <CheckCircle2 size={14} className="text-emerald-600" />
            {markAllMutation.isPending ? 'Marking…' : 'Mark today present'}
          </button>

          {/* Google Sheets Sync Button */}
          <button
            onClick={() => setGoogleSheetsOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-semibold rounded-lg shadow-2xs transition-all"
          >
            <FileSpreadsheet size={14} />
            <span>Google Sheets</span>
          </button>
        </div>
      </div>

      {/* Legend & Guide Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-2 text-xs text-slate-600 shadow-2xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-700">Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-4 items-center justify-center rounded-sm bg-emerald-500 text-[10px] font-bold text-white shadow-2xs">
              ✓
            </span>
            <span className="font-medium text-slate-700">
              Present (Click to toggle)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-4 items-center justify-center rounded-sm bg-rose-500 text-[10px] font-bold text-white shadow-2xs">
              ✕
            </span>
            <span className="font-medium text-slate-700">Absent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex size-4 items-center justify-center rounded-sm bg-slate-200 text-[10px] font-bold text-slate-600">
              -
            </span>
            <span className="font-medium text-slate-500">Unmarked</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-slate-500">
          <span>
            Total Active:{' '}
            <strong className="text-slate-800">
              {data?.totalActiveMembers ?? 0}
            </strong>
          </span>
          <span>·</span>
          <span>
            Avg Daily:{' '}
            <strong className="text-slate-800">
              {data?.averageDailyCheckins ?? 0}
            </strong>{' '}
            check-ins
          </span>
        </div>
      </div>

      {/* Main Interactive Spreadsheet Grid */}
      <div className="relative rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {isPending && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw size={28} className="animate-spin text-blue-600 mb-3" />
            <p className="text-xs font-medium">
              Loading monthly attendance grid…
            </p>
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <AlertCircle size={28} className="mx-auto text-rose-500 mb-2" />
            <p className="text-xs text-rose-700">{error.message}</p>
            <button
              onClick={() => void refetch()}
              className="mt-3 button text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <div
            ref={scrollContainerRef}
            className="sheet-scroll max-h-[72vh] overflow-x-auto overflow-y-auto"
          >
            <table className="w-full border-collapse text-[11px] select-none">
              {/* Table Header */}
              <thead className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-xs shadow-xs">
                <tr>
                  {/* Pinned Left Columns */}
                  <th className="sticky left-0 z-40 bg-slate-100 px-3 py-2.5 text-center font-bold text-slate-500 border-r border-b border-slate-200 w-12 min-w-12">
                    #
                  </th>
                  <th className="sticky left-12 z-40 bg-slate-100 px-3 py-2.5 text-left font-bold text-slate-700 border-r border-b border-slate-200 min-w-[200px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    Member Name & ID
                  </th>

                  {/* Calendar Days Columns (1..31) */}
                  {data.days.map((d) => (
                    <th
                      key={d.date}
                      data-is-today={d.isToday}
                      className={cn(
                        'px-1 py-1.5 text-center font-semibold border-r border-b border-slate-200 min-w-[38px] max-w-[42px] transition-colors',
                        d.isToday
                          ? 'bg-blue-100/80 text-blue-900 ring-2 ring-blue-500 ring-inset'
                          : d.isSunday
                            ? 'bg-rose-50/70 text-rose-700'
                            : 'text-slate-700',
                      )}
                    >
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[10px] font-bold">
                          {d.dayNumber}
                        </span>
                        <span className="text-[9px] uppercase tracking-tighter opacity-70">
                          {d.dayOfWeek}
                        </span>
                        {d.isToday && (
                          <span className="mt-0.5 size-1.5 rounded-full bg-blue-600 animate-pulse" />
                        )}
                      </div>
                    </th>
                  ))}

                  {/* Pinned Right Summary Columns */}
                  <th className="sticky right-36 z-40 bg-slate-100 px-2 py-2.5 text-center font-bold text-slate-700 border-r border-b border-slate-200 min-w-[50px] shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                    Present
                  </th>
                  <th className="sticky right-24 z-40 bg-slate-100 px-2 py-2.5 text-center font-bold text-slate-700 border-r border-b border-slate-200 min-w-[50px]">
                    Absent
                  </th>
                  <th className="sticky right-12 z-40 bg-slate-100 px-2 py-2.5 text-center font-bold text-slate-700 border-r border-b border-slate-200 min-w-[50px]">
                    Rate
                  </th>
                  <th className="sticky right-0 z-40 bg-slate-100 px-3 py-2.5 text-left font-bold text-slate-700 border-b border-slate-200 min-w-[110px]">
                    Fee Status
                  </th>
                </tr>
              </thead>

              {/* Table Body Rows */}
              <tbody className="divide-y divide-slate-100 font-mono">
                {data.members.length === 0 && (
                  <tr>
                    <td
                      colSpan={data.days.length + 6}
                      className="py-12 text-center text-xs text-slate-400 font-sans"
                    >
                      No members found for this branch and filter.
                    </td>
                  </tr>
                )}

                {data.members.map((member, idx) => (
                  <tr
                    key={member.memberId}
                    className="hover:bg-blue-50/30 transition-colors group"
                  >
                    {/* Index */}
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-blue-50/40 px-2 py-2 text-center text-[10px] text-slate-400 border-r border-slate-100">
                      {idx + 1}
                    </td>

                    {/* Member Name, ID, Phone */}
                    <td className="sticky left-12 z-20 bg-white group-hover:bg-blue-50/40 px-3 py-2 border-r border-slate-100 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] font-sans">
                      <div className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                          {member.fullName.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {member.fullName}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {member.memberNumber} · {member.phone}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Day Cells (Interactive In-place edit) */}
                    {data.days.map((d) => {
                      const status = member.attendance[d.date];
                      const isToday = d.isToday;
                      return (
                        <td
                          key={d.date}
                          onClick={() =>
                            handleCellClick(member.memberId, d.date, status)
                          }
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveCellPopover({
                              memberId: member.memberId,
                              date: d.date,
                            });
                          }}
                          className={cn(
                            'p-0.5 text-center border-r border-slate-100 cursor-pointer transition-all hover:ring-2 hover:ring-blue-400 hover:ring-inset hover:z-10',
                            isToday && 'bg-blue-50/30',
                          )}
                          title={`${member.fullName} on ${d.date}: ${status || 'Unmarked'} (Click to toggle, right-click for options)`}
                        >
                          <div
                            className={cn(
                              'mx-auto flex size-7 items-center justify-center rounded-md text-[10px] font-bold transition-transform active:scale-90',
                              status === 'PRESENT'
                                ? 'bg-emerald-500 text-white shadow-2xs font-semibold'
                                : status === 'ABSENT'
                                  ? 'bg-rose-500 text-white shadow-2xs'
                                  : status === 'REST'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'text-slate-300 hover:bg-slate-100 hover:text-slate-600',
                            )}
                          >
                            {status === 'PRESENT' ? (
                              <Check size={13} strokeWidth={2.8} />
                            ) : status === 'ABSENT' ? (
                              <X size={13} strokeWidth={2.8} />
                            ) : status === 'REST' ? (
                              'R'
                            ) : (
                              '·'
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Right Summary Columns */}
                    <td className="sticky right-36 z-20 bg-white group-hover:bg-blue-50/40 px-2 py-2 text-center text-xs font-bold text-emerald-700 border-r border-slate-100 shadow-[-2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                      {member.totalPresent}d
                    </td>
                    <td className="sticky right-24 z-20 bg-white group-hover:bg-blue-50/40 px-2 py-2 text-center text-xs font-bold text-rose-600 border-r border-slate-100">
                      {member.totalAbsent}d
                    </td>
                    <td className="sticky right-12 z-20 bg-white group-hover:bg-blue-50/40 px-2 py-2 text-center text-[10px] font-bold text-slate-700 border-r border-slate-100">
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5',
                          member.attendanceRate >= 75
                            ? 'bg-emerald-50 text-emerald-800'
                            : member.attendanceRate >= 50
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-rose-50 text-rose-700',
                        )}
                      >
                        {member.attendanceRate}%
                      </span>
                    </td>
                    <td className="sticky right-0 z-20 bg-white group-hover:bg-blue-50/40 px-3 py-2 font-sans">
                      {member.feeStatus.status === 'PAID' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          <Wallet size={10} />
                          Paid (Cash)
                        </span>
                      ) : member.feeStatus.status === 'DUE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200/80 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          Due ₹{member.feeStatus.outstandingMinor / 100}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          No Plan
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Sticky Bottom Total Row */}
              <tfoot className="sticky bottom-0 z-30 bg-slate-100/95 backdrop-blur-xs font-bold border-t-2 border-slate-300">
                <tr>
                  <td
                    colSpan={2}
                    className="sticky left-0 z-40 bg-slate-100 px-4 py-2.5 text-xs text-slate-800 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] font-sans"
                  >
                    Daily Check-in Totals:
                  </td>
                  {data.days.map((d) => {
                    const total = data.dailyTotals[d.date] || 0;
                    return (
                      <td
                        key={d.date}
                        className={cn(
                          'px-1 py-2 text-center text-[10px] border-r border-slate-200',
                          total > 0
                            ? 'font-bold text-blue-700 bg-blue-50/60'
                            : 'text-slate-400',
                        )}
                      >
                        {total > 0 ? total : '0'}
                      </td>
                    );
                  })}
                  <td
                    colSpan={4}
                    className="sticky right-0 z-40 bg-slate-100 px-3 py-2 text-xs text-slate-700 font-sans"
                  >
                    Gym Floor Totals
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Micro-Popover Context Menu for precise cell status */}
      {activeCellPopover && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          onClick={() => setActiveCellPopover(null)}
        >
          <div
            className="w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
              Mark Attendance ({activeCellPopover.date})
            </p>
            <div className="space-y-1">
              <button
                onClick={() =>
                  setExplicitStatus(
                    activeCellPopover.memberId,
                    activeCellPopover.date,
                    'PRESENT',
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                <Check size={14} className="text-emerald-600" />
                Present
              </button>
              <button
                onClick={() =>
                  setExplicitStatus(
                    activeCellPopover.memberId,
                    activeCellPopover.date,
                    'ABSENT',
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                <X size={14} className="text-rose-600" />
                Absent
              </button>
              <button
                onClick={() =>
                  setExplicitStatus(
                    activeCellPopover.memberId,
                    activeCellPopover.date,
                    'REST',
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50"
              >
                <span>R</span>
                Rest Day
              </button>
              <button
                onClick={() =>
                  setExplicitStatus(
                    activeCellPopover.memberId,
                    activeCellPopover.date,
                    'CLEAR',
                  )
                }
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Sheets Modal */}
      {data && (
        <GoogleSheetsModal
          isOpen={googleSheetsOpen}
          onClose={() => setGoogleSheetsOpen(false)}
          businessId={businessId!}
          branchId={activeBranchId}
          branchName={data.branch.name}
          year={year}
          month={month}
          monthName={data.monthName}
        />
      )}
    </div>
  );
}
