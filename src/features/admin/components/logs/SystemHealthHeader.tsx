import { useState, useEffect, useCallback } from 'react';
import { uiText } from '../../../../ui-text';

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
    } catch (e) {
      // Ignore
    }
  }, []);

  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  return (
    <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col @md:flex-row @md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h3 className="font-oswald text-xl font-bold text-white uppercase tracking-wider flex items-center space-x-2">
            <span>🖥️</span>
            <span>{uiText.admin.logs.systemTitle}</span>
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            {uiText.admin.logs.systemDescription}
          </p>
        </div>
        
        <button
          type="button"
          onClick={onOpenResetModal}
          className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/60 rounded-lg text-xs font-bold shadow-lg shadow-red-900/20 transition-colors whitespace-nowrap self-start @md:self-auto"
        >
          {uiText.admin.logs.clearDatabase}
        </button>
      </div>

      <div className="grid grid-cols-1 @sm:grid-cols-3 gap-4 text-xs font-mono">
        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-1 shadow-inner">
          <div className="text-neutral-500 uppercase font-bold text-[10px]">{uiText.admin.logs.apiStatus}</div>
          <div className="text-emerald-400 font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{uiText.admin.logs.online}</span>
          </div>
        </div>

        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-1 shadow-inner">
          <div className="text-neutral-500 uppercase font-bold text-[10px]">{uiText.admin.logs.storageEngine}</div>
          <div className="text-neutral-200 font-bold">{uiText.admin.logs.storageValue}</div>
        </div>

        <div className="bg-neutral-950 p-4 rounded-lg border border-neutral-800 space-y-1 shadow-inner">
          <div className="text-neutral-500 uppercase font-bold text-[10px]">{uiText.admin.logs.categories}</div>
          <div className="text-amber-400 font-bold">{uiText.admin.logs.configuredEvaluations(evalCount)}</div>
        </div>
      </div>

      {resetSuccessMessage && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-lg text-sm font-semibold flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2">
            <span>🎉</span>
            <span>{resetSuccessMessage}</span>
          </div>
          <button onClick={onClearSuccessMessage} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}
    </section>
  );
}
