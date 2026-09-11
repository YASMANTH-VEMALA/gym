'use client';

import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Upload,
  Trash2,
  Check,
  AlertCircle,
  Eye,
  Coins,
  Clock,
  Dumbbell,
  Link2,
} from 'lucide-react';
import { useAdminContext } from '@/features/admin/admin-context';
import { api, resolveLogoUrl } from '@/lib/api/auth-api';

export function GymBranding() {
  const { current } = useAdminContext();
  const cache = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = current?.role === 'OWNER';
  const businessId = current?.businessId;
  const currentLogo = resolveLogoUrl(current?.business.logoUrl);

  const [name, setName] = useState(current?.business.name || '');
  const [currency, setCurrency] = useState(current?.business.currency || 'INR');
  const [timezone, setTimezone] = useState(
    current?.business.timezone || 'Asia/Kolkata',
  );

  // Logo upload state
  const [logoPreview, setLogoPreview] = useState<string | null>(
    currentLogo || null,
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [externalUrl, setExternalUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Handle file selection
  function handleFile(file: File) {
    setError('');
    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
    ];
    if (!validTypes.includes(file.type)) {
      setError('Please choose a PNG, JPEG, WebP, or SVG image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo file size must be 2 MB or smaller.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      setLogoPreview(result);
      setLogoDataUrl(result);
      setExternalUrl('');
    };
    reader.onerror = () => {
      setError('Could not read image file. Please try another.');
    };
    reader.readAsDataURL(file);
  }

  function onFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleRemoveLogo() {
    setLogoPreview(null);
    setLogoDataUrl(null);
    setExternalUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleApplyUrl() {
    if (!externalUrl.trim()) return;
    if (
      !externalUrl.startsWith('http://') &&
      !externalUrl.startsWith('https://')
    ) {
      setError('Image URL must start with http:// or https://');
      return;
    }
    setError('');
    setLogoPreview(externalUrl.trim());
    setLogoDataUrl(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || !businessId) return;

    setBusy(true);
    setSuccess('');
    setError('');

    try {
      const payload: Record<string, unknown> = {};
      if (name.trim() && name !== current?.business.name) {
        payload.name = name.trim();
      }
      if (currency && currency !== current?.business.currency) {
        payload.currency = currency;
      }
      if (timezone && timezone !== current?.business.timezone) {
        payload.timezone = timezone;
      }

      if (logoDataUrl !== undefined) {
        payload.logoDataUrl = logoDataUrl;
      } else if (externalUrl.trim()) {
        payload.logoUrl = externalUrl.trim();
      }

      if (Object.keys(payload).length === 0) {
        setSuccess('No changes to save.');
        setBusy(false);
        return;
      }

      await api(`/businesses/${businessId}/profile`, payload, 'PATCH');

      await cache.invalidateQueries({ queryKey: ['me/businesses'] });
      await cache.invalidateQueries({ queryKey: ['dashboard', businessId] });
      await cache.invalidateQueries();

      setSuccess('Gym brand profile & logo updated successfully!');
      setLogoDataUrl(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Title & Context Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Gym Brand & Logo Settings
          </h2>
          <p className="text-sm text-slate-500">
            Customize your gym&apos;s brand identity, official logo, and regional preferences across the platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              isOwner
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-700/10'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10'
            }`}
          >
            {isOwner ? 'Owner Managed' : 'View Only (Admin)'}
          </span>
        </div>
      </div>

      {!isOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <span>
            Only the Gym Owner has permission to change brand settings and upload official logos.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <AlertCircle size={18} className="shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <Check size={18} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Logo Customization Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Official Gym Logo
              </h3>
              <p className="text-xs text-slate-500">
                Appears in your admin dashboard sidebar, member portal header, and printable QR sheets.
              </p>
            </div>
            {logoPreview && isOwner && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <Trash2 size={14} />
                Remove Logo
              </button>
            )}
          </div>

          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Column: Upload area */}
            <div className="space-y-4 lg:col-span-7">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={onFileInputChange}
                disabled={!isOwner}
                className="hidden"
                id="gym-logo-file-input"
              />

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => isOwner && fileInputRef.current?.click()}
                className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragging
                    ? 'border-blue-600 bg-blue-50/50 scale-[0.99]'
                    : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                } ${isOwner ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}
              >
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 group-hover:scale-105 transition-transform">
                  <Upload size={24} className="text-blue-600" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {isOwner ? 'Click to upload or drag & drop' : 'Logo upload restricted to Owner'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  SVG, PNG, JPG, or WebP (recommended square or horizontal, max 2 MB)
                </p>
              </div>

              {/* Toggle custom URL input */}
              {isOwner && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    <Link2 size={13} />
                    {showUrlInput ? 'Hide URL input' : 'Or use an external image URL'}
                  </button>

                  {showUrlInput && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
                      >
                        Preview URL
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Live Mockup / Surface Previews */}
            <div className="space-y-4 lg:col-span-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Eye size={14} />
                Live Brand Preview
              </div>

              {/* Sidebar Header Preview Card */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 p-4 text-white shadow-md">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Admin Sidebar Preview
                </p>
                <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 p-3 border border-slate-800">
                  {logoPreview ? (
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoPreview}
                        alt="Gym logo preview"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                      <Dumbbell size={20} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold tracking-tight text-white">
                      {name || 'Your Gym'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Gym Workspace
                    </p>
                  </div>
                </div>
              </div>

              {/* Member Portal Header Preview Card */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Member Portal Preview
                </p>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <div className="flex items-center gap-2.5">
                    {logoPreview ? (
                      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5 shadow-xs border border-slate-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview}
                          alt="Gym logo preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
                        {(name || 'G').slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {name || 'Your Gym'}
                    </span>
                  </div>
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    Active Member
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Gym General Details Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 border-b border-slate-100 pb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Gym Details & Region
            </h3>
            <p className="text-xs text-slate-500">
              Basic business profile information used across customer invoices, receipts, and system alerts.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Gym Name */}
            <div className="space-y-1.5 sm:col-span-2">
              <label
                htmlFor="gym-name-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Building2 size={14} className="text-slate-400" />
                Gym Business Name *
              </label>
              <input
                id="gym-name-input"
                type="text"
                required
                disabled={!isOwner}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Iron Fitness & CrossFit Club"
                className="h-10 w-full rounded-xl border border-slate-200 px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-50"
              />
            </div>

            {/* Currency */}
            <div className="space-y-1.5">
              <label
                htmlFor="gym-currency-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Coins size={14} className="text-slate-400" />
                Operating Currency
              </label>
              <select
                id="gym-currency-input"
                disabled={!isOwner}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-50"
              >
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="USD">USD ($) - US Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="AED">AED (د.إ) - UAE Dirham</option>
              </select>
            </div>

            {/* Timezone */}
            <div className="space-y-1.5">
              <label
                htmlFor="gym-timezone-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
              >
                <Clock size={14} className="text-slate-400" />
                Business Timezone
              </label>
              <select
                id="gym-timezone-input"
                disabled={!isOwner}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden disabled:bg-slate-50"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </section>

        {/* Submit Action Bar */}
        {isOwner && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 transition-all cursor-pointer"
            >
              {busy ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Save Branding Changes
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
