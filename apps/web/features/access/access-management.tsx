'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, type Invitation } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';
export function AccessManagement() {
  const cache = useQueryClient();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { current } = useAdminContext();
  const businessId = current?.businessId;
  const team = useQuery({
    queryKey: ['team', businessId],
    queryFn: () =>
      api<{ userId: string; role: string; email: string | null }[]>(
        `/businesses/${businessId}/access`,
      ),
    enabled: current?.role === 'OWNER',
    retry: false,
  });
  const [removing, setRemoving] = useState<string | null>(null);
  const invitations = useQuery({
    queryKey: ['invitations', businessId],
    queryFn: () => api<Invitation[]>(`/businesses/${businessId}/invitations`),
    enabled: current?.role === 'OWNER',
    retry: false,
  });
  async function action(path: string, body: unknown) {
    setBusy(true);
    setMessage('');
    try {
      await api(path, body);
      await cache.invalidateQueries({ queryKey: ['invitations'] });
      await cache.invalidateQueries({ queryKey: ['team', businessId] });
      await cache.invalidateQueries({ queryKey: ['dashboard', businessId] });
      setMessage(
        path.includes('/access/')
          ? 'Admin access revoked.'
          : 'Invitation updated. Check its delivery status below.',
      );
      setRemoving(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Please retry');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="access-management space-y-6">
      <h1 className="text-2xl">Access management</h1>
      <p className="muted">Business access and team administration</p>
      {current?.role !== 'OWNER' && (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600"
        >
          Only the Owner can manage Admin invitations.
        </p>
      )}
      {current && (
        <>
          <p className="text-sm font-medium text-slate-700">
            {current.business.name}
          </p>
          <div className="stats">
            <section>
              <span className="muted">Your access</span>
              <h2>{current.role}</h2>
            </section>
            <section>
              <span className="muted">Currency</span>
              <h2>{current.business.currency}</h2>
            </section>
            <section>
              <span className="muted">Timezone</span>
              <h2>{current.business.timezone}</h2>
            </section>
          </div>
          {current.role === 'OWNER' && (
            <section className="space-y-3">
              <h2>Current team</h2>
              {team.isPending && <p>Loading team...</p>}
              {team.error && (
                <p role="alert">
                  {team.error.message}{' '}
                  <button onClick={() => void team.refetch()}>Retry</button>
                </p>
              )}
              {team.data?.map((person) => (
                <div
                  key={person.userId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p>
                      {person.email ||
                        (person.role === 'OWNER'
                          ? 'Business owner'
                          : person.userId)}
                    </p>
                    <p className="text-xs text-slate-500">{person.role}</p>
                  </div>
                  {person.role === 'ADMIN' &&
                    (removing === person.userId ? (
                      <div>
                        <p>Revoke this admin?s access to all branches?</p>
                        <button
                          disabled={busy}
                          onClick={() =>
                            void action(
                              `/businesses/${businessId}/access/${person.userId}/revoke`,
                              {},
                            )
                          }
                        >
                          Confirm revoke access
                        </button>{' '}
                        <button
                          disabled={busy}
                          onClick={() => setRemoving(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => setRemoving(person.userId)}
                      >
                        Revoke access
                      </button>
                    ))}
                </div>
              ))}
            </section>
          )}
          <section>
            <h2>Branches</h2>
            <ul>
              {current.business.branches.map((branch) => (
                <li key={branch.id}>{branch.name}</li>
              ))}
            </ul>
          </section>
          {current.role === 'OWNER' && (
            <section>
              <h2>Admin invitations</h2>
              <p className="muted">
                Admins can operate all branches. Only you can manage
                invitations.
              </p>
              <form
                className="invite-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  void action(`/businesses/${businessId}/invitations`, {
                    email: data.get('email'),
                  });
                }}
              >
                <label>
                  Admin email
                  <input name="email" type="email" required maxLength={254} />
                </label>
                <button disabled={busy}>Send invitation</button>
              </form>
              {invitations.isPending && <p>Loading invitations…</p>}
              {invitations.error && (
                <p className="error" role="alert">
                  {invitations.error.message}{' '}
                  <button onClick={() => invitations.refetch()}>Retry</button>
                </p>
              )}
              {invitations.data?.length === 0 && <p>No invitations yet.</p>}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Delivery</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.data?.map((item) => (
                      <tr key={item.id}>
                        <td>{item.email}</td>
                        <td>
                          {item.acceptedAt
                            ? 'Accepted'
                            : item.revokedAt
                              ? 'Revoked'
                              : new Date(item.expiresAt) < new Date()
                                ? 'Expired'
                                : 'Pending'}
                        </td>
                        <td>{item.deliveryStatus}</td>
                        <td>{new Date(item.expiresAt).toLocaleDateString()}</td>
                        <td>
                          {!item.acceptedAt && !item.revokedAt && (
                            <div className="actions">
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  action(
                                    `/businesses/${businessId}/invitations/${item.id}/resend`,
                                    {},
                                  )
                                }
                              >
                                Resend
                              </button>
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  action(
                                    `/businesses/${businessId}/invitations/${item.id}/revoke`,
                                    {},
                                  )
                                }
                              >
                                Revoke
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </div>
  );
}
