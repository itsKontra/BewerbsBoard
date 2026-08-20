import { useState, useEffect, useCallback } from 'react';
import { SystemHealthHeader } from './logs/SystemHealthHeader';
import { DatabaseResetModal } from './logs/DatabaseResetModal';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { Search, RotateCw, FileText, X, AlertTriangle, Loader2 } from 'lucide-react';

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
          <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-700 border border-red-200 rounded-lg tracking-wide">
            DATABASE_CLEAR
          </span>
        );
      case 'CREATE_CATEGORY_ENTRY':
      case 'CREATE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg tracking-wide">
            {action}
          </span>
        );
      case 'DELETE_CATEGORY_ENTRY':
      case 'DELETE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg tracking-wide">
            {action}
          </span>
        );
      case 'UPDATE':
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg tracking-wide">
            UPDATE
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg tracking-wide">
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
      <AdminCard>
        <div className="flex flex-col @md:flex-row items-stretch @md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={uiText.admin.logs.searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-800 focus:outline-none transition-all shadow-sm"
            />
            {search && (
              <button
                onClick={() => {
                  setSearch('');
                  setPage(1);
                }}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between @md:justify-end space-x-4">
            <span className="text-xs font-mono text-slate-500">
              {uiText.admin.logs.foundCount(total)}
            </span>
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center space-x-1.5 shadow-sm cursor-pointer"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden @sm:inline">{uiText.admin.logs.refresh}</span>
            </button>
          </div>
        </div>
      </AdminCard>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Audit Log Table */}
      <AdminCard className="!p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-medium">
            <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
            <p className="text-sm">{uiText.admin.logs.loading}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <div className="p-3 bg-slate-50 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto text-slate-400 mb-2">
              <FileText size={24} />
            </div>
            <p className="font-bold text-slate-700">{uiText.admin.logs.empty}</p>
            <p className="text-xs text-slate-400">
              {search ? uiText.admin.logs.differentSearch : uiText.admin.logs.noChanges}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3.5 px-4">{uiText.admin.logs.timestamp}</th>
                  <th className="py-3.5 px-4">{uiText.admin.logs.user}</th>
                  <th className="py-3.5 px-4">{uiText.admin.logs.action}</th>
                  <th className="py-3.5 px-4">{uiText.admin.logs.detailsPreview}</th>
                  <th className="py-3.5 px-4 text-right">{uiText.admin.logs.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const detailsObj = parseDetails(log.details);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors font-sans">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(log.timestamp)}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {log.user}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderActionBadge(log.action)}
                      </td>

                      <td className="py-3.5 px-4 text-xs font-mono text-slate-500 max-w-xs truncate">
                        {typeof detailsObj === 'object' && detailsObj !== null
                          ? JSON.stringify(detailsObj)
                          : log.details || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-xs cursor-pointer"
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
          <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 font-semibold transition-colors shadow-xs"
            >
              {uiText.admin.logs.previousPage}
            </button>

            <span className="text-slate-500 font-mono">
              {uiText.admin.logs.page(page, totalPages)}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 font-semibold transition-colors shadow-xs"
            >
              {uiText.admin.logs.nextPage}
            </button>
          </div>
        )}
      </AdminCard>

      {/* JSON Diff Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText size={20} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-800">
                      {uiText.admin.logs.inspector}
                    </h3>
                    {renderActionBadge(selectedLog.action)}
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: {selectedLog.id} | {formatDate(selectedLog.timestamp)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">{uiText.admin.logs.userLabel}</span>
                  <div className="text-slate-800 font-semibold mt-0.5">{selectedLog.user}</div>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold text-[10px]">{uiText.admin.logs.timestampLabel}</span>
                  <div className="text-slate-800 font-semibold mt-0.5">{formatDate(selectedLog.timestamp)}</div>
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
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {uiText.admin.logs.diffTitle}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Previous Value */}
                        <div className="bg-red-50/60 border border-red-200 rounded-2xl p-4 space-y-1">
                          <div className="text-red-700 font-bold text-xs border-b border-red-200 pb-2 mb-2">
                            {uiText.admin.logs.previous}
                          </div>
                          <pre className="text-red-900 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(prev, null, 2)}
                          </pre>
                        </div>

                        {/* New Value */}
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-1">
                          <div className="text-emerald-700 font-bold text-xs border-b border-emerald-200 pb-2 mb-2">
                            {uiText.admin.logs.next}
                          </div>
                          <pre className="text-emerald-900 whitespace-pre-wrap overflow-x-auto">
                            {JSON.stringify(next, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {uiText.admin.logs.snapshot}
                    </h4>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <pre className="text-slate-700 whitespace-pre-wrap overflow-x-auto">
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
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors shadow-xs"
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
