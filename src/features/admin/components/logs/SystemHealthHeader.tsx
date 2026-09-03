import { useState, useEffect, useCallback } from 'react';
import { uiText } from '../../../../ui-text';
import { AdminCard } from '../AdminCard';
import { Server, Activity, Database, Layers, Trash2, CheckCircle2, X } from 'lucide-react';

interface SystemHealthHeaderProps {
  onOpenResetModal: () => void;
  resetSuccessMessage: string | null;
  onClearSuccessMessage: () => void;
}

export function SystemHealthHeader({ onOpenResetModal, resetSuccessMessage, onClearSuccessMessage }: SystemHealthHeaderProps) {
  const [evalCount, setEvalCount] = useState<number>(0);

  const fetchSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/evaluation-types');
      if (res.ok) {
        const data = await res.json();
        setEvalCount(Array.isArray(data) ? data.length : 0);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  return (
    <AdminCard className="space-y-6">
      <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <Server size={20} className="text-indigo-600" />
            <span>{uiText.admin.logs.systemTitle}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {uiText.admin.logs.systemDescription}
          </p>
        </div>
        
        <button
          type="button"
          onClick={onOpenResetModal}
          className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap self-start @md:self-auto flex items-center space-x-1.5 cursor-pointer"
        >
          <Trash2 size={14} />
          <span>{uiText.admin.logs.clearDatabase}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 @sm:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5 shadow-xs">
          <div className="text-slate-400 uppercase font-bold text-[10px] flex items-center space-x-1">
            <Activity size={12} />
            <span>{uiText.admin.logs.apiStatus}</span>
          </div>
          <div className="text-emerald-600 font-bold flex items-center space-x-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{uiText.admin.logs.online}</span>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5 shadow-xs">
          <div className="text-slate-400 uppercase font-bold text-[10px] flex items-center space-x-1">
            <Database size={12} />
            <span>{uiText.admin.logs.storageEngine}</span>
          </div>
          <div className="text-slate-800 font-bold text-sm">{uiText.admin.logs.storageValue}</div>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1.5 shadow-xs">
          <div className="text-slate-400 uppercase font-bold text-[10px] flex items-center space-x-1">
            <Layers size={12} />
            <span>{uiText.admin.logs.categories}</span>
          </div>
          <div className="text-amber-700 font-bold text-sm">{uiText.admin.logs.configuredEvaluations(evalCount)}</div>
        </div>
      </div>

      {resetSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} />
            <span>{resetSuccessMessage}</span>
          </div>
          <button onClick={onClearSuccessMessage} className="text-emerald-400 hover:text-emerald-700">
            <X size={16} />
          </button>
        </div>
      )}
    </AdminCard>
  );
}
