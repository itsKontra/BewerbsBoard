import React, { useState } from 'react';
import type { CategoryType, EvaluationType } from '../SetupTab';
import { uiText } from '../../../../ui-text';

const text = uiText.admin.setup.evaluationTypes;

export interface EvaluationTypesSectionProps {
  evaluationTypes: EvaluationType[];
  categoryTypes: CategoryType[];
  onUpdateEvaluationType: (id: string, updates: Partial<EvaluationType>) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface EvaluationFormData {
  name: string;
  categoryTypeId1: string;
  categoryTypeId2: string;
  excludeRelayRace: boolean;
  isBrigadePairing: boolean;
  displayDurationSeconds: number;
}

const INITIAL_FORM_DATA: EvaluationFormData = {
  name: '',
  categoryTypeId1: '',
  categoryTypeId2: '',
  excludeRelayRace: false,
  isBrigadePairing: false,
  displayDurationSeconds: 10,
};

export function EvaluationTypesSection({
  evaluationTypes,
  categoryTypes,
  onUpdateEvaluationType,
  onRefresh,
}: EvaluationTypesSectionProps) {
  const [formData, setFormData] = useState<EvaluationFormData>(INITIAL_FORM_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleCreateEvaluationType = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) return;

    const cat1Id = formData.categoryTypeId1 || (categoryTypes[0]?.id ?? '');
    if (!cat1Id) {
      setActionError(text.selectCategoryError);
      return;
    }

    // Cross-class guard: if cat1 and cat2 are from different Wertungsklassen, Wehr-Paarung is mandatory
    const cat1 = categoryTypes.find((c) => c.id === cat1Id);
    const cat2Id = formData.categoryTypeId2.trim();
    const cat2 = cat2Id ? categoryTypes.find((c) => c.id === cat2Id) : undefined;
    const crossClass = !!(cat1 && cat2 && cat1.competitionClassId !== cat2.competitionClassId);

    setIsCreating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const payload: {
        name: string;
        categoryTypeId1: string;
        categoryTypeId2?: string | null;
        excludeRelayRace: boolean;
        isBrigadePairing: boolean;
        public: boolean;
        publicTv: boolean;
        displayDurationSeconds: number;
        order?: number;
      } = {
        name: trimmedName,
        categoryTypeId1: cat1Id,
        categoryTypeId2: cat2Id ? cat2Id : null,
        excludeRelayRace: formData.excludeRelayRace,
        // Force Wehr-Paarung when cross-class (Issue 04)
        isBrigadePairing: cat2Id ? (crossClass || formData.isBrigadePairing) : false,
        public: true,
        publicTv: true,
        displayDurationSeconds: Number(formData.displayDurationSeconds) || 10,
        order: evaluationTypes.length + 1,
      };

      const res = await fetch('/api/admin/evaluation-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || text.createError(res.status));
      }

      const created = await res.json();
      setFormData(INITIAL_FORM_DATA);
      setActionSuccess(text.created(created.name));
      setTimeout(() => setActionSuccess(null), 4000);
      await onRefresh();
    } catch (err: any) {
      setActionError(err.message || text.createFallback);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (evalItem: EvaluationType) => {
    setEditingId(evalItem.id);
    setEditingName(evalItem.name);
    setActionError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setActionError(text.emptyName);
      return;
    }

    setIsSavingEdit(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await onUpdateEvaluationType(id, { name: trimmed });
      setEditingId(null);
      setEditingName('');
      setActionSuccess(text.updated(trimmed));
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err.message || text.updateFallback);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteEvaluationType = async (id: string, name: string) => {
    if (!window.confirm(text.deleteConfirm(name))) {
      return;
    }

    setDeletingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/evaluation-types/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || text.deleteError(res.status));
      }

      setActionSuccess(text.deleted(name));
      setTimeout(() => setActionSuccess(null), 4000);
      await onRefresh();
    } catch (err: any) {
      setActionError(err.message || text.deleteFallback);
    } finally {
      setDeletingId(null);
    }
  };

  // Derive cross-class state for the form UI (Issue 04)
  const formCat1 = categoryTypes.find((c) => c.id === (formData.categoryTypeId1 || categoryTypes[0]?.id));
  const formCat2 = formData.categoryTypeId2.trim() ? categoryTypes.find((c) => c.id === formData.categoryTypeId2) : undefined;
  const formCrossClass = !!(formCat1 && formCat2 && formCat1.competitionClassId !== formCat2.competitionClassId);

  return (
    <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-3">
        <div>
          <h3 className="font-oswald text-lg font-bold text-white uppercase tracking-wider">
            {text.title}
          </h3>
          <p className="text-xs text-neutral-400">
            {text.description}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              evaluationTypes.forEach((e) => onUpdateEvaluationType(e.id, { public: true }));
            }}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
          >
            {text.enableAllWeb}
          </button>
          <button
            type="button"
            onClick={() => {
              evaluationTypes.forEach((e) => onUpdateEvaluationType(e.id, { publicTv: true }));
            }}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300 border border-neutral-700 transition-colors cursor-pointer"
          >
            {text.enableAllTv}
          </button>
        </div>
      </div>

      {/* Evaluation Action Alerts */}
      {actionError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-semibold">{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-white font-mono text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-lg flex items-center justify-between text-xs shadow-md">
          <div className="flex items-center space-x-2">
            <span>✅</span>
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white font-mono text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Evaluation Creation Form */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-4 space-y-4 shadow-inner">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center space-x-2">
          <span>➕</span>
          <span>{text.createTitle}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label htmlFor="newEvaluationName" className="block text-[11px] font-bold uppercase text-neutral-400 mb-1">
              {text.evaluationName}
            </label>
            <input
              id="newEvaluationName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateEvaluationType(e);
                }
              }}
              placeholder={text.namePlaceholder}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="newEvaluationCat1" className="block text-[11px] font-bold uppercase text-neutral-400 mb-1">
              {text.category1}
            </label>
            <select
              id="newEvaluationCat1"
              value={formData.categoryTypeId1 || (categoryTypes[0]?.id ?? '')}
              onChange={(e) => setFormData((prev) => ({ ...prev, categoryTypeId1: e.target.value }))}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
            >
              {categoryTypes.length === 0 ? (
                <option value="">{text.noCategories}</option>
              ) : (
                categoryTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="newEvaluationCat2" className="block text-[11px] font-bold uppercase text-neutral-400 mb-1">
              {text.category2}
            </label>
            <select
              id="newEvaluationCat2"
              value={formData.categoryTypeId2}
              onChange={(e) => {
                const cat2Val = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  categoryTypeId2: cat2Val,
                  isBrigadePairing: cat2Val.trim() ? prev.isBrigadePairing : false,
                }));
              }}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">{text.noSecondCategory}</option>
              {categoryTypes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Checkboxes and Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 border-t border-neutral-800/60">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                id="newEvaluationExcludeRelay"
                type="checkbox"
                checked={formData.excludeRelayRace}
                onChange={(e) => setFormData((prev) => ({ ...prev, excludeRelayRace: e.target.checked }))}
                className="w-4 h-4 accent-red-600 rounded bg-neutral-900 border-neutral-700 cursor-pointer"
              />
              <span className="text-xs font-semibold text-neutral-300">
                {text.excludeRelay}
              </span>
            </label>

            <label
              className={`flex items-center space-x-2 select-none ${
                formData.categoryTypeId2.trim() && !formCrossClass ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                id="newEvaluationBrigadePairing"
                type="checkbox"
                disabled={!formData.categoryTypeId2.trim() || formCrossClass}
                checked={formData.categoryTypeId2.trim() ? (formCrossClass ? true : formData.isBrigadePairing) : false}
                onChange={(e) => {
                  if (formData.categoryTypeId2.trim() && !formCrossClass) {
                    setFormData((prev) => ({ ...prev, isBrigadePairing: e.target.checked }));
                  }
                }}
                className="w-4 h-4 accent-amber-500 rounded bg-neutral-900 border-neutral-700 cursor-pointer disabled:cursor-not-allowed"
              />
              <span
                className={`text-xs font-semibold ${
                  formData.categoryTypeId2.trim() ? 'text-amber-300' : 'text-neutral-500'
                }`}
                title={
                  formCrossClass
                    ? text.pairingRequiredTitle
                    : formData.categoryTypeId2.trim()
                      ? text.pairingAvailableTitle
                      : text.pairingUnavailableTitle
                }
              >
                {text.pairing}
              </span>
              {formCrossClass && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-amber-300 whitespace-nowrap">
                  {text.pairingRequired}
                </span>
              )}
            </label>

            <div className="flex items-center space-x-2">
              <label htmlFor="newEvaluationDuration" className="text-xs font-semibold text-neutral-400">
                {text.tvDuration}
              </label>
              <input
                id="newEvaluationDuration"
                type="number"
                min={1}
                max={300}
                value={formData.displayDurationSeconds}
                onChange={(e) => setFormData((prev) => ({ ...prev, displayDurationSeconds: Math.max(1, parseInt(e.target.value, 10) || 10) }))}
                className="w-16 bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-2 py-1 text-center font-mono text-xs text-white focus:outline-none"
              />
              <span className="text-xs text-neutral-500 font-mono">{text.seconds}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateEvaluationType}
            disabled={isCreating || !formData.name.trim() || categoryTypes.length === 0}
            className="h-9 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider font-oswald rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-md"
          >
            {isCreating ? (
              <span>{text.creating}</span>
            ) : (
              <>
                <span>+</span>
                <span>{text.create}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* List of Evaluation Types */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-neutral-950 text-neutral-400 font-oswald text-xs uppercase tracking-wider border-b border-neutral-800">
              <th className="py-3.5 px-4 rounded-l-lg">{text.name}</th>
              <th className="py-3.5 px-4">{text.composition}</th>
              <th className="py-3.5 px-4 text-center">{text.web}</th>
              <th className="py-3.5 px-4 text-center">{text.tv}</th>
              <th className="py-3.5 px-4 text-center">{text.duration}</th>
              <th className="py-3.5 px-4 text-right rounded-r-lg">{text.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80">
            {evaluationTypes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-xs text-neutral-500 italic">
                  {text.empty}
                </td>
              </tr>
            ) : (
              evaluationTypes.map((evalItem) => {
                const isEditing = editingId === evalItem.id;

                return (
                  <tr key={evalItem.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            aria-label={text.evaluationNameFor(evalItem.name)}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEdit(evalItem.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                            className="bg-neutral-950 border border-red-600 rounded px-2 py-1 text-xs text-white focus:outline-none min-w-[160px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(evalItem.id)}
                            disabled={isSavingEdit || !editingName.trim()}
                            className="p-1 px-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                            title={text.save}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="p-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs transition-colors cursor-pointer"
                            title={text.cancel}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group">
                          <span className="font-semibold text-white">{evalItem.name}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(evalItem)}
                            className="text-neutral-500 hover:text-amber-400 text-xs transition-colors p-1 rounded hover:bg-neutral-800 cursor-pointer"
                            title={text.edit(evalItem.name)}
                            aria-label={text.edit(evalItem.name)}
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                          {evalItem.categoryTypeName1 || evalItem.categoryTypeId1}
                        </span>
                        {evalItem.categoryTypeId2 && (
                          <>
                            <span className="text-neutral-500 text-xs">+</span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {evalItem.categoryTypeName2 || evalItem.categoryTypeId2}
                            </span>
                          </>
                        )}
                        {evalItem.isBrigadePairing && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950/80 border border-amber-700/60 text-amber-300" title={text.pairingTitle}>
                            {text.pairingBadge}
                          </span>
                        )}
                        {evalItem.excludeRelayRace ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-900 border border-neutral-700 text-neutral-400">
                            {text.withoutRelay}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 border border-emerald-800/60 text-emerald-300">
                            {text.withRelay}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        aria-label={text.webVisibility(evalItem.name)}
                        checked={evalItem.public}
                        onChange={(e) => onUpdateEvaluationType(evalItem.id, { public: e.target.checked })}
                        className="w-4 h-4 accent-red-600 rounded bg-neutral-950 border-neutral-700 focus:ring-0 cursor-pointer"
                        title={text.webVisibilityTitle}
                      />
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="checkbox"
                        aria-label={text.tvVisibility(evalItem.name)}
                        checked={evalItem.publicTv}
                        onChange={(e) => onUpdateEvaluationType(evalItem.id, { publicTv: e.target.checked })}
                        className="w-4 h-4 accent-red-600 rounded bg-neutral-950 border-neutral-700 focus:ring-0 cursor-pointer"
                        title={text.tvVisibilityTitle}
                      />
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <input
                        type="number"
                        aria-label={text.tvDurationFor(evalItem.name)}
                        min={1}
                        max={300}
                        value={evalItem.displayDurationSeconds ?? 10}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 10);
                          onUpdateEvaluationType(evalItem.id, { displayDurationSeconds: val });
                        }}
                        className="w-16 bg-neutral-950 border border-neutral-800 focus:border-red-600 rounded-md px-2 py-1 text-center font-mono text-xs text-white focus:outline-none transition-colors mx-auto"
                      />
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteEvaluationType(evalItem.id, evalItem.name)}
                        disabled={deletingId === evalItem.id}
                        className="p-1.5 px-2.5 rounded bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-800 text-neutral-400 text-xs border border-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
                        title={text.delete(evalItem.name)}
                      >
                        {deletingId === evalItem.id ? text.deleting : text.deleteButton}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
