'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, type BusinessAccess } from '@/lib/api/auth-api';
import { browserAuth } from '@/lib/supabase/client';
import { useFragmentCredential, memberQrStorage } from '@/features/qr/fragment';
import { AuthPanel } from '@/components/auth-panel';
export default function Page() {
  const { token, ready, clear } = useFragmentCredential(memberQrStorage);
  const [business, setBusiness] = useState('');
  const [branch, setBranch] = useState('');
  const session = useQuery({
    queryKey: ['scanner-session'],
    queryFn: async () => {
      const { data } = await browserAuth().auth.getSession();
      return !!data.session;
    },
  });
  const access = useQuery({
    queryKey: ['scanner-access'],
    enabled: session.data === true,
    queryFn: () => api<BusinessAccess[]>('/me/businesses'),
  });
  const result = useMutation({
    mutationFn: () =>
      api<{
        member: { id: string; fullName: string; memberNumber: string };
        attendance: { attendanceDate: string; checkedInAt: string };
      }>(`/businesses/${business}/qr/check-in/member`, {
        token,
        branchId: branch,
      }),
    onSuccess: clear,
  });
  return (
    <AuthPanel
      title="Member QR"
      description="Authorized gym staff can resolve this card."
    >
      {!ready || session.isPending ? (
        <p>Loading…</p>
      ) : !session.data ? (
        <Link className="button" href="/sign-in?next=%2Fq%2Fmember">
          Staff sign in
        </Link>
      ) : result.data ? (
        <>
          <h2>{result.data.member.fullName}</h2>
          <p>{result.data.member.memberNumber}</p>
          <p>
            Attendance recorded for{' '}
            {result.data.attendance.attendanceDate.slice(0, 10)}. Scanning again
            today safely returns the same check-in.
          </p>
          <Link
            className="button"
            href={`/admin/members/${result.data.member.id}?businessId=${business}`}
          >
            Open member
          </Link>
        </>
      ) : !token ? (
        <p>No member QR is available. Scan the card again.</p>
      ) : (
        <>
          <label>
            Business
            <select
              aria-label="Business"
              value={business}
              onChange={(e) => {
                setBusiness(e.target.value);
                setBranch('');
              }}
            >
              <option value="">Select authorized business</option>
              {access.data?.map((a) => (
                <option key={a.businessId} value={a.businessId}>
                  {a.business.name}
                </option>
              ))}
            </select>
          </label>
          {access.data?.length === 0 && (
            <p>
              This account has no staff access. Ask your gym’s Owner or Admin to
              scan your card.
            </p>
          )}
          {business && (
            <label>
              Check-in branch
              <select
                aria-label="Check-in branch"
                value={branch}
                onChange={(event) => setBranch(event.target.value)}
              >
                <option value="">Select branch</option>
                {access.data
                  ?.find((item) => item.businessId === business)
                  ?.business.branches.filter((item) => item.status === 'ACTIVE')
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <button
            disabled={!business || !branch || result.isPending}
            onClick={() => result.mutate()}
          >
            Verify &amp; check in
          </button>
          {(access.error || result.error) && (
            <p role="alert">{access.error?.message || result.error?.message}</p>
          )}
          <button onClick={clear}>Cancel scan</button>
        </>
      )}
    </AuthPanel>
  );
}
