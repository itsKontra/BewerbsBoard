import { useState, useEffect, useCallback } from 'react';
import { SystemHealthHeader } from './logs/SystemHealthHeader';
import { DatabaseResetModal } from './logs/DatabaseResetModal';
import { uiText } from '../../../ui-text';

export interface AuditRecord {
  id: string;
  timestamp: number;
  user: string;
  action: string;
  details: string | null;
}

export function LogsTab() {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(20);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [search, setSearch] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<AuditRecord | null>(null);

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/admin/audit-logs?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(uiText.admin.logs.loadError(res.status));
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message || uiText.admin.logs.loadFallback);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);
  const parseDetails = (detailsStr: string | null) => {
    if (!detailsStr) return null;
    try {
      return JSON.parse(detailsStr);
    } catch {
      return detailsStr;
    }
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'DATABASE_CLEAR':
        return (
          <span className="px-2.5 py-1 text-xs font-extrabold bg-red-950 text-red-400 border border-red-800/80 rounded-md tracking-wide">
            DATABASE_CLEAR
          </span>
        );
      case 'CREATE_CATEGORY_ENTRY':
      case 'CREATE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-md tracking-wide">
            {action}
          </span>
        );
      case 'DELETE_CATEGORY_ENTRY':
      case 'DELETE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-amber-950 text-amber-400 border border-amber-800/60 rounded-md tracking-wide">
            {action}
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-800/60 rounded-md tracking-wide">
            UPDATE
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-md tracking-wide">
            {action}
          </span>
        );
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };


  return (
    <div className="space-y-6 @container">
      <SystemHealthHeader
        onOpenResetModal={() => setShowResetModal(true)}
        resetSuccessMessage={resetSuccess}
        onClearSuccessMessage={() => setResetSuccess(null)}
      />
      {/* Header & Search Bar */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 shadow-xl flex flex-col @md:flex-row items-stretch @md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
            🔍
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={uiText.admin.logs.searchPlaceholder}
            className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 rounded-lg pl-10 pr-10 py-2.5 text-sm text-white focus:outline-none transition-colors shadow-inner"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center justify-between @md:justify-end space-x-4">
          <span className="text-xs font-mono text-neutral-400">
            {uiText.admin.logs.foundCount(total)}
          </span>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold uppercase tracking-wider font-oswald border border-neutral-700 transition-colors flex items-center space-x-1.5 shadow-sm"
          >
            <span>🔄</span>
            <span className="hidden @sm:inline">{uiText.admin.logs.refresh}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-950/70 border border-red-800 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white text-xs font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-oswald uppercase tracking-wider text-sm">{uiText.admin.logs.loading}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 space-y-2">
            <div className="text-3xl mb-2">📜</div>
            <p className="font-bold text-neutral-200">{uiText.admin.logs.empty}</p>
            <p className="text-xs text-neutral-500">
              {search ? uiText.admin.logs.differentSearch : uiText.admin.logs.noChanges}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-neutral-950 text-neutral-400 font-oswald text-xs uppercase tracking-wider border-b border-neutral-800">
                  <th className="py-3 px-4">{uiText.admin.logs.timestamp}</th>
                  <th className="py-3 px-4">{uiText.admin.logs.user}</th>
                  <th className="py-3 px-4">{uiText.admin.logs.action}</th>
                  <th className="py-3 px-4">{uiText.admin.logs.detailsPreview}</th>
                  <th className="py-3 px-4 text-right">{uiText.admin.logs.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {logs.map((log) => {
                  const detailsObj = parseDetails(log.details);
                  return (
                    <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors font-sans">
                      <td className="py-3.5 px-4 font-mono text-xs text-neutral-300 whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-neutral-200 whitespace-nowrap">
                        {log.user}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-neutral-400 max-w-xs truncate">
                        {typeof detailsObj === 'object' && detailsObj !== null
                          ? JSON.stringify(detailsObj)
                          : log.details || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors shadow-sm"
                        >
                          {uiText.admin.logs.details}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="bg-neutral-950 px-4 py-3 border-t border-neutral-800 flex items-center justify-between text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-300 font-semibold transition-colors"
            >
              {uiText.admin.logs.previousPage}
            </button>

            <span className="text-neutral-400 font-mono">
              {uiText.admin.logs.page(page, totalPages)}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 border border-neutral-800 text-neutral-300 font-semibold transition-colors"
            >
              {uiText.admin.logs.nextPage}
            </button>
          </div>
        )}
      </div>

      {/* JSON Diff Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-xl">📜</span>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-oswald text-lg font-bold text-white uppercase tracking-wider">
                      {uiText.admin.logs.inspector}
                    </h3>
                    {renderActionBadge(selectedLog.action)}
                  </div>
                  <p className="text-xs text-neutral-400 font-mono mt-0.5">
                    ID: {selectedLog.id} | {formatDate(selectedLog.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white p-1 font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4 bg-neutral-950 p-3 rounded-lg border border-neutral-800 shadow-inner">
                <div>
                  <span className="text-neutral-500 uppercase font-bold text-[10px]">{uiText.admin.logs.userLabel}</span>
                  <div className="text-neutral-200 font-semibold">{selectedLog.user}</div>
                </div>
                <div>
                  <span className="text-neutral-500 uppercase font-bold text-[10px]">{uiText.admin.logs.timestampLabel}</span>
                  <div className="text-neutral-200 font-semibold">{formatDate(selectedLog.timestamp)}</div>
                </div>
              </div>

              {(() => {
                const parsed = parseDetails(selectedLog.details);
                if (
                  typeof parsed === 'object' &&
                  parsed !== null &&
                  (('previous_value' in parsed || 'previousValue' in parsed) &&
                    ('new_value' in parsed || 'newValue' in parsed))
                ) {
                  const prev = parsed.previous_value ?? parsed.previousValue;
                  const next = parsed.new_value ?? parsed.newValue;
                  return (
                    <div className="space-y-3">
                      <h4 className="font-oswald text-sm font-bold text-neutral-300 uppercase tracking-wider">
                        {uiText.admin.logs.diffTitle}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Previous Value */}
                        <div className="bg-red-950/20 border border-red-900/40 rounded-lg p-3 space-y-1">
                          <div className="text-red-400 font-bold text-[11px] border-b border-red-900/40 pb-1 mb-2">
                            {uiText.admin.logs.previous}
                          </div>
                          <pre className="text-red-200/90 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(prev, null, 2)}
                          </pre>
                        </div>

                        {/* New Value */}
                        <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 space-y-1">
                          <div className="text-emerald-400 font-bold text-[11px] border-b border-emerald-900/40 pb-1 mb-2">
                            {uiText.admin.logs.next}
                          </div>
                          <pre className="text-emerald-200/90 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(next, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <h4 className="font-oswald text-sm font-bold text-neutral-300 uppercase tracking-wider">
                      {uiText.admin.logs.snapshot}
                    </h4>
                    <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-4 shadow-inner">
                      <pre className="text-neutral-300 whitespace-pre-wrap overflow-x-auto">
                        {typeof parsed === 'object' && parsed !== null
                          ? JSON.stringify(parsed, null, 2)
                          : String(selectedLog.details)}
                      </pre>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="bg-neutral-950 px-6 py-3 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold border border-neutral-700 transition-colors shadow-sm"
              >
                {uiText.admin.logs.close}
              </button>
            </div>
          </div>
        </div>
      )}

      <DatabaseResetModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onSuccess={(msg) => {
          setResetSuccess(msg);
          fetchLogs();
        }}
      />
    </div>
  );
}
