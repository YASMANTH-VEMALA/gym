'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { calendarToday, formatMoneyMinor } from '@gym/validation';
import { useMemberContext, useMemberQuery } from './member-context';
import { Panel, LoadState, Status, Pager } from '@/features/product/ui';
import type { PageResult } from '@/features/product/data';
import { QrCard, type QrImage } from '@/features/qr/qr-page';
interface Membership {
  id: string;
  planNameSnapshot: string;
  priceMinorSnapshot: number;
  startDate: string;
  endDate: string;
  status: string;
  branch: { name: string };
}
interface Profile {
  member: {
    id: string;
    fullName: string;
    memberNumber: string;
    status: string;
    phone: string;
    email: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    joiningDate: string;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    emergencyContacts: Array<{
      name: string;
      phone: string;
      relationship?: string | null;
    }>;
    profilePhotoDataUrl: string | null;
    fitnessGoal: string | null;
  };
  business: { name: string; currency: string; timezone: string };
  summary: { outstandingMinor: number; paidMinor: number; memberships: number };
  currentMemberships: Membership[];
}
function profileAge(dateOfBirth: string, timezone: string) {
  const today = calendarToday(timezone);
  return Math.max(
    0,
    Number(today.slice(0, 4)) -
      Number(dateOfBirth.slice(0, 4)) -
      (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0),
  );
}
export function MemberHome() {
  const { current, href } = useMemberContext(),
    query = useMemberQuery<Profile>(),
    data = query.data;
  return (
    <>
      <h1 className="text-2xl">Hello, {current.member.fullName}</h1>
      <p className="text-sm text-slate-500">{current.member.memberNumber}</p>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data && (
        <>
          <Panel title="Your balance">
            <p className="text-3xl font-semibold">
              {formatMoneyMinor(
                data.summary.outstandingMinor,
                data.business.currency,
              )}
            </p>
            <p>
              {data.summary.memberships === 0
                ? 'No membership has been assigned yet.'
                : data.summary.outstandingMinor > 0
                  ? 'Payment is due. View the due dates or contact your gym.'
                  : 'All membership fees are paid.'}
            </p>
            <Link className="text-blue-700" href={href('/member/payments')}>
              View payments &amp; dues
            </Link>
          </Panel>
          <Panel title="Current membership">
            {data.currentMemberships.length ? (
              data.currentMemberships.map((m) => (
                <div
                  key={m.id}
                  className="space-y-2 border-b border-slate-100 pb-3"
                >
                  <h3>{m.planNameSnapshot}</h3>
                  <p>{m.branch.name}</p>
                  <p className="text-sm text-slate-500">
                    {m.startDate.slice(0, 10)} to {m.endDate.slice(0, 10)}
                  </p>
                  <Status value="ACTIVE" />
                </div>
              ))
            ) : (
              <p>
                No active membership. Your gym can assign a plan or arrange
                renewal.
              </p>
            )}
            <Link className="text-blue-700" href={href('/member/membership')}>
              Membership history
            </Link>
          </Panel>
          <Panel title="Your gym profile">
            <Status value={data.member.status} />
            <p>
              Your gym maintains your membership and profile details. Contact
              staff for corrections.
            </p>
            <Link className="text-blue-700" href={href('/member/attendance')}>
              Check-in availability
            </Link>
          </Panel>
        </>
      )}
    </>
  );
}
export function MemberProfile() {
  const query = useMemberQuery<Profile>(),
    d = query.data;
  return (
    <>
      <h1 className="text-2xl">My profile</h1>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {d && (
        <Panel title={d.member.fullName}>
          {d.member.profilePhotoDataUrl && (
            <Image
              alt={`${d.member.fullName} profile photo`}
              className="size-24 rounded-full object-cover"
              height={96}
              src={d.member.profilePhotoDataUrl}
              unoptimized
              width={96}
            />
          )}
          <Status value={d.member.status} />
          <dl className="space-y-4">
            {Object.entries({
              'Member number': d.member.memberNumber,
              Mobile: d.member.phone,
              Email: d.member.email,
              Joined: d.member.joiningDate.slice(0, 10),
              'Date of birth / age': d.member.dateOfBirth
                ? `${d.member.dateOfBirth.slice(0, 10)} · ${profileAge(d.member.dateOfBirth, d.business.timezone)} years`
                : null,
              Gender: d.member.gender,
              Address: [
                d.member.addressLine1,
                d.member.addressLine2,
                d.member.city,
                d.member.state,
                d.member.postalCode,
              ]
                .filter(Boolean)
                .join(', '),
              'Emergency contact': [
                d.member.emergencyContacts[0]?.name,
                d.member.emergencyContacts[0]?.phone,
              ]
                .filter(Boolean)
                .join(' · '),
              'Fitness goal': d.member.fitnessGoal,
            }).map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="mt-1 break-words text-sm">
                  {value || 'Not provided'}
                </dd>
              </div>
            ))}
          </dl>
          {d.member.emergencyContacts.length > 1 && (
            <div className="space-y-3">
              <h3>Additional emergency contacts</h3>
              {d.member.emergencyContacts.slice(1).map((contact, index) => (
                <div
                  className="rounded-lg border border-slate-200 p-3 text-sm"
                  key={`${contact.phone}:${index}`}
                >
                  <strong>{contact.name}</strong>
                  <p>{contact.phone}</p>
                  {contact.relationship && (
                    <p className="text-slate-500">{contact.relationship}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-slate-500">
            Contact your gym to update these details. Your sign-in account is
            linked separately from your gym profile.
          </p>
        </Panel>
      )}
    </>
  );
}
export function MemberMemberships() {
  const { current } = useMemberContext(),
    [page, setPage] = useState(1),
    query = useMemberQuery<PageResult<Membership>>('memberships', page);
  return (
    <>
      <h1 className="text-2xl">My memberships</h1>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && (
        <>
          {!query.data.items.length && (
            <Panel title="No memberships yet">
              <p>
                Your gym will assign your membership. Contact staff for plans
                and renewals.
              </p>
            </Panel>
          )}
          {query.data.items.map((m) => (
            <Panel key={m.id} title={m.planNameSnapshot}>
              <Status value={m.status} />
              <p>{m.branch.name}</p>
              <p>
                {m.startDate.slice(0, 10)} to {m.endDate.slice(0, 10)}
              </p>
              <p>
                Agreed fee:{' '}
                {formatMoneyMinor(
                  m.priceMinorSnapshot,
                  current.business.currency,
                )}
              </p>
            </Panel>
          ))}
          <Pager
            page={page}
            total={query.data.total}
            size={query.data.pageSize}
            onPage={setPage}
          />
        </>
      )}
    </>
  );
}
interface Due {
  id: string;
  planNameSnapshot: string;
  branchName: string;
  originalAmountMinor: number;
  paidMinor: number;
  outstandingMinor: number;
  dueDate: string;
  promiseToPayDate: string | null;
  status: string;
}
interface Payment {
  id: string;
  amountMinor: number;
  method: string;
  reference: string | null;
  paidAt: string;
  status: string;
  receivable: {
    membership: { planNameSnapshot: string; branch: { name: string } };
  };
}
export function MemberPayments() {
  const { current } = useMemberContext(),
    [page, setPage] = useState(1),
    [historyPage, setHistory] = useState(1),
    dues = useMemberQuery<PageResult<Due>>('dues', page),
    payments = useMemberQuery<PageResult<Payment>>('payments', historyPage),
    money = (v: number) => formatMoneyMinor(v, current.business.currency);
  return (
    <>
      <h1 className="text-2xl">Payments &amp; dues</h1>
      <p className="text-sm text-slate-500">
        Payments are recorded by your gym. Contact staff to pay or discuss a
        promise-to-pay date.
      </p>
      <LoadState
        pending={dues.isPending}
        error={dues.error}
        retry={dues.refetch}
      />
      {dues.data && (
        <>
          {!dues.data.items.length && (
            <Panel title="No membership dues">
              <p>No financial obligation has been created for your profile.</p>
            </Panel>
          )}
          {dues.data.items.map((d) => (
            <Panel key={d.id} title={d.planNameSnapshot}>
              <Status value={d.status} />
              <p>{d.branchName}</p>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries({
                  'Agreed fee': money(d.originalAmountMinor),
                  Paid: money(d.paidMinor),
                  Outstanding: money(d.outstandingMinor),
                  'Original due': d.dueDate.slice(0, 10),
                  'Promise-to-pay': d.promiseToPayDate?.slice(0, 10) || 'None',
                }).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
          <Pager
            page={page}
            total={dues.data.total}
            size={dues.data.pageSize}
            onPage={setPage}
          />
        </>
      )}
      <Panel title="Payment history">
        <LoadState
          pending={payments.isPending}
          error={payments.error}
          retry={payments.refetch}
        />
        {payments.data && (
          <>
            {!payments.data.items.length && <p>No payments recorded.</p>}
            <ul className="divide-y divide-slate-100">
              {payments.data.items.map((p) => (
                <li key={p.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{money(p.amountMinor)}</strong>
                    <Status value={p.status} />
                  </div>
                  <p className="text-sm">
                    {p.paidAt.slice(0, 10)} · {p.method.replaceAll('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.receivable.membership.planNameSnapshot} ·{' '}
                    {p.receivable.membership.branch.name}
                  </p>
                  {p.reference && (
                    <p className="break-words text-sm">
                      Reference: {p.reference}
                    </p>
                  )}
                  {p.status === 'VOID' && (
                    <p className="text-xs text-slate-500">
                      This record was voided and does not count toward your paid
                      balance.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Pager
              page={historyPage}
              total={payments.data.total}
              size={payments.data.pageSize}
              onPage={setHistory}
            />
          </>
        )}
      </Panel>
    </>
  );
}
export function MemberQr() {
  const { current } = useMemberContext(),
    query = useMemberQuery<QrImage | null>('qr'),
    [hidden, setHidden] = useState(false);
  return (
    <>
      <h1 className="text-2xl">My QR card</h1>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.isSuccess &&
        (query.data ? (
          hidden ? (
            <button onClick={() => setHidden(false)}>Show my QR</button>
          ) : (
            <QrCard
              image={query.data}
              name={current.member.fullName}
              close={() => setHidden(true)}
            />
          )
        ) : (
          <Panel title="QR card unavailable">
            <p>Ask your gym to issue an active member QR card.</p>
          </Panel>
        ))}
      <p className="text-sm text-slate-500">
        Show this card to authorized gym staff. Staff can record your check-in
        when you have an active membership.
      </p>
    </>
  );
}
export function MemberAttendance() {
  const [page, setPage] = useState(1),
    { current } = useMemberContext(),
    query = useMemberQuery<
      PageResult<{
        id: string;
        attendanceDate: string;
        checkedInAt: string;
        checkedOutAt: string | null;
        branch: { name: string };
      }>
    >('attendance', page);
  return (
    <>
      <h1 className="text-2xl">My attendance</h1>
      <p>Show your member card to gym staff to check in.</p>
      <LoadState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data && (
        <Panel title="Attendance history">
          {!query.data.items.length && <p>No attendance records yet.</p>}
          {query.data.items.map((a) => (
            <div key={a.id} className="space-y-2 border-b py-3">
              <p>
                {a.branch.name} ? {a.attendanceDate.slice(0, 10)}
              </p>
              <p>
                In:{' '}
                {new Date(a.checkedInAt).toLocaleString(undefined, {
                  timeZone: current.business.timezone,
                })}
              </p>
              {a.checkedOutAt && (
                <p>
                  Out:{' '}
                  {new Date(a.checkedOutAt).toLocaleString(undefined, {
                    timeZone: current.business.timezone,
                  })}
                </p>
              )}
            </div>
          ))}
          <Pager
            page={page}
            total={query.data.total}
            size={query.data.pageSize}
            onPage={setPage}
          />
        </Panel>
      )}
    </>
  );
}
