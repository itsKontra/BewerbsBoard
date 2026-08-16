import React, { useState } from 'react';
import type { CategoryType, CompetitionClass } from '../SetupTab';
import { uiText } from '../../../../ui-text';

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
    <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="border-b border-neutral-800 pb-3">
        <h3 className="font-oswald text-lg font-bold text-white uppercase tracking-wider">
          {text.title}
        </h3>
        <p className="text-xs text-neutral-400">
          {text.description}
        </p>
      </div>

      {/* Action Alerts */}
      {actionError && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-lg flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3 rounded-lg flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <span>✅</span>
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create Category Type Section */}
      <div className="bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 space-y-4">
        <div className="text-xs font-bold text-neutral-200 uppercase tracking-wide">
          {text.createTitle}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-6">
            <label htmlFor="newCategoryName" className="block text-[11px] font-bold uppercase text-neutral-400 mb-1">
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
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4 flex items-center h-9">
            <label className="flex items-center space-x-2 cursor-pointer select-none">
              <input
                id="newCategoryHasRelay"
                type="checkbox"
                checked={formData.hasRelayRace}
                onChange={(e) => setFormData((prev) => ({ ...prev, hasRelayRace: e.target.checked }))}
                className="w-4 h-4 accent-red-600 rounded bg-neutral-900 border-neutral-700 cursor-pointer"
              />
              <span className="text-xs font-semibold text-neutral-300">
                {text.hasRelayRace}
              </span>
            </label>
          </div>

          <div className="sm:col-span-4">
            <label htmlFor="newCategoryCompetitionClass" className="block text-[11px] font-bold uppercase text-neutral-400 mb-1">
              {text.competitionCategory}
            </label>
            <select
              id="newCategoryCompetitionClass"
              value={formData.competitionClassId}
              onChange={(e) => setFormData((prev) => ({ ...prev, competitionClassId: e.target.value }))}
              className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value="">{text.selectClass}</option>
              {competitionClasses.map((competitionClass) => (
                <option key={competitionClass.id} value={competitionClass.id}>{competitionClass.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleCreateCategoryType}
              disabled={isCreating || !formData.name.trim() || !formData.competitionClassId}
              className="w-full h-9 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider font-oswald rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
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
      </div>

      {/* List of Category Types */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-neutral-950 text-neutral-400 font-oswald text-xs uppercase tracking-wider border-b border-neutral-800">
              <th className="py-3 px-4 rounded-l-lg">{text.name}</th>
              <th className="py-3 px-4">{text.competitionClass}</th>
              <th className="py-3 px-4 text-center">{text.relayColumn}</th>
              <th className="py-3 px-4 text-right rounded-r-lg">{text.action}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/80">
            {categoryTypes.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-xs text-neutral-500 italic">
                  {text.empty}
                </td>
              </tr>
            ) : (
              categoryTypes.map((cat) => {
                const isEditing = editingId === cat.id;

                return (
                  <tr key={cat.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-4">
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
                            className="bg-neutral-950 border border-red-600 rounded px-2 py-1 text-xs text-white focus:outline-none min-w-[160px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(cat.id)}
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
                          <span className="font-semibold text-white">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(cat)}
                            className="text-neutral-500 hover:text-amber-400 text-xs transition-colors p-1 rounded hover:bg-neutral-800 cursor-pointer"
                            title={text.edit(cat.name)}
                            aria-label={text.edit(cat.name)}
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-300 text-xs">
                      {competitionClasses.find((competitionClass) => competitionClass.id === cat.competitionClassId)?.name ?? cat.competitionClassId}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {cat.hasRelayRace ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                          {text.withRelay}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 border border-neutral-700 text-neutral-400">
                          {text.withoutRelay}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCategoryType(cat.id, cat.name)}
                        disabled={deletingId === cat.id}
                        className="p-1.5 px-2.5 rounded bg-neutral-800 hover:bg-red-950/60 hover:text-red-300 hover:border-red-800 text-neutral-400 text-xs border border-neutral-700 transition-colors disabled:opacity-50 cursor-pointer"
                        title={text.delete(cat.name)}
                      >
                        {deletingId === cat.id ? text.deleting : text.deleteButton}
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
