import React, { useState } from 'react';
import { uiText } from '../../../../ui-text';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface ResetScopes {
  categoryEntries: boolean;
  groups: boolean;
  fireBrigades: boolean;
  evaluationTypes: boolean;
  categoryTypes: boolean;
}

const DEFAULT_SCOPES: ResetScopes = {
  categoryEntries: true,
  groups: true,
  fireBrigades: true,
  evaluationTypes: false,
  categoryTypes: false,
};

interface DatabaseResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DatabaseResetModal({ isOpen, onClose, onSuccess }: DatabaseResetModalProps) {
  const [confirmationInput, setConfirmationInput] = useState('');
  const [scopes, setScopes] = useState<ResetScopes>(DEFAULT_SCOPES);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleScope = (scope: keyof ResetScopes, checked: boolean) => {
    setScopes((prev) => {
      const next = { ...prev, [scope]: checked };

      if (checked) {
        // Auto-enable prerequisite parents
        if (scope === 'fireBrigades') {
          next.groups = true;
          next.categoryEntries = true;
        } else if (scope === 'groups') {
          next.categoryEntries = true;
        } else if (scope === 'categoryTypes') {
          next.evaluationTypes = true;
          next.categoryEntries = true;
        } else if (scope === 'evaluationTypes') {
          next.categoryEntries = true;
        }
      } else {
        // Auto-disable dependent children
        if (scope === 'categoryEntries') {
          next.groups = false;
          next.fireBrigades = false;
          next.evaluationTypes = false;
          next.categoryTypes = false;
        } else if (scope === 'groups') {
          next.fireBrigades = false;
        } else if (scope === 'evaluationTypes') {
          next.categoryTypes = false;
        }
      }

      return next;
    });
  };

  const hasSelectedScope = Object.values(scopes).some(Boolean);

  const handleResetDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmationInput !== uiText.admin.logs.reset.keyword || !hasSelectedScope) return;

    setResetting(true);
    setResetError(null);

    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationKeyword: confirmationInput,
          scopes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.logs.reset.error(res.status));
      }

      const data = await res.json();
      onSuccess(data.message || uiText.admin.logs.reset.success);
      setConfirmationInput('');
      setScopes(DEFAULT_SCOPES);
      onClose();
    } catch (err: any) {
      setResetError(err.message || uiText.admin.logs.reset.fallback);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-4 sm:p-6 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-red-700 flex items-center space-x-2">
            <AlertTriangle size={20} className="text-red-600 shrink-0" />
            <span>{uiText.admin.logs.reset.title}</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              setConfirmationInput('');
              setResetError(null);
              setScopes(DEFAULT_SCOPES);
              onClose();
            }}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleResetDatabase} className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {resetError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm font-semibold flex items-center space-x-2">
              <AlertTriangle size={18} />
              <span>{resetError}</span>
            </div>
          )}

          <div className="text-sm text-slate-600">
            <p>{uiText.admin.logs.reset.warning}</p>
          </div>

          {/* Hierarchical Scope Selection */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {uiText.admin.logs.reset.scopesTitle}
            </div>

            <div className="space-y-2 text-sm">
              {/* 1. Zeiteinträge */}
              <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                <input
                  type="checkbox"
                  name="scope-category-entries"
                  checked={scopes.categoryEntries}
                  onChange={(e) => handleToggleScope('categoryEntries', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer accent-indigo-600"
                />
                <div>
                  <div className="font-semibold text-slate-800">{uiText.admin.logs.reset.scopeCategoryEntries}</div>
                  <div className="text-xs text-slate-500">{uiText.admin.logs.reset.scopeCategoryEntriesDesc}</div>
                </div>
              </label>

              {/* Children under Zeiteinträge */}
              <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-3">
                {/* 2. Gruppen */}
                <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    name="scope-groups"
                    checked={scopes.groups}
                    onChange={(e) => handleToggleScope('groups', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer accent-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{uiText.admin.logs.reset.scopeGroups}</div>
                    <div className="text-xs text-slate-500">{uiText.admin.logs.reset.scopeGroupsDesc}</div>
                  </div>
                </label>

                {/* 3. Feuerwehren */}
                <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-3">
                  <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      name="scope-fire-brigades"
                      checked={scopes.fireBrigades}
                      onChange={(e) => handleToggleScope('fireBrigades', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">{uiText.admin.logs.reset.scopeFireBrigades}</div>
                      <div className="text-xs text-slate-500">{uiText.admin.logs.reset.scopeFireBrigadesDesc}</div>
                    </div>
                  </label>
                </div>

                {/* 4. Wertungen */}
                <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                  <input
                    type="checkbox"
                    name="scope-evaluation-types"
                    checked={scopes.evaluationTypes}
                    onChange={(e) => handleToggleScope('evaluationTypes', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer accent-indigo-600"
                  />
                  <div>
                    <div className="font-semibold text-slate-800">{uiText.admin.logs.reset.scopeEvaluationTypes}</div>
                    <div className="text-xs text-slate-500">{uiText.admin.logs.reset.scopeEvaluationTypesDesc}</div>
                  </div>
                </label>

                {/* 5. Bewerbskategorien */}
                <div className="pl-6 space-y-2 border-l-2 border-slate-200 ml-3">
                  <label className="flex items-start space-x-3 cursor-pointer p-2 rounded-xl hover:bg-white transition-colors">
                    <input
                      type="checkbox"
                      name="scope-category-types"
                      checked={scopes.categoryTypes}
                      onChange={(e) => handleToggleScope('categoryTypes', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white cursor-pointer accent-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-slate-800">{uiText.admin.logs.reset.scopeCategoryTypes}</div>
                      <div className="text-xs text-slate-500">{uiText.admin.logs.reset.scopeCategoryTypesDesc}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {!hasSelectedScope && (
              <div className="text-xs text-amber-700 font-medium pt-1">
                ⚠️ {uiText.admin.logs.reset.atLeastOneScope}
              </div>
            )}
          </div>

          <div className="space-y-3 text-sm text-slate-600">
            <p className="font-medium">
              {uiText.admin.logs.reset.confirmBefore}{' '}
              <code className="bg-slate-100 px-2 py-0.5 rounded-lg text-red-600 font-mono font-bold select-all border border-slate-200">
                {uiText.admin.logs.reset.keyword}
              </code>{' '}
              {uiText.admin.logs.reset.confirmAfter}
            </p>
            <input
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:border-red-500 focus:ring-4 focus:ring-red-100 rounded-xl px-4 py-2.5 text-slate-800 font-mono uppercase tracking-widest text-center focus:outline-none transition-all shadow-sm"
              placeholder={uiText.admin.logs.reset.keyword}
              autoComplete="off"
              required
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setConfirmationInput('');
                setResetError(null);
                setScopes(DEFAULT_SCOPES);
                onClose();
              }}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-center"
              disabled={resetting}
            >
              {uiText.admin.logs.reset.cancel}
            </button>
            <button
              type="submit"
              disabled={confirmationInput !== uiText.admin.logs.reset.keyword || !hasSelectedScope || resetting}
              className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md shadow-red-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
            >
              {resetting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{uiText.admin.logs.reset.deleting}</span>
                </>
              ) : (
                <>
                  <Trash2 size={16} />
                  <span>{uiText.admin.logs.reset.deletePermanently}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
