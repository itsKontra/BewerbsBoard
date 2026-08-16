import React, { useState, useEffect } from 'react';
import { CategoryTypesSection } from './settings/CategoryTypesSection';
import { EvaluationTypesSection } from './settings/EvaluationTypesSection';
import { uiText } from '../../../ui-text';

// ---- Domain types --------------------------------------------------------

export interface CategoryType {
  id: string;
  name: string;
  competitionClassId: string;
  hasRelayRace: boolean;
}

export interface CompetitionClass {
  id: string;
  name: string;
}

export interface EvaluationType {
  id: string;
  name: string;
  categoryTypeId1: string;
  categoryTypeName1?: string;
  hasRelayRace1?: boolean;
  categoryTypeId2?: string | null;
  categoryTypeName2?: string | null;
  hasRelayRace2?: boolean;
  excludeRelayRace: boolean;
  isBrigadePairing: boolean;
  public: boolean;
  publicTv: boolean;
  displayDurationSeconds: number;
  order: number;
}


export type SetupSubTab = 'category-types' | 'evaluation-types';

interface SetupSubTabConfig {
  id: SetupSubTab;
  label: string;
  icon: string;
}

const SETUP_SUB_TABS: SetupSubTabConfig[] = [
  { id: 'category-types', label: uiText.admin.setup.classesAndCategories, icon: '🏃' },
  { id: 'evaluation-types', label: uiText.admin.setup.rankings, icon: '🏆' },
];

export function SetupTab() {
  const [activeSubTab, setActiveSubTab] = useState<SetupSubTab>('category-types');

  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([]);
  const [competitionClasses, setCompetitionClasses] = useState<CompetitionClass[]>([]);
  const [evaluationTypes, setEvaluationTypes] = useState<EvaluationType[]>([]);

  // Wertungsklassen CRUD state (Issue 02)
  const [newClassName, setNewClassName] = useState('');


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catTypesRes, compClassesRes, evalTypesRes] = await Promise.all([
        fetch('/api/admin/category-types').catch(() => null),
        fetch('/api/admin/competition-classes').catch(() => null),
        fetch('/api/admin/evaluation-types').catch(() => null),
      ]);

      const types = (catTypesRes && catTypesRes.ok ? await catTypesRes.json().catch(() => []) : []) as CategoryType[];
      const classes = (compClassesRes && compClassesRes.ok ? await compClassesRes.json().catch(() => []) : []) as CompetitionClass[];
      const evaluations = (evalTypesRes && evalTypesRes.ok ? await evalTypesRes.json().catch(() => []) : []) as EvaluationType[];

      setCategoryTypes(types);
      setCompetitionClasses(classes);
      setEvaluationTypes(evaluations);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.setup.unknownError);
    } finally {
      setLoading(false);
    }
  };

  // ---- Wertungsklassen CRUD handlers (Issue 02) ----------------------------

  const handleCreateCompetitionClass = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/competition-classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || uiText.admin.setup.createClassError);
      }
      setNewClassName('');
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.setup.genericError);
    }
  };

  const handleDeleteCompetitionClass = async (id: string, name: string) => {
    if (!window.confirm(uiText.admin.setup.deleteClassConfirm(name))) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/competition-classes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || uiText.admin.setup.deleteClassError);
      }
      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.setup.genericError);
    }
  };

  // ---- Category type / evaluation type update handlers --------------------

  const handleUpdateCategoryType = async (id: string, updates: Partial<CategoryType>) => {
    setCategoryTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    try {
      const res = await fetch(`/api/admin/category-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.setup.updateError(res.status));
      }

      const updated = await res.json();
      setCategoryTypes((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
    } catch (err) {
      await fetchData();
      throw err;
    }
  };

  const handleUpdateEvaluationType = async (id: string, updates: Partial<EvaluationType>) => {
    setEvaluationTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );

    try {
      const res = await fetch(`/api/admin/evaluation-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.setup.updateError(res.status));
      }

      const updated = await res.json();
      setEvaluationTypes((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
      );
    } catch {
      await fetchData();
    }
  };

  if (loading && categoryTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-oswald uppercase tracking-wider text-sm">{uiText.admin.setup.loading}</p>
      </div>
    );
  }

  // (No entries/groups derived state — Startreihenfolge moved to ParticipantsTab)

  return (
    <div className="space-y-6 pb-20 @container">
      {/* Sleek Segmented Sub-Tab Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1.5 shadow-md">
        {SETUP_SUB_TABS.map((tab) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex-1 min-w-[140px] px-4 py-2 rounded-lg text-xs @sm:text-sm font-semibold transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500/50 ${
                isActive
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/60 font-bold border border-red-500/50'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2.5 text-sm font-semibold">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white text-xs font-mono ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: KLASSEN & KATEGORIEN                                          */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'category-types' ? 'space-y-6' : 'hidden'}>

        {/* Wertungsklassen Section (Issue 02) */}
        <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <span>{uiText.admin.setup.competitionClasses}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                {competitionClasses.length}
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              {uiText.admin.setup.classesDescription}
            </p>
          </div>

          <form onSubmit={handleCreateCompetitionClass} className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder={uiText.admin.setup.classNamePlaceholder}
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors"
            />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm text-sm"
            >
              {uiText.admin.setup.createClass}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 rounded-l-lg">{uiText.admin.setup.competitionClass}</th>
                  <th className="px-4 py-2.5 rounded-r-lg text-right">{uiText.admin.setup.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {competitionClasses.map(cc => (
                  <tr key={cc.id} className="hover:bg-neutral-800/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-neutral-200">
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200">
                        {cc.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteCompetitionClass(cc.id, cc.name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors text-xs font-medium"
                      >
                        {uiText.admin.setup.delete}
                      </button>
                    </td>
                  </tr>
                ))}
                {competitionClasses.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-4 text-center text-neutral-500">
                      {uiText.admin.setup.noClasses}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Bewerbsklassen (CategoryTypes) */}
        <CategoryTypesSection
          categoryTypes={categoryTypes}
          competitionClasses={competitionClasses}
          onUpdateCategoryType={handleUpdateCategoryType}
          onRefresh={fetchData}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. SUB-TAB: WERTUNGEN (EVALUATION TYPES)                                  */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'evaluation-types' ? 'space-y-6' : 'hidden'}>
        <EvaluationTypesSection
          evaluationTypes={evaluationTypes}
          categoryTypes={categoryTypes}
          onUpdateEvaluationType={handleUpdateEvaluationType}
          onRefresh={fetchData}
        />
      </div>
    </div>
  );
}
