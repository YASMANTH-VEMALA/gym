'use client';
import Link from 'next/link';
import { useState } from 'react';
import { calendarToday } from '@gym/validation';
import {
  FileSpreadsheet,
  ScanLine,
  QrCode,
  UserCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import {
  useBusinessAction,
  useBusinessQuery,
  type PageResult,
} from '@/features/product/data';
import { LoadState, Pager, Panel, Picker } from '@/features/product/ui';
import { cn } from '@/lib/utils';
import { MonthlySheet } from './monthly-sheet';

export interface AttendanceRecord {
  id: string;
  memberId: string;
  attendanceDate: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  status: string;
  member: { fullName: string; memberNumber: string };
  branch: { name: string };
}

export function AttendancePage({
  memberId: profileId,
  initialTab,
}: {
  memberId?: string;
  initialTab?: 'sheet' | 'checkin';
}) {
  const { current, branchId, href } = useAdminContext();
  const [activeTab, setActiveTab] = useState<'sheet' | 'checkin'>(
    profileId ? 'checkin' : initialTab || 'sheet',
  );

  const [memberId, setMember] = useState(profileId || '');
  const [selectedBranch, setBranch] = useState(branchId || '');
  const [page, setPage] = useState(1);
  const [date, setDate] = useState(
    profileId ? '' : calendarToday(current!.business.timezone),
  );
  const [notice, setNotice] = useState('');

  const query = useBusinessQuery<PageResult<AttendanceRecord>>('attendance', {
    page: String(page),
    ...(branchId ? { branchId } : {}),
    ...(profileId ? { memberId: profileId } : {}),
    ...(date ? { date } : {}),
  });

  const action = useBusinessAction();

  async function checkIn() {
    setNotice('');
    try {
      await action.mutateAsync({
        path: 'attendance',
        body: { memberId, branchId: selectedBranch },
      });
      setNotice('Check-in recorded successfully for today.');
      void query.refetch();
    } catch {
      /* Show recoverable mutation error. */
    }
  }

  async function checkOut(recordId: string) {
    try {
      await action.mutateAsync({
        path: `attendance/${recordId}/check-out`,
        body: {},
      });
      void query.refetch();
    } catch {
      /* Recoverable */
    }
  }

  const time = (value: string) =>
    new Date(value).toLocaleTimeString(undefined, {
      timeZone: current!.business.timezone,
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="space-y-5">
      {/* Header & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review monthly records or check in a member.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
          <button
            onClick={() => setActiveTab('sheet')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeTab === 'sheet'
                ? 'bg-blue-50 text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <FileSpreadsheet size={15} />
            <span>Monthly sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={cn(
              'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
              activeTab === 'checkin'
                ? 'bg-blue-50 text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900',
            )}
          >
            <ScanLine size={15} />
            <span>Check-in</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Monthly Tracking Spreadsheet (The Star Feature) */}
      {activeTab === 'sheet' && <MonthlySheet />}

      {/* Tab 2: Quick Check-in & Scanner */}
      {activeTab === 'checkin' && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-1">
            <Panel title="Record Manual Check-in">
              <p className="text-xs text-slate-500">
                Quick check-in for members walking into the gym today.
              </p>
              <fieldset disabled={action.isPending} className="space-y-4">
                {!profileId && (
                  <Picker
                    resource="members"
                    label="Member"
                    value={memberId}
                    onChange={setMember}
                  />
                )}
                <label>
                  Check-in branch
                  <select
                    aria-label="Check-in branch"
                    value={selectedBranch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    <option value="">Select branch</option>
                    {current?.business.branches
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={!memberId || !selectedBranch || action.isPending}
                  onClick={() => void checkIn()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <UserCheck size={15} />
                  <span>
                    {action.isPending ? 'Recording…' : 'Record Check-in'}
                  </span>
                </button>
              </fieldset>
              {notice && (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-800 font-medium"
                >
                  {notice}
                </p>
              )}
              {action.error && (
                <p role="alert" className="error">
                  {action.error.message}
                </p>
              )}
            </Panel>

            <Panel title="QR Code Scanner">
              <p className="text-xs text-slate-500 leading-relaxed">
                Scan a member&apos;s physical or mobile QR pass with any camera
                for instant check-in.
              </p>
              <Link
                className="secondary button w-full"
                href={href('/admin/qr')}
              >
                <QrCode size={15} />
                Open Member QR Passes
              </Link>
            </Panel>
          </div>

          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-slate-800">
                    Attendance Log
                  </h2>
                  <p className="text-xs text-slate-500">
                    Showing daily check-ins with check-out tracking
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setPage(1);
                    }}
                    className="h-8 w-36 text-xs"
                  />
                  <button
                    onClick={() => {
                      setDate('');
                      setPage(1);
                    }}
                    className="secondary h-8 px-2.5 text-xs"
                  >
                    All Dates
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <LoadState
                  pending={query.isPending}
                  error={query.error}
                  retry={query.refetch}
                />
                {query.data && (
                  <>
                    {!query.data.items.length ? (
                      <div className="py-12 text-center text-xs text-slate-400">
                        No check-in records for this date.
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {query.data.items.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between py-3.5"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-slate-800">
                                {a.member.fullName} · {a.member.memberNumber}
                              </p>
                              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                                <span>{a.branch.name}</span>
                                <span>·</span>
                                <span>{a.attendanceDate.slice(0, 10)}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1 text-slate-600">
                                  <Clock size={11} />
                                  In: {time(a.checkedInAt)}
                                </span>
                                {a.checkedOutAt && (
                                  <span className="text-slate-400">
                                    (Out: {time(a.checkedOutAt)})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div>
                              {!a.checkedOutAt ? (
                                <button
                                  onClick={() => void checkOut(a.id)}
                                  className="secondary h-8 px-3 text-[11px] text-slate-600 hover:text-slate-900"
                                >
                                  Check Out
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                                  <CheckCircle2 size={11} />
                                  Completed
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    {query.data.total > query.data.pageSize && (
                      <div className="mt-4 border-t border-slate-100 pt-3">
                        <Pager
                          page={page}
                          total={query.data.total}
                          size={query.data.pageSize}
                          onPage={setPage}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
