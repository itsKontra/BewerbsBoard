import React, { useState } from 'react';
import { uiText } from '../../../../ui-text';

interface DatabaseResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DatabaseResetModal({ isOpen, onClose, onSuccess }: DatabaseResetModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResetDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationInput !== uiText.admin.logs.reset.keyword) return;

    setResetting(true);
    setResetError(null);

    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationKeyword: confirmationInput }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.logs.reset.error(res.status));
      }

      const data = await res.json();
      onSuccess(data.message || uiText.admin.logs.reset.success);
      setConfirmationInput('');
      onClose();
    } catch (err: any) {
      setResetError(err.message || uiText.admin.logs.reset.fallback);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-red-900/60 rounded-2xl w-full max-w-md shadow-2xl shadow-red-900/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-red-950/20 border-b border-red-900/60">
          <h3 className="font-oswald text-xl font-bold text-red-400 uppercase tracking-wide flex items-center space-x-2">
            <span>⚠️</span>
            <span>{uiText.admin.logs.reset.title}</span>
          </h3>
        </div>
        
        <form onSubmit={handleResetDatabase} className="p-6 space-y-6">
          {resetError && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl text-sm font-semibold flex items-center space-x-2">
              <span>❌</span>
              <span>{resetError}</span>
            </div>
          )}
          
          <div className="space-y-4 text-sm text-neutral-300">
            <p>{uiText.admin.logs.reset.warning}</p>
            <p className="font-semibold text-white">{uiText.admin.logs.reset.confirmBefore} <code className="bg-neutral-800 px-2 py-0.5 rounded text-red-400 select-all shadow-inner">{uiText.admin.logs.reset.keyword}</code> {uiText.admin.logs.reset.confirmAfter}</p>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              className="w-full bg-neutral-950 border border-red-900/60 focus:border-red-500 rounded-lg px-4 py-3 text-white font-mono uppercase tracking-widest text-center focus:outline-none transition-colors shadow-inner"
              placeholder={uiText.admin.logs.reset.keyword}
              autoComplete="off"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setConfirmationInput('');
                setResetError(null);
                onClose();
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500/50"
              disabled={resetting}
            >
              {uiText.admin.logs.reset.cancel}
            </button>
            <button
              type="submit"
              disabled={confirmationInput !== uiText.admin.logs.reset.keyword || resetting}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-900/40 transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {resetting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{uiText.admin.logs.reset.deleting}</span>
                </>
              ) : (
                <span>{uiText.admin.logs.reset.deletePermanently}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
