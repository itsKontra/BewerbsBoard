import React, { useState } from 'react';
import { uiText } from '../../../../ui-text';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 border border-red-900/60 rounded-2xl w-full max-w-lg shadow-2xl shadow-red-900/20 overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8">
        <div className="p-6 bg-red-950/20 border-b border-red-900/60 flex items-center justify-between">
          <h3 className="font-oswald text-xl font-bold text-red-400 uppercase tracking-wide flex items-center space-x-2">
            <span>⚠️</span>
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
            className="text-neutral-400 hover:text-white text-lg font-bold p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleResetDatabase} className="p-6 space-y-6">
          {resetError && (
            <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-xl text-sm font-semibold flex items-center space-x-2">
              <span>❌</span>
              <span>{resetError}</span>
            </div>
          )}

          <div className="text-sm text-neutral-300">
            <p>{uiText.admin.logs.reset.warning}</p>
          </div>

          {/* Hierarchical Scope Selection */}
          <div className="space-y-3 bg-neutral-950/80 p-4 rounded-xl border border-neutral-800">
            <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              {uiText.admin.logs.reset.scopesTitle}
            </div>

            <div className="space-y-2 text-sm">
              {/* 1. Zeiteinträge */}
              <label className="flex items-start space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
                <input
                  type="checkbox"
                  name="scope-category-entries"
                  checked={scopes.categoryEntries}
                  onChange={(e) => handleToggleScope('categoryEntries', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-900 cursor-pointer accent-red-600"
                />
                <div>
                  <div className="font-semibold text-white">{uiText.admin.logs.reset.scopeCategoryEntries}</div>
                  <div className="text-xs text-neutral-400">{uiText.admin.logs.reset.scopeCategoryEntriesDesc}</div>
                </div>
              </label>

              {/* Children under Zeiteinträge */}
              <div className="pl-6 space-y-2 border-l border-neutral-800 ml-3">
                {/* 2. Gruppen */}
                <label className="flex items-start space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
                  <input
                    type="checkbox"
                    name="scope-groups"
                    checked={scopes.groups}
                    onChange={(e) => handleToggleScope('groups', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-900 cursor-pointer accent-red-600"
                  />
                  <div>
                    <div className="font-semibold text-white">{uiText.admin.logs.reset.scopeGroups}</div>
                    <div className="text-xs text-neutral-400">{uiText.admin.logs.reset.scopeGroupsDesc}</div>
                  </div>
                </label>

                {/* 3. Feuerwehren */}
                <div className="pl-6 space-y-2 border-l border-neutral-800 ml-3">
                  <label className="flex items-start space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
                    <input
                      type="checkbox"
                      name="scope-fire-brigades"
                      checked={scopes.fireBrigades}
                      onChange={(e) => handleToggleScope('fireBrigades', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-900 cursor-pointer accent-red-600"
                    />
                    <div>
                      <div className="font-semibold text-white">{uiText.admin.logs.reset.scopeFireBrigades}</div>
                      <div className="text-xs text-neutral-400">{uiText.admin.logs.reset.scopeFireBrigadesDesc}</div>
                    </div>
                  </label>
                </div>

                {/* 4. Wertungen */}
                <label className="flex items-start space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
                  <input
                    type="checkbox"
                    name="scope-evaluation-types"
                    checked={scopes.evaluationTypes}
                    onChange={(e) => handleToggleScope('evaluationTypes', e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-900 cursor-pointer accent-red-600"
                  />
                  <div>
                    <div className="font-semibold text-white">{uiText.admin.logs.reset.scopeEvaluationTypes}</div>
                    <div className="text-xs text-neutral-400">{uiText.admin.logs.reset.scopeEvaluationTypesDesc}</div>
                  </div>
                </label>

                {/* 5. Bewerbskategorien */}
                <div className="pl-6 space-y-2 border-l border-neutral-800 ml-3">
                  <label className="flex items-start space-x-3 cursor-pointer p-1.5 rounded-lg hover:bg-neutral-900 transition-colors">
                    <input
                      type="checkbox"
                      name="scope-category-types"
                      checked={scopes.categoryTypes}
                      onChange={(e) => handleToggleScope('categoryTypes', e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-neutral-700 text-red-600 focus:ring-red-500 bg-neutral-900 cursor-pointer accent-red-600"
                    />
                    <div>
                      <div className="font-semibold text-white">{uiText.admin.logs.reset.scopeCategoryTypes}</div>
                      <div className="text-xs text-neutral-400">{uiText.admin.logs.reset.scopeCategoryTypesDesc}</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {!hasSelectedScope && (
              <div className="text-xs text-amber-400 font-medium pt-1">
                ⚠️ {uiText.admin.logs.reset.atLeastOneScope}
              </div>
            )}
          </div>

          <div className="space-y-4 text-sm text-neutral-300">
            <p className="font-semibold text-white">
              {uiText.admin.logs.reset.confirmBefore}{' '}
              <code className="bg-neutral-800 px-2 py-0.5 rounded text-red-400 select-all shadow-inner">
                {uiText.admin.logs.reset.keyword}
              </code>{' '}
              {uiText.admin.logs.reset.confirmAfter}
            </p>
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
                setScopes(DEFAULT_SCOPES);
                onClose();
              }}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500/50"
              disabled={resetting}
            >
              {uiText.admin.logs.reset.cancel}
            </button>
            <button
              type="submit"
              disabled={confirmationInput !== uiText.admin.logs.reset.keyword || !hasSelectedScope || resetting}
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

