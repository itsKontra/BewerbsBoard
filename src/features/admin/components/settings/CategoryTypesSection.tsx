import React, { useState } from 'react';
import type { CategoryType, CompetitionClass } from '../SetupTab';
import { uiText } from '../../../../ui-text';
import { AdminCard } from '../AdminCard';
import { Plus, Edit2, Check, X, AlertTriangle, CheckCircle2, Trash2, Loader2 } from 'lucide-react';

const text = uiText.admin.setup.categoryTypes;

export interface CategoryTypesSectionProps {
  categoryTypes: CategoryType[];
  competitionClasses: CompetitionClass[];
  onUpdateCategoryType?: (id: string, updates: Partial<CategoryType>) => Promise<void>;
  onRefresh: () => Promise<void>;
}

interface CategoryFormData {
  name: string;
  competitionClassId: string;
  hasRelayRace: boolean;
}

const INITIAL_FORM_DATA: CategoryFormData = {
  name: '',
  competitionClassId: '',
  hasRelayRace: true,
};

export function CategoryTypesSection({
  categoryTypes,
  competitionClasses,
  onUpdateCategoryType,
  onRefresh,
}: CategoryTypesSectionProps) {
  const [formData, setFormData] = useState<CategoryFormData>(INITIAL_FORM_DATA);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const handleCreateCategoryType = async (e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault();
    const trimmedName = formData.name.trim();
    if (!trimmedName) return;

    setIsCreating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const payload: { name: string; competitionClassId: string; hasRelayRace: boolean } = {
        name: trimmedName,
        competitionClassId: formData.competitionClassId,
        hasRelayRace: formData.hasRelayRace,
      };

      const res = await fetch('/api/admin/category-types', {
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

  const handleStartEdit = (cat: CategoryType) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
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

    if (!onUpdateCategoryType) return;

    setIsSavingEdit(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await onUpdateCategoryType(id, { name: trimmed });
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

  const handleDeleteCategoryType = async (id: string, name: string) => {
    if (!window.confirm(text.deleteConfirm(name))) {
      return;
    }

    setDeletingId(id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/admin/category-types/${id}`, {
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

  return (
    <AdminCard className="space-y-6">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-lg font-bold text-slate-800">
          {text.title}
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          {text.description}
        </p>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between text-sm font-medium shadow-sm">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={18} />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-700 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center justify-between text-sm font-medium shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={18} />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-700 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Create Category Type Section */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          {text.createTitle}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label htmlFor="newCategoryName" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              {text.categoryName}
            </label>
            <input
              id="newCategoryName"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCategoryType(e);
                }
              }}
              placeholder={text.namePlaceholder}
              className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none shadow-sm transition-all"
            />
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="newCategoryCompetitionClass" className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              {text.competitionCategory}
            </label>
            <select
              id="newCategoryCompetitionClass"
              value={formData.competitionClassId}
              onChange={(e) => setFormData((prev) => ({ ...prev, competitionClassId: e.target.value }))}
              className="w-full bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none shadow-sm transition-all"
            >
              <option value="">{text.selectClass}</option>
              {competitionClasses.map((competitionClass) => (
                <option key={competitionClass.id} value={competitionClass.id}>{competitionClass.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3 flex items-center h-10">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                id="newCategoryHasRelay"
                type="checkbox"
                checked={formData.hasRelayRace}
                onChange={(e) => setFormData((prev) => ({ ...prev, hasRelayRace: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600 rounded bg-white border-slate-300 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700">
                {text.hasRelayRace}
              </span>
            </label>
          </div>

          <div className="sm:col-span-12 flex justify-end">
            <button
              type="button"
              onClick={handleCreateCategoryType}
              disabled={isCreating || !formData.name.trim() || !formData.competitionClassId}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              {isCreating ? (
                <span>{text.creating}</span>
              ) : (
                <>
                  <Plus size={16} />
                  <span>{text.create}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* List of Category Types */}
      <div className="overflow-x-auto rounded-2xl border border-slate-100">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="py-3 px-4">{text.name}</th>
              <th className="py-3 px-4">{text.competitionClass}</th>
              <th className="py-3 px-4 text-center">{text.relayColumn}</th>
              <th className="py-3 px-4 text-right">{text.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {categoryTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-xs text-slate-400 italic">
                  {text.empty}
                </td>
              </tr>
            ) : (
              categoryTypes.map((cat) => {
                const isEditing = editingId === cat.id;

                return (
                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      {isEditing ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            aria-label={text.categoryNameFor(cat.name)}
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEdit(cat.id);
                              } else if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                            autoFocus
                            className="bg-white border border-indigo-400 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none min-w-[160px] shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
                            disabled={isSavingEdit || !editingName.trim()}
                            className="p-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors cursor-pointer"
                            title={text.save}
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={isSavingEdit}
                            className="p-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition-colors cursor-pointer"
                            title={text.cancel}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 group">
                          <span className="font-semibold text-slate-800">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="text-slate-400 hover:text-indigo-600 text-xs transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer"
                            title={text.edit(cat.name)}
                            aria-label={text.edit(cat.name)}
                          >
                            <Edit2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {competitionClasses.find((competitionClass) => competitionClass.id === cat.competitionClassId)?.name ?? cat.competitionClassId}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {cat.hasRelayRace ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-900">
                          {text.withRelay}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                          {text.withoutRelay}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryType(cat.id, cat.name)}
                        disabled={deletingId === cat.id}
                        className="p-2 text-slate-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center cursor-pointer"
                        title={text.delete(cat.name)}
                        aria-label={text.delete(cat.name)}
                      >
                        {deletingId === cat.id ? <Loader2 size={16} className="animate-spin text-slate-400" /> : <Trash2 size={16} />}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}
