import React, { useState, useEffect } from 'react';
import { CategoryTypesSection } from './settings/CategoryTypesSection';
import { EvaluationTypesSection } from './settings/EvaluationTypesSection';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { Layers, Award, Plus, Loader2, X, AlertTriangle, Trash2 } from 'lucide-react';

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
  showSingleResults?: boolean;
  public: boolean;
  publicTv: boolean;
  displayDurationSeconds: number;
  order: number;
}

export type SetupSubTab = 'category-types' | 'evaluation-types';

interface SetupSubTabConfig {
  id: SetupSubTab;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const SETUP_SUB_TABS: SetupSubTabConfig[] = [
  { id: 'category-types', label: uiText.admin.setup.classesAndCategories, icon: Layers },
  { id: 'evaluation-types', label: uiText.admin.setup.rankings, icon: Award },
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
        <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
        <p className="text-sm">{uiText.admin.setup.loading}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Sleek Segmented Sub-Tab Bar */}
      <AdminCard className="!p-1.5 sm:!p-2">
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
          {SETUP_SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex-1 min-w-[130px] px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </AdminCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2 font-semibold">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 p-1 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: KLASSEN & KATEGORIEN                                          */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'category-types' ? 'space-y-4' : 'hidden'}>

        {/* Wertungsklassen Section (Issue 02) */}
        <AdminCard className="!p-4 sm:!p-5">
          <div className="mb-3 pb-2.5 border-b border-slate-100">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <span>{uiText.admin.setup.competitionClasses}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                {competitionClasses.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {uiText.admin.setup.classesDescription}
            </p>
          </div>

          <form onSubmit={handleCreateCompetitionClass} className="flex gap-2 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <input
              type="text"
              placeholder={uiText.admin.setup.classNamePlaceholder}
              value={newClassName}
              onChange={e => setNewClassName(e.target.value)}
              className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all shadow-2xs"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-1.5 rounded-md font-bold transition-all shadow-2xs text-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              {uiText.admin.setup.createClass}
            </button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">{uiText.admin.setup.competitionClass}</th>
                  <th className="px-3 py-2 text-right">{uiText.admin.setup.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {competitionClasses.map(cc => (
                  <tr key={cc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-800">
                      <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700">
                        {cc.name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDeleteCompetitionClass(cc.id, cc.name)}
                        className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 focus:outline-none rounded-md transition-colors inline-flex items-center justify-center cursor-pointer"
                        title={uiText.admin.setup.deleteClassConfirm(cc.name)}
                        aria-label={uiText.admin.setup.deleteClassConfirm(cc.name)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {competitionClasses.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-slate-400 text-xs">
                      {uiText.admin.setup.noClasses}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>

        {/* Bewerbsklassen (CategoryTypes) */}
        <CategoryTypesSection
          categoryTypes={categoryTypes}
          competitionClasses={competitionClasses}
          onUpdateCategoryType={handleUpdateCategoryType}
          onRefresh={fetchData}
        />
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TAB: WERTUNGEN (EVALUATION TYPES)                                  */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'evaluation-types' ? 'space-y-4' : 'hidden'}>
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
