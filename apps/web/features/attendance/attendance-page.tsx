'use client';
import Link from 'next/link';
import { useState } from 'react';
import { calendarToday } from '@gym/validation';
import { useAdminContext } from '@/features/admin/admin-context';
import {
  useBusinessAction,
  useBusinessQuery,
  type PageResult,
} from '@/features/product/data';
import { LoadState, Pager, Panel, Picker } from '@/features/product/ui';
export interface AttendanceRecord {
  id: string;
  memberId: string;
  attendanceDate: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  member: { fullName: string; memberNumber: string };
  branch: { name: string };
}
export function AttendancePage({ memberId: profileId }: { memberId?: string }) {
  const { current, branchId, href } = useAdminContext();
  const [memberId, setMember] = useState(profileId || ''),
    [selectedBranch, setBranch] = useState(branchId || ''),
    [page, setPage] = useState(1),
    [date, setDate] = useState(
      profileId ? '' : calendarToday(current!.business.timezone),
    ),
    [notice, setNotice] = useState('');
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
      setNotice(
        'Check-in recorded. A member has one attendance record per branch per day.',
      );
    } catch {
      /* Show recoverable mutation error. */
    }
  }
  const time = (value: string) =>
    new Date(value).toLocaleString(undefined, {
      timeZone: current!.business.timezone,
    });
  return (
    <div className="space-y-5">
      <h1 className="text-2xl">Attendance</h1>
      <Panel title="QR check-in">
        <p className="text-sm text-slate-500">
          Scan a member&apos;s QR card with any phone camera. Authorized staff
          choose the branch and confirm; attendance is recorded immediately.
        </p>
        <Link className="button" href={href('/admin/qr')}>
          Open member QR cards
        </Link>
      </Panel>
      <Panel title="Record check-in">
        <p className="text-sm text-slate-500">
          An active membership at the selected branch is required. Attendance
          dates use the branch timezone.
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
          >
            Check in
          </button>
        </fieldset>
        {notice && <p role="status">{notice}</p>}
        {action.error && (
          <p role="alert" className="text-red-700">
            {action.error.message}
          </p>
        )}
      </Panel>
      <Panel title="Attendance history">
        <label>
          Attendance date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button
          onClick={() => {
            setDate('');
            setPage(1);
          }}
        >
          All dates
        </button>
        <LoadState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
        />
        {query.data && (
          <>
            {!query.data.items.length && <p>No attendance records yet.</p>}
            <ul className="divide-y divide-slate-100">
              {query.data.items.map((a) => (
                <li key={a.id} className="space-y-2 py-4">
                  <p className="font-medium">
                    {a.member.fullName} · {a.member.memberNumber}
                  </p>
                  <p>
                    {a.branch.name} · {a.attendanceDate.slice(0, 10)}
                  </p>
                  <p className="text-sm">
                    In: {time(a.checkedInAt)}
                    {a.checkedOutAt ? ` · Out: ${time(a.checkedOutAt)}` : ''}
                  </p>
                  {!a.checkedOutAt && (
                    <button
                      disabled={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: `attendance/${a.id}/check-out`,
                          body: {},
                        })
                      }
                    >
                      Check out
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              total={query.data.total}
              size={query.data.pageSize}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
