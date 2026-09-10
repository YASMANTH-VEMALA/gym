'use client';
import Image from 'next/image';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAdminContext } from '@/features/admin/admin-context';
import { api } from '@/lib/api/auth-api';
import {
  useBusinessQuery,
  useBusinessAction,
  type PageResult,
} from '@/features/product/data';
import { Panel, Picker, Pager, Status, LoadState } from '@/features/product/ui';
interface Credential {
  id: string;
  kind: 'MEMBER' | 'BRANCH';
  memberId: string | null;
  branchId: string | null;
  targetName: string;
  targetStatus: string;
  status: string;
  createdAt: string;
  rotatedAt: string | null;
}
export interface QrImage {
  dataUrl: string;
  url: string;
  id: string;
}
export function QrCard({
  image,
  name,
  close,
  printMessage = 'Scan this QR code at the gym',
}: {
  image: QrImage;
  name: string;
  close: () => void;
  printMessage?: string;
}) {
  const filename = `${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'gym'
  }-qr.png`;
  return (
    <div data-print-qr>
      <Panel title={name}>
        <p className="print-only text-center text-lg font-semibold">{name}</p>
        <Image
          src={image.dataUrl}
          unoptimized
          width={256}
          height={256}
          alt={`QR code for ${name}`}
          className="mx-auto max-w-full"
        />
        <p className="print-only text-center">{printMessage}</p>
        <div className="no-print flex flex-wrap gap-3">
          <a className="button" download={filename} href={image.dataUrl}>
            Download QR
          </a>
          <button onClick={() => window.print()}>Print QR</button>
          <button onClick={close}>Close QR</button>
        </div>
        <p className="no-print text-sm text-slate-500">
          This code is revocable. Keep member cards private. Rotation
          invalidates previously printed copies.
        </p>
      </Panel>
    </div>
  );
}
export function QrPage() {
  const { current, branchId } = useAdminContext();
  const [kind, setKind] = useState<'MEMBER' | 'BRANCH'>('MEMBER');
  const [target, setTarget] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState<{
    image: QrImage;
    name: string;
    kind: Credential['kind'];
  } | null>(null);
  const [confirm, setConfirm] = useState<{
    item: Credential;
    action: 'rotate' | 'revoke';
  } | null>(null);
  const action = useBusinessAction();
  const query = useBusinessQuery<PageResult<Credential>>('qr', {
    kind,
    search,
    page: String(page),
    ...(branchId && kind === 'MEMBER' ? { branchId } : {}),
  });
  const view = useMutation({
    mutationFn: (item: Credential) =>
      api<QrImage>(`/businesses/${current!.businessId}/qr/${item.id}`),
    onSuccess: (image, item) =>
      setShown({ image, name: item.targetName, kind: item.kind }),
  });
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl">QR Management</h1>
        <p className="mt-2 text-sm text-slate-500">
          Secure member cards and branch registration codes.
        </p>
      </header>
      <Panel title="Create QR codes">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setKind('MEMBER');
              setTarget('');
              setPage(1);
              setShown(null);
            }}
            aria-pressed={kind === 'MEMBER'}
          >
            Member QR Cards
          </button>
          <button
            onClick={() => {
              setKind('BRANCH');
              setTarget('');
              setPage(1);
              setShown(null);
            }}
            aria-pressed={kind === 'BRANCH'}
          >
            Branch Registration QR Codes
          </button>
        </div>
        {kind === 'MEMBER' ? (
          <Picker
            resource="members"
            label="Member"
            value={target}
            onChange={setTarget}
          />
        ) : (
          <label>
            QR branch
            <select
              aria-label="QR branch"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
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
        )}
        <button
          disabled={!target || action.isPending}
          onClick={() =>
            action.mutate({ path: 'qr', body: { kind, targetId: target } })
          }
        >
          Generate QR
        </button>
        {kind === 'BRANCH' && (
          <>
            <button
              disabled={action.isPending}
              onClick={() =>
                action.mutate({ path: 'qr/branches/ensure', body: {} })
              }
            >
              Prepare all branch codes
            </button>
            <p className="text-sm text-slate-500">
              Creates stable codes for active branches that have none. Revoked
              codes stay revoked until you explicitly regenerate them.
            </p>
          </>
        )}
        {action.isSuccess && <p role="status">QR credentials updated.</p>}
        {action.error && <p role="alert">{action.error.message}</p>}
      </Panel>
      {shown && (
        <QrCard
          image={shown.image}
          name={shown.name}
          printMessage={
            shown.kind === 'BRANCH'
              ? 'Scan to register with this gym branch'
              : 'Scan to identify this gym member'
          }
          close={() => setShown(null)}
        />
      )}
      {confirm && (
        <Panel title={`Confirm ${confirm.action}`}>
          <p>
            {confirm.action === 'rotate'
              ? 'A new code will replace this code immediately.'
              : 'This code will stop working immediately.'}{' '}
            Previously shared or printed copies for {confirm.item.targetName}{' '}
            will be invalid.
          </p>
          <button
            disabled={action.isPending}
            onClick={() =>
              action.mutate(
                confirm.action === 'rotate'
                  ? {
                      path: 'qr',
                      body: {
                        kind: confirm.item.kind,
                        targetId:
                          confirm.item.memberId || confirm.item.branchId,
                        rotate: true,
                      },
                    }
                  : { path: `qr/${confirm.item.id}/revoke`, body: {} },
                {
                  onSuccess: () => {
                    setConfirm(null);
                    setShown(null);
                  },
                },
              )
            }
          >
            Confirm {confirm.action}
          </button>
          <button onClick={() => setConfirm(null)}>Cancel</button>
          {action.error && <p role="alert">{action.error.message}</p>}
        </Panel>
      )}
      <Panel
        title={
          kind === 'MEMBER' ? 'Member QR Cards' : 'Branch Registration QR Codes'
        }
      >
        {kind === 'BRANCH' && (
          <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            Showing registration QR codes for every branch in this business so
            each printable code remains available here.
          </p>
        )}
        <label>
          Search QR targets
          <input
            value={search}
            maxLength={120}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <LoadState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
        />
        {view.error && <p role="alert">{view.error.message}</p>}
        {query.data && (
          <>
            {!query.data.items.length && (
              <p>No QR credentials yet. Generate a code above.</p>
            )}
            <ul className="divide-y divide-slate-100">
              {query.data.items.map((item) => (
                <li key={item.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3>{item.targetName}</h3>
                    <Status value={item.status} />
                  </div>
                  <p className="text-xs text-slate-500">
                    {item.kind} · Created {item.createdAt.slice(0, 10)} ·
                    Rotated {item.rotatedAt?.slice(0, 10) || 'Never'} · Target{' '}
                    {item.targetStatus.toLowerCase()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.status === 'ACTIVE' &&
                      item.targetStatus === 'ACTIVE' && (
                        <button
                          disabled={view.isPending}
                          onClick={() => view.mutate(item)}
                        >
                          View QR
                        </button>
                      )}
                    {item.targetStatus === 'ACTIVE' && (
                      <button
                        onClick={() => setConfirm({ item, action: 'rotate' })}
                      >
                        {item.status === 'ACTIVE'
                          ? 'Rotate QR'
                          : 'Regenerate QR'}
                      </button>
                    )}
                    {item.status === 'ACTIVE' && (
                      <button
                        onClick={() => setConfirm({ item, action: 'revoke' })}
                      >
                        Revoke QR
                      </button>
                    )}
                  </div>
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
      <Panel title="Check-in integration">
        <p>
          Scan a member QR to verify their profile, then open Attendance to
          check them in at a branch with an active membership.
        </p>
      </Panel>
    </div>
  );
}
