'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ACCESS_SECTIONS, ALL_SECTION_SLUGS } from '@gym/constants';
import { api, type Invitation, type TeamMember } from '@/lib/api/auth-api';
import { useAdminContext } from '@/features/admin/admin-context';

export function AccessManagement() {
  const cache = useQueryClient();
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { current } = useAdminContext();
  const businessId = current?.businessId;

  const team = useQuery({
    queryKey: ['team', businessId],
    queryFn: () => api<TeamMember[]>(`/businesses/${businessId}/access`),
    enabled: current?.role === 'OWNER',
    retry: false,
  });

  const invitations = useQuery({
    queryKey: ['invitations', businessId],
    queryFn: () => api<Invitation[]>(`/businesses/${businessId}/invitations`),
    enabled: current?.role === 'OWNER',
    retry: false,
  });

  const [removing, setRemoving] = useState<string | null>(null);

  // Invite Form State
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MANAGER' | 'ADMIN'>('MANAGER');
  const [inviteBranchId, setInviteBranchId] = useState<string>(
    current?.business.branches[0]?.id || '',
  );
  const [invitePermissions, setInvitePermissions] = useState<string[]>([
    'monthly_sheet',
    'members',
    'attendance',
    'payments',
    'qr',
  ]);

  // Edit Access State
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<'MANAGER' | 'ADMIN'>('MANAGER');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);

  function startEditing(person: TeamMember) {
    setEditingMember(person);
    setEditRole(person.role === 'ADMIN' ? 'ADMIN' : 'MANAGER');
    setEditBranchId(person.assignedBranchId || '');
    setEditPermissions(
      person.permissions && person.permissions.length > 0
        ? person.permissions
        : [...ALL_SECTION_SLUGS],
    );
  }

  function toggleInvitePermission(slug: string) {
    setInvitePermissions((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function toggleEditPermission(slug: string) {
    setEditPermissions((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleSendInvite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setErrorMsg('');
    try {
      await api(`/businesses/${businessId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
        assignedBranchId: inviteRole === 'MANAGER' ? inviteBranchId || null : (inviteBranchId || null),
        permissions: inviteRole === 'MANAGER' ? invitePermissions : ALL_SECTION_SLUGS,
      });
      await cache.invalidateQueries({ queryKey: ['invitations'] });
      setMessage(`Invitation sent successfully to ${inviteEmail}.`);
      setInviteEmail('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setBusy(true);
    setMessage('');
    setErrorMsg('');
    try {
      await api(
        `/businesses/${businessId}/access/${editingMember.userId}`,
        {
          role: editRole,
          assignedBranchId: editBranchId ? editBranchId : null,
          permissions: editRole === 'MANAGER' ? editPermissions : ALL_SECTION_SLUGS,
        },
        'PATCH',
      );
      await cache.invalidateQueries({ queryKey: ['team', businessId] });
      setMessage(`Access updated successfully for ${editingMember.email || editingMember.userId}.`);
      setEditingMember(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, body: unknown) {
    setBusy(true);
    setMessage('');
    setErrorMsg('');
    try {
      await api(path, body);
      await cache.invalidateQueries({ queryKey: ['invitations'] });
      await cache.invalidateQueries({ queryKey: ['team', businessId] });
      setMessage(
        path.includes('/access/')
          ? 'Access revoked successfully.'
          : 'Invitation updated.',
      );
      setRemoving(null);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Team &amp; Access Control</h1>
            <p className="text-sm text-slate-500 mt-1">
              Delegate branch management and isolate data access. Branch Managers only see their assigned branch and allowed sections.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              Your Role: {current?.role}
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {current?.business.branches.length} Branches Configured
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between">
          <span>✓ {message}</span>
          <button onClick={() => setMessage('')} className="text-emerald-700 font-bold ml-2">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-center justify-between">
          <span>⚠ {errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="text-rose-700 font-bold ml-2">✕</button>
        </div>
      )}

      {current?.role !== 'OWNER' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Manager / Admin View</p>
          <p className="mt-1">
            Only the Business Owner has authority to invite new team members or modify branch and section permissions.
          </p>
        </div>
      )}

      {current?.role === 'OWNER' && (
        <>
          {/* Current Team Members */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Active Team Members</h2>
                <p className="text-xs text-slate-500">People with administrative access to your gym</p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {team.data?.length || 0} Members
              </span>
            </div>

            {team.isPending && (
              <div className="p-8 text-center text-sm text-slate-500">Loading team members...</div>
            )}

            {team.error && (
              <div className="p-6 text-sm text-rose-600">
                Failed to load team: {team.error.message}{' '}
                <button onClick={() => void team.refetch()} className="underline font-semibold ml-2">Retry</button>
              </div>
            )}

            <div className="divide-y divide-slate-100">
              {team.data?.map((person) => {
                const isOwner = person.role === 'OWNER';
                const isAdmin = person.role === 'ADMIN';
                const permissionsList = person.permissions || [];

                return (
                  <div key={person.userId} className="p-5 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Person Details */}
                      <div className="space-y-1.5 min-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {person.email || (isOwner ? 'Business Owner' : `User: ${person.userId.slice(0, 8)}...`)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase ${
                              isOwner
                                ? 'bg-purple-100 text-purple-800'
                                : isAdmin
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {person.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 flex items-center gap-2">
                          <span>User ID: {person.userId}</span>
                        </p>
                      </div>

                      {/* Branch Scope */}
                      <div className="min-w-[200px]">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Branch Scope
                        </span>
                        {isOwner ? (
                          <span className="text-sm font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                            🏢 All Branches (Global)
                          </span>
                        ) : person.assignedBranchName ? (
                          <span className="text-sm font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                            📍 {person.assignedBranchName}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                            🏢 All Branches
                          </span>
                        )}
                      </div>

                      {/* Section Permissions */}
                      <div className="flex-1 min-w-[260px]">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                          Allowed Sections
                        </span>
                        {isOwner || isAdmin ? (
                          <span className="text-xs font-medium text-slate-600">
                            Full Access to all sections
                          </span>
                        ) : permissionsList.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">No specific sections granted</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {permissionsList.map((slug) => {
                              const section = ACCESS_SECTIONS.find((s) => s.slug === slug);
                              return (
                                <span
                                  key={slug}
                                  className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200"
                                >
                                  {section?.label || slug}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-start lg:self-center">
                        {!isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(person)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition shadow-sm"
                            >
                              Edit Access
                            </button>

                            {removing === person.userId ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    void action(
                                      `/businesses/${businessId}/access/${person.userId}/revoke`,
                                      {},
                                    )
                                  }
                                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition"
                                >
                                  Confirm Revoke
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => setRemoving(null)}
                                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => setRemoving(person.userId)}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                              >
                                Revoke
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Edit Access Modal / Overlay */}
          {editingMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full p-6 space-y-5 my-8">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Edit Team Access Permissions
                    </h3>
                    <p className="text-xs text-slate-500">
                      Updating permissions for: <strong className="text-slate-800">{editingMember.email || editingMember.userId}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingMember(null)}
                    className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleUpdateAccess} className="space-y-5">
                  {/* Role Picker */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      System Role
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setEditRole('MANAGER')}
                        className={`p-3 rounded-xl border text-left transition ${
                          editRole === 'MANAGER'
                            ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm text-emerald-900">Manager (Branch Isolated)</div>
                        <div className="text-xs text-emerald-700 mt-0.5">
                          Restricted strictly to one branch and allowed sections
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRole('ADMIN')}
                        className={`p-3 rounded-xl border text-left transition ${
                          editRole === 'ADMIN'
                            ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-bold text-sm text-blue-900">Full Administrator</div>
                        <div className="text-xs text-blue-700 mt-0.5">
                          Complete access across all branches and modules
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Branch Assignment */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Assigned Branch Isolation
                    </label>
                    <select
                      value={editBranchId}
                      onChange={(e) => setEditBranchId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    >
                      {editRole === 'ADMIN' && (
                        <option value="">All Branches (Unrestricted Access)</option>
                      )}
                      {current.business.branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          Branch: {b.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500">
                      {editRole === 'MANAGER'
                        ? 'The manager will ONLY see members, payments, and attendance for this branch.'
                        : 'Admins can optionally be scoped to one branch or oversee all branches.'}
                    </p>
                  </div>

                  {/* Permissions Selection (for Manager) */}
                  {editRole === 'MANAGER' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                          Allowed Section Access
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditPermissions([...ALL_SECTION_SLUGS])}
                            className="text-xs text-emerald-700 font-semibold hover:underline"
                          >
                            Select All
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditPermissions([
                                'monthly_sheet',
                                'members',
                                'attendance',
                                'payments',
                                'qr',
                              ])
                            }
                            className="text-xs text-blue-700 font-semibold hover:underline"
                          >
                            Desk Preset
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setEditPermissions([])}
                            className="text-xs text-slate-500 hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50/50">
                        {ACCESS_SECTIONS.map((sec) => {
                          const checked = editPermissions.includes(sec.slug);
                          return (
                            <label
                              key={sec.slug}
                              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                                checked
                                  ? 'bg-white border-emerald-300 shadow-xs'
                                  : 'bg-white/40 border-slate-200 opacity-60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEditPermission(sec.slug)}
                                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div className="text-xs">
                                <div className="font-semibold text-slate-900">{sec.label}</div>
                                <div className="text-slate-500 leading-tight mt-0.5">{sec.description}</div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setEditingMember(null)}
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-5 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
                    >
                      {busy ? 'Saving...' : 'Save Permissions'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Invite New Member Card */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-900">Invite New Team Member</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Grant branch manager access with customized section visibility, or invite full co-admins.
              </p>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-6">
              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Role
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setInviteRole('MANAGER')}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      inviteRole === 'MANAGER'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">Branch Manager</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Locked to a single branch. Can only view and operate the specific sections you authorize.
                    </p>
                  </div>

                  <div
                    onClick={() => setInviteRole('ADMIN')}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      inviteRole === 'ADMIN'
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900">Full Administrator</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                        All Branches
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Full administrative access across all branches, financial statements, and system settings.
                    </p>
                  </div>
                </div>
              </div>

              {/* Email & Branch Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="manager@gym.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400">An invitation email with access token will be delivered.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Branch Assignment
                  </label>
                  <select
                    value={inviteBranchId}
                    onChange={(e) => setInviteBranchId(e.target.value)}
                    required={inviteRole === 'MANAGER'}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {inviteRole === 'ADMIN' && (
                      <option value="">All Branches (Unrestricted Access)</option>
                    )}
                    {current.business.branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        Branch: {b.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    {inviteRole === 'MANAGER'
                      ? 'Manager will only be allowed to see and manage this branch.'
                      : 'Admins can manage all branches.'}
                  </p>
                </div>
              </div>

              {/* Section Permissions Matrix (when Role is MANAGER) */}
              {inviteRole === 'MANAGER' && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Authorized Sections for Manager
                      </span>
                      <p className="text-xs text-slate-500">Unchecked sections will be completely hidden from their navigation &amp; API access.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInvitePermissions([...ALL_SECTION_SLUGS])}
                        className="text-xs text-emerald-700 font-semibold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() =>
                          setInvitePermissions([
                            'monthly_sheet',
                            'members',
                            'attendance',
                            'payments',
                            'qr',
                          ])
                        }
                        className="text-xs text-blue-700 font-semibold hover:underline"
                      >
                        Front Desk Preset
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setInvitePermissions([])}
                        className="text-xs text-slate-500 hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {ACCESS_SECTIONS.map((sec) => {
                      const checked = invitePermissions.includes(sec.slug);
                      return (
                        <label
                          key={sec.slug}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                            checked
                              ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-500 opacity-60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleInvitePermission(sec.slug)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="text-xs">
                            <div className="font-semibold text-slate-900">{sec.label}</div>
                            <div className="text-slate-500 leading-tight mt-0.5">{sec.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm hover:bg-slate-800 transition shadow-sm disabled:opacity-50"
                >
                  {busy ? 'Sending Invitation...' : 'Send Team Invitation'}
                </button>
              </div>
            </form>
          </section>

          {/* Invitations History Table */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Sent Invitations</h2>
                <p className="text-xs text-slate-500">Track pending and accepted invitations</p>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {invitations.data?.length || 0} Total
              </span>
            </div>

            {invitations.isPending && (
              <div className="p-8 text-center text-sm text-slate-500">Loading invitations...</div>
            )}

            {invitations.error && (
              <div className="p-6 text-sm text-rose-600">
                Failed to load invitations: {invitations.error.message}{' '}
                <button onClick={() => void invitations.refetch()} className="underline font-semibold ml-2">Retry</button>
              </div>
            )}

            {invitations.data?.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                No invitations issued yet. Use the form above to invite team managers.
              </div>
            )}

            {invitations.data && invitations.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-3.5">Email</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">Branch</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Delivery</th>
                      <th className="p-3.5">Expires</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {invitations.data.map((item) => {
                      const isExpired = new Date(item.expiresAt) < new Date();
                      const status = item.acceptedAt
                        ? 'Accepted'
                        : item.revokedAt
                          ? 'Revoked'
                          : isExpired
                            ? 'Expired'
                            : 'Pending';

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-3.5 font-medium text-slate-900">{item.email}</td>
                          <td className="p-3.5">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                                item.role === 'ADMIN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {item.role || 'ADMIN'}
                            </span>
                          </td>
                          <td className="p-3.5">
                            {item.assignedBranch?.name ? (
                              <span className="text-emerald-700 font-medium">
                                📍 {item.assignedBranch.name}
                              </span>
                            ) : (
                              <span className="text-slate-500">All Branches</span>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                                status === 'Accepted'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : status === 'Pending'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[11px] font-medium ${
                                item.deliveryStatus === 'SENT'
                                  ? 'text-emerald-600'
                                  : item.deliveryStatus === 'FAILED'
                                    ? 'text-rose-600'
                                    : 'text-slate-500'
                              }`}
                            >
                              {item.deliveryStatus}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-500">
                            {new Date(item.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="p-3.5 text-right space-x-2">
                            {!item.acceptedAt && !item.revokedAt && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    action(
                                      `/businesses/${businessId}/invitations/${item.id}/resend`,
                                      {},
                                    )
                                  }
                                  className="px-2.5 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium transition"
                                >
                                  Resend
                                </button>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    action(
                                      `/businesses/${businessId}/invitations/${item.id}/revoke`,
                                      {},
                                    )
                                  }
                                  className="px-2.5 py-1 rounded border border-rose-200 text-rose-600 hover:bg-rose-50 font-medium transition"
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
