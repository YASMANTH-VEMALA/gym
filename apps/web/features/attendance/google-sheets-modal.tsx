'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/auth-api';

interface GoogleSheetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  branchId: string;
  branchName: string;
  year: number;
  month: number;
  monthName: string;
}

type ConnectionStatus = {
  configured: boolean;
  connected: boolean;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
  lastSyncedAt: string | null;
  missingConfiguration: string[];
};

export function GoogleSheetsModal({
  isOpen,
  onClose,
  businessId,
  branchId,
  branchName,
  year,
  month,
  monthName,
}: GoogleSheetsModalProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [sheet, setSheet] = useState('');
  const [busy, setBusy] = useState<'connect' | 'push' | 'pull' | ''>('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    void api<ConnectionStatus>(`/businesses/${businessId}/google-sheets/status`)
      .then((result) => {
        setStatus(result);
        setSheet(result.spreadsheetId || '');
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to check Google Sheets.',
        ),
      );
  }, [businessId, isOpen]);

  if (!isOpen) return null;

  async function connect() {
    setBusy('connect');
    setError('');
    try {
      const result = await api<{ authorizationUrl: string }>(
        `/businesses/${businessId}/google-sheets/oauth/start`,
        { returnTo: window.location.pathname + window.location.search },
      );
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to start Google connection.',
      );
      setBusy('');
    }
  }

  async function sync(direction: 'PUSH' | 'PULL') {
    if (
      direction === 'PULL' &&
      !window.confirm(
        `Import attendance from the ${monthName} sheet? Sheet values will replace attendance for this month.`,
      )
    )
      return;
    setBusy(direction === 'PUSH' ? 'push' : 'pull');
    setError('');
    setNotice('');
    try {
      const result = await api<{
        rowCount: number;
        imported: number;
        spreadsheetUrl: string;
        sheetTitle: string;
      }>(`/businesses/${businessId}/google-sheets/sync`, {
        branchId,
        year,
        month,
        direction,
        ...(sheet.trim() ? { sheetId: sheet.trim() } : {}),
      });
      setStatus((current) =>
        current
          ? {
              ...current,
              connected: true,
              spreadsheetUrl: result.spreadsheetUrl,
            }
          : current,
      );
      setNotice(
        direction === 'PUSH'
          ? `${result.rowCount} member rows sent to “${result.sheetTitle}”.`
          : `${result.imported} attendance cells imported from “${result.sheetTitle}”.`,
      );
      if (direction === 'PULL') window.location.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Google Sheets sync failed.',
      );
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-sheets-title"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2
              id="google-sheets-title"
              className="text-base font-semibold text-slate-950"
            >
              Google Sheets
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {branchName} · {monthName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="secondary px-2.5 py-1.5"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        <div className="space-y-5 p-5">
          {!status && !error && (
            <p className="text-sm text-slate-500">Checking connection…</p>
          )}

          {status && !status.configured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Server setup required</p>
              <p className="mt-1 leading-5">
                Add{' '}
                {status.missingConfiguration.map((key, index) => (
                  <span key={key}>
                    {index ? ', ' : ''}
                    <code>{key}</code>
                  </span>
                ))}{' '}
                to the server environment, then restart the API.
              </p>
            </div>
          )}

          {status?.configured && !status.connected && (
            <div>
              <p className="text-sm leading-6 text-slate-600">
                Connect an admin Google account. The app requests access to
                spreadsheets so it can create one workbook and keep monthly
                attendance tabs in sync.
              </p>
              <button
                onClick={() => void connect()}
                disabled={!!busy}
                className="mt-4 bg-slate-950 hover:bg-slate-800"
              >
                {busy === 'connect'
                  ? 'Opening Google…'
                  : 'Connect Google account'}
              </button>
            </div>
          )}

          {status?.connected && (
            <>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <span className="font-medium">Google Sheets connected</span>
                {status.spreadsheetUrl && (
                  <a
                    href={status.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    Open sheet
                  </a>
                )}
              </div>

              <label>
                Spreadsheet URL or ID
                <input
                  value={sheet}
                  onChange={(event) => setSheet(event.target.value)}
                  placeholder="Leave blank to create a Gym attendance sheet"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void sync('PUSH')}
                  disabled={!!busy}
                  className="bg-slate-950 hover:bg-slate-800"
                >
                  {busy === 'push' ? 'Sending…' : 'Send app data to Google'}
                </button>
                <button
                  onClick={() => void sync('PULL')}
                  disabled={!!busy || !sheet.trim()}
                  className="secondary"
                >
                  {busy === 'pull'
                    ? 'Importing…'
                    : 'Import changes from Google'}
                </button>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Each branch and month gets its own tab. Use P, A, R, or the full
                status name in day cells when editing in Google Sheets.
              </p>
            </>
          )}

          {notice && (
            <p
              role="status"
              className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800"
            >
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-xs text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
