import { useState, useEffect } from 'react';
import { rankEntries } from '../../../../shared/domain/ranking';
import { type CategoryEntry as ScoringCategoryEntry } from '../../../../shared/domain/scoring';
import { parseGermanTimeToHundredths, formatHundredthsToGerman } from '../../../../shared/utils/time-parser';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { Timer, Trophy, XCircle, Loader2, Search } from 'lucide-react';

export interface CategoryType {
  id: string;
  name: string;
  competitionClassId?: string;
  hasRelayRace: boolean;
}

export interface CompetitionClass {
  id: string;
  name: string;
}

export interface CategoryEntry {
  id: string;
  groupId: string;
  categoryTypeId?: string;
  categoryTypeName?: string;
  hasRelayRace?: boolean;
  runStatus: 'OPEN' | 'VALID' | 'DNF';
  startOrderPosition: number | null;
  scoreHundredths?: number | null;
  errors?: number | null;
  attackTimeHundredths: number | null;
  attackTimeErrors: number | null;
  relayRaceHundredths: number | null;
  relayRaceErrors: number | null;
  groupName: string;
  competitionClass: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
}

const FALLBACK_CATEGORIES: CategoryType[] = [];


interface FormState {
  attackTimeStr: string;
  errorsStr: string;
  relayRaceTimeStr: string;
  relayRaceErrorsStr: string;
}

export function ResultsTab() {
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>(FALLBACK_CATEGORIES);
  const [competitionClasses, setCompetitionClasses] = useState<CompetitionClass[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [entries, setEntries] = useState<CategoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form input state per entry
  const [inputForms, setInputForms] = useState<Record<string, FormState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [catTypesRes, compClassesRes, entriesRes] = await Promise.all([
        fetch('/api/admin/category-types').catch(() => null),
        fetch('/api/admin/competition-classes').catch(() => null),
        fetch('/api/admin/category-entries'),
      ]);

      if (compClassesRes && compClassesRes.ok) {
        const classes = (await compClassesRes.json()) as CompetitionClass[];
        if (classes && classes.length > 0) {
          setCompetitionClasses(classes);
        }
      }

      if (catTypesRes && catTypesRes.ok) {
        const types = (await catTypesRes.json()) as CategoryType[];
        if (types && types.length > 0) {
          setCategoryTypes(types);
        }
      }

      if (!entriesRes.ok) throw new Error(uiText.admin.results.loadDataError);
      const data = (await entriesRes.json()) as CategoryEntry[];
      setEntries(data);

      // Initialize form input states for entries
      const forms: Record<string, FormState> = {};
      data.forEach((e) => {
        const errorsVal = e.attackTimeErrors !== null && e.attackTimeErrors !== undefined
          ? e.attackTimeErrors
          : e.errors;
        forms[e.id] = {
          attackTimeStr: formatHundredthsToGerman(e.attackTimeHundredths),
          errorsStr: errorsVal !== null && errorsVal !== undefined ? String(errorsVal) : '',
          relayRaceTimeStr: formatHundredthsToGerman(e.relayRaceHundredths),
          relayRaceErrorsStr: e.relayRaceErrors !== null && e.relayRaceErrors !== undefined ? String(e.relayRaceErrors) : '',
        };
      });
      setInputForms(forms);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.results.loadError);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    entryId: string,
    field: keyof FormState,
    value: string
  ) => {
    setInputForms((prev) => ({
      ...prev,
      [entryId]: {
        ...(prev[entryId] || { attackTimeStr: '', errorsStr: '', relayRaceTimeStr: '', relayRaceErrorsStr: '' }),
        [field]: value,
      },
    }));
  };

  const handleSaveResult = async (entryId: string) => {
    setSavingId(entryId);
    setError(null);

    const form = inputForms[entryId] || { attackTimeStr: '', errorsStr: '', relayRaceTimeStr: '', relayRaceErrorsStr: '' };
    const parsedErrors = form.errorsStr.trim() !== '' ? Number(form.errorsStr) : null;
    const parsedRelayErrors = form.relayRaceErrorsStr.trim() !== '' ? Number(form.relayRaceErrorsStr) : null;
    const parsedRelayHundredths = form.relayRaceTimeStr.trim() !== '' ? parseGermanTimeToHundredths(form.relayRaceTimeStr) : null;

    const payload: Record<string, unknown> = {
      attackTimeStr: form.attackTimeStr,
      errors: parsedErrors,
    };
    if (parsedRelayHundredths !== null) {
      payload.relayRaceHundredths = parsedRelayHundredths;
    }
    if (parsedRelayErrors !== null) {
      payload.relayRaceErrors = parsedRelayErrors;
    }

    try {
      const res = await fetch(`/api/admin/category-entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error: string };
        throw new Error(errorData.error || uiText.admin.results.saveError);
      }

      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.results.saveError);
    } finally {
      setSavingId(null);
    }
  };

  const handleStatusChange = async (entryId: string, newStatus: 'OPEN' | 'VALID' | 'DNF') => {
    setSavingId(entryId);
    setError(null);

    try {
      const res = await fetch(`/api/admin/category-entries/${entryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runStatus: newStatus,
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { error: string };
        throw new Error(errorData.error || uiText.admin.results.statusError);
      }

      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.results.statusError);
    } finally {
      setSavingId(null);
    }
  };

  // Build a lookup map: competitionClassId → class name for sorting
  const classNameById = new Map(competitionClasses.map((c) => [c.id, c.name]));

  const sortedCategoryTypes = [...categoryTypes].sort((a, b) => {
    const classA = classNameById.get(a.competitionClassId ?? '') ?? (a.competitionClassId ?? '');
    const classB = classNameById.get(b.competitionClassId ?? '') ?? (b.competitionClassId ?? '');
    if (classA !== classB) return classA.localeCompare(classB, 'de');
    return a.name.localeCompare(b.name, 'de');
  });

  const categoryFilterOptions = [
    { id: 'all', name: uiText.admin.results.allCategories, competitionClassId: undefined, hasRelayRace: false } as const,
    ...sortedCategoryTypes,
  ];

  // Filtering
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchFilter = (e: CategoryEntry) => {
    if (!normalizedSearch) return true;
    const startStr = e.startOrderPosition !== null && e.startOrderPosition !== undefined ? String(e.startOrderPosition) : '';
    return (
      startStr.includes(normalizedSearch) ||
      (e.groupName || '').toLowerCase().includes(normalizedSearch) ||
      (e.fireBrigadeName || '').toLowerCase().includes(normalizedSearch) ||
      (e.categoryTypeName || '').toLowerCase().includes(normalizedSearch)
    );
  };

  const catFilteredEntries =
    selectedCategory === 'all'
      ? entries
      : entries.filter((e) => e.categoryTypeId === selectedCategory || e.categoryTypeName === selectedCategory);

  const filteredEntries = catFilteredEntries.filter(searchFilter);

  const openEntries = filteredEntries
    .filter((e) => e.runStatus === 'OPEN')
    .sort((a, b) => (a.startOrderPosition ?? 999) - (b.startOrderPosition ?? 999));

  // Rank valid entries grouped by categoryType
  const validEntriesGrouped: (CategoryEntry & { rank?: number })[] = [];
  const uniqueCatKeys = Array.from(new Set(filteredEntries.map((e) => e.categoryTypeId || e.categoryTypeName || '')));

  uniqueCatKeys.forEach((catKey) => {
    const catEntries = filteredEntries.filter((e) => (e.categoryTypeId || e.categoryTypeName) === catKey);
    // Ensure scoreHundredths is computed if missing
    const withScores = catEntries.map((e) => {
      let score = e.scoreHundredths;
      if (score === null || score === undefined) {
        if (e.attackTimeHundredths !== null) {
          const err = e.attackTimeErrors ?? e.errors ?? 0;
          score = e.attackTimeHundredths + err * 100;
          if (e.relayRaceHundredths !== null && e.relayRaceHundredths !== undefined) {
            score += e.relayRaceHundredths + (e.relayRaceErrors ?? 0) * 100;
          }
        }
      }
      return { ...e, scoreHundredths: score };
    });
    const ranked = rankEntries(withScores as ScoringCategoryEntry[]) as (CategoryEntry & { rank?: number })[];
    validEntriesGrouped.push(...ranked);
  });

  validEntriesGrouped.sort((a, b) => (a.scoreHundredths ?? 99999) - (b.scoreHundredths ?? 99999));

  const dnfEntries = filteredEntries.filter((e) => e.runStatus === 'DNF');

  return (
    <div className="space-y-4" data-testid="results-tab">
      {/* Header & Category Selection */}
      <AdminCard className="!p-3 sm:!p-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto max-w-full py-0.5 hide-scrollbar touch-pan-x">
            {categoryFilterOptions.map((cat) => (
              <button
                key={cat.id}
                id={`cat-filter-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between sm:justify-end gap-2.5">
            {/* Quick search input */}
            <div className="relative flex-1 sm:flex-initial sm:w-48">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Startnr. / Wehr suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            {/* Quick Counters */}
            <div className="flex items-center justify-between sm:justify-end space-x-1.5 text-xs shrink-0">
              <span className="px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900 font-mono font-semibold text-xs">
                {uiText.admin.results.openCount(openEntries.length)}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-semibold text-xs">
                {uiText.admin.results.validCount(validEntriesGrouped.length)}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-900 font-mono font-semibold text-xs">
                {uiText.admin.results.dnfCount(dnfEntries.length)}
              </span>
            </div>
          </div>
        </div>
      </AdminCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <span className="font-semibold">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 font-bold ml-4 p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
          <Loader2 className="animate-spin mb-3 text-indigo-500" size={28} />
          <div className="text-xs">{uiText.admin.results.loading}</div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SECTION 1: OPEN START ORDER (Zeiterfassung) */}
          <AdminCard className="!p-4 sm:!p-5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="bg-amber-50 text-amber-600 p-1.5 rounded-md">
                  <Timer size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                  {uiText.admin.results.openRunsTitle}
                </h3>
                <span className="text-[11px] text-amber-700 font-mono bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded font-semibold">
                  {openEntries.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                {uiText.admin.results.autoValidBefore}{' '}
                <strong className="text-emerald-600 font-semibold">{uiText.admin.results.validStatus}</strong>{' '}
                {uiText.admin.results.autoValidAfter}
              </p>
            </div>

            <div>
              {openEntries.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {uiText.admin.results.noOpenRuns}
                </div>
              ) : (
                <div className="space-y-2">
                  {openEntries.map((entry) => {
                    const form = inputForms[entry.id] || {
                      attackTimeStr: '',
                      errorsStr: '',
                      relayRaceTimeStr: '',
                      relayRaceErrorsStr: '',
                    };
                    const isSaving = savingId === entry.id;
                    const catType = categoryTypes.find((t) => t.id === entry.categoryTypeId || t.name === entry.categoryTypeName);
                    const showRelay = Boolean(entry.hasRelayRace ?? catType?.hasRelayRace ?? false);

                    const initialAttackTime = formatHundredthsToGerman(entry.attackTimeHundredths);
                    const errorsVal = entry.attackTimeErrors !== null && entry.attackTimeErrors !== undefined
                      ? entry.attackTimeErrors
                      : entry.errors;
                    const initialErrorsStr = errorsVal !== null && errorsVal !== undefined ? String(errorsVal) : '';
                    const initialRelayTime = formatHundredthsToGerman(entry.relayRaceHundredths);
                    const initialRelayErrorsStr = entry.relayRaceErrors !== null && entry.relayRaceErrors !== undefined ? String(entry.relayRaceErrors) : '';

                    const isDirty =
                      (form.attackTimeStr ?? '') !== initialAttackTime ||
                      (form.errorsStr ?? '') !== initialErrorsStr ||
                      (form.relayRaceTimeStr ?? '') !== initialRelayTime ||
                      (form.relayRaceErrorsStr ?? '') !== initialRelayErrorsStr;

                    return (
                      <div
                        key={entry.id}
                        data-testid={`open-entry-row-${entry.id}`}
                        className="bg-white border border-slate-200/90 rounded-xl p-2.5 sm:p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 hover:border-slate-300 hover:shadow-xs transition-all"
                      >
                        {/* Entry info */}
                        <div className="flex items-center space-x-3 min-w-0 xl:min-w-[240px] xl:max-w-[320px]">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            #{entry.startOrderPosition}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-sm truncate leading-tight">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide truncate mt-0.5">
                              {entry.categoryTypeName || catType?.name || '—'} <span className="text-slate-400">({entry.competitionClass})</span>
                            </div>
                          </div>
                        </div>

                        {/* Input controls */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 bg-slate-50/80 p-2 sm:px-3 sm:py-2 rounded-lg border border-slate-200/70">
                          {/* Attack Time Input */}
                          <div className="flex items-center space-x-1.5">
                            <label
                              htmlFor={`time-input-${entry.id}`}
                              className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                            >
                              {uiText.admin.results.attackTime}
                            </label>
                            <input
                              id={`time-input-${entry.id}`}
                              type="text"
                              placeholder={uiText.admin.results.attackTimePlaceholder}
                              value={form.attackTimeStr}
                              onChange={(e) =>
                                handleInputChange(entry.id, 'attackTimeStr', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveResult(entry.id);
                              }}
                              className="w-18 sm:w-24 bg-white border border-slate-300 rounded-md px-1.5 sm:px-2 py-1 text-xs font-mono text-slate-900 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>

                          {/* Attack Errors Input */}
                          <div className="flex items-center space-x-1.5">
                            <label
                              htmlFor={`errors-input-${entry.id}`}
                              className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                            >
                              {uiText.admin.results.errors}
                            </label>
                            <input
                              id={`errors-input-${entry.id}`}
                              type="number"
                              min="0"
                              placeholder={uiText.admin.results.errorsPlaceholder}
                              value={form.errorsStr}
                              onChange={(e) =>
                                handleInputChange(entry.id, 'errorsStr', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveResult(entry.id);
                              }}
                              className="w-13 sm:w-16 bg-white border border-slate-300 rounded-md px-1 sm:px-1.5 py-1 text-xs font-mono text-slate-900 text-center focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>

                          {/* Relay Race Inputs */}
                          {showRelay && (
                            <>
                              <div className="h-4 w-px bg-slate-300 mx-0.5 hidden sm:block" />
                              <div className="flex items-center space-x-1.5">
                                <label
                                  htmlFor={`relay-time-input-${entry.id}`}
                                  className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {uiText.admin.results.relayTime}
                                </label>
                                <input
                                  id={`relay-time-input-${entry.id}`}
                                  type="text"
                                  placeholder={uiText.admin.results.relayTimePlaceholder}
                                  value={form.relayRaceTimeStr}
                                  onChange={(e) =>
                                    handleInputChange(entry.id, 'relayRaceTimeStr', e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveResult(entry.id);
                                  }}
                                  className="w-18 sm:w-24 bg-white border border-slate-300 rounded-md px-1.5 sm:px-2 py-1 text-xs font-mono text-slate-900 text-center font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                />
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <label
                                  htmlFor={`relay-errors-input-${entry.id}`}
                                  className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {uiText.admin.results.relayErrors}
                                </label>
                                <input
                                  id={`relay-errors-input-${entry.id}`}
                                  type="number"
                                  min="0"
                                  placeholder={uiText.admin.results.errorsPlaceholder}
                                  value={form.relayRaceErrorsStr}
                                  onChange={(e) =>
                                    handleInputChange(entry.id, 'relayRaceErrorsStr', e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveResult(entry.id);
                                  }}
                                  className="w-13 sm:w-16 bg-white border border-slate-300 rounded-md px-1 sm:px-1.5 py-1 text-xs font-mono text-slate-900 text-center focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                                />
                              </div>
                            </>
                          )}

                          {/* Actions: exactly 2 buttons: DNF and Speichern */}
                          <div className="flex items-center space-x-1.5 w-full sm:w-auto sm:ml-auto justify-end pt-1.5 sm:pt-0 border-t border-slate-200/50 sm:border-t-0 pl-1">
                            <button
                              id={`dnf-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'DNF')}
                              disabled={isSaving}
                              className="flex-1 sm:flex-initial px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-xs rounded-md transition-colors cursor-pointer disabled:opacity-50 text-center"
                            >
                              {uiText.admin.results.dnf}
                            </button>
                            <button
                              id={`save-btn-${entry.id}`}
                              onClick={() => handleSaveResult(entry.id)}
                              disabled={isSaving}
                              className={`flex-1 sm:flex-initial px-3.5 py-1 disabled:opacity-50 font-bold text-xs rounded-md transition-all cursor-pointer text-center ${
                                isDirty
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600'
                                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-600'
                              }`}
                            >
                              {isSaving ? uiText.admin.results.saving : uiText.admin.results.save}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminCard>

          {/* SECTION 2: VALID EVALUATED RESULTS */}
          <AdminCard className="!p-4 sm:!p-5">
            <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="bg-emerald-50 text-emerald-600 p-1.5 rounded-md">
                  <Trophy size={16} />
                </div>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                  {uiText.admin.results.validRankingsTitle}
                </h3>
                <span className="text-[11px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded font-semibold">
                  {validEntriesGrouped.length}
                </span>
              </div>
            </div>

            <div>
              {validEntriesGrouped.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {uiText.admin.results.noValidRuns}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {validEntriesGrouped.map((entry) => {
                    const isSaving = savingId === entry.id;
                    const formattedAttack = formatHundredthsToGerman(entry.attackTimeHundredths);
                    const formattedRelay = formatHundredthsToGerman(entry.relayRaceHundredths);
                    const formattedScore = formatHundredthsToGerman(entry.scoreHundredths);
                    const attackErrors = entry.attackTimeErrors ?? entry.errors ?? 0;
                    const hasRelay = entry.relayRaceHundredths !== null && entry.relayRaceHundredths !== undefined;

                    return (
                      <div
                        key={entry.id}
                        data-testid={`valid-entry-row-${entry.id}`}
                        className="bg-white border border-slate-200/80 rounded-lg p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div
                            className={`w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs font-mono shrink-0 ${
                              entry.rank === 1
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : entry.rank === 2
                                  ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                  : entry.rank === 3
                                    ? 'bg-orange-100 text-orange-800 border border-orange-300'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {entry.rank}.
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-900 text-sm truncate leading-tight">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide truncate">
                              {entry.categoryTypeName || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 sm:gap-4 pt-1.5 md:pt-0 border-t border-slate-100 md:border-t-0 shrink-0">
                          <div className="text-left md:text-right">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{uiText.admin.results.attackAndRelay}</div>
                            <div className="text-xs font-mono text-slate-700 font-medium">
                              {formattedAttack}s <span className="text-red-500 text-[11px]">(+{attackErrors}F)</span>
                              {hasRelay && (
                                <span className="text-slate-400 text-[11px] ml-1.5">
                                  | {formattedRelay}s <span className="text-red-500">(+{entry.relayRaceErrors ?? 0}F)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right pl-3 border-l border-slate-200">
                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{uiText.admin.results.totalTime}</div>
                            <div className="text-sm font-bold font-mono text-emerald-700 leading-none mt-0.5">
                              {formattedScore}s
                            </div>
                          </div>

                          <div className="pl-1 md:pl-2">
                            <button
                              id={`revert-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'OPEN')}
                              disabled={isSaving}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-md border border-slate-200/90 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                              title={uiText.admin.results.resetToOpenTitle}
                            >
                              {uiText.admin.results.resetToOpen}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </AdminCard>

          {/* SECTION 3: DNF / DISQUALIFIED */}
          {dnfEntries.length > 0 && (
            <AdminCard className="!p-4 sm:!p-5">
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
                    <XCircle size={16} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                    {uiText.admin.results.disqualifiedTitle}
                  </h3>
                  <span className="text-[11px] text-red-700 font-mono bg-red-50 border border-red-200 px-2 py-0.5 rounded font-semibold">
                    {dnfEntries.length}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {dnfEntries.map((entry) => {
                  const isSaving = savingId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      data-testid={`dnf-entry-row-${entry.id}`}
                      className="bg-red-50/40 border border-red-200/80 rounded-lg p-2 sm:p-2.5 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-md bg-red-100 text-red-700 border border-red-200 flex items-center justify-center font-bold text-xs font-mono shrink-0">
                          {uiText.admin.results.dnf}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-sm truncate leading-tight">
                            {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide truncate">
                            {entry.categoryTypeName || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <button
                          id={`revert-dnf-btn-${entry.id}`}
                          onClick={() => handleStatusChange(entry.id, 'OPEN')}
                          disabled={isSaving}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-md border border-slate-200 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {uiText.admin.results.resetToOpen}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminCard>
          )}
        </div>
      )}
    </div>
  );
}
