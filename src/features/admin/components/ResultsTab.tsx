import { useState, useEffect } from 'react';
import { rankEntries } from '../../../../shared/domain/ranking';
import { type CategoryEntry as ScoringCategoryEntry } from '../../../../shared/domain/scoring';
import { DEFAULT_CATALOG_SEED } from '../../../../shared/seed/seed-data';
import { parseGermanTimeToHundredths, formatHundredthsToGerman } from '../../../../shared/utils/time-parser';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { Timer, Trophy, XCircle, Loader2 } from 'lucide-react';

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

const FALLBACK_CATEGORIES: CategoryType[] = DEFAULT_CATALOG_SEED.categoryTypes;


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
  const filteredEntries =
    selectedCategory === 'all'
      ? entries
      : entries.filter((e) => e.categoryTypeId === selectedCategory || e.categoryTypeName === selectedCategory);

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
    <div className="space-y-6 @container" data-testid="results-tab">
      {/* Header & Category Selection */}
      <AdminCard className="!p-4">
        <div className="flex flex-col @md:flex-row justify-between items-start @md:items-center gap-4">
          <div className="flex items-center space-x-2 overflow-x-auto max-w-full py-1 hide-scrollbar">
            {categoryFilterOptions.map((cat) => (
              <button
                key={cat.id}
                id={`cat-filter-${cat.id}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border border-indigo-500'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Quick Counters */}
          <div className="flex items-center space-x-3 text-xs shrink-0">
            <span className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-mono font-semibold">
              {uiText.admin.results.openCount(openEntries.length)}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-semibold">
              {uiText.admin.results.validCount(validEntriesGrouped.length)}
            </span>
            <span className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-900 font-mono font-semibold">
              {uiText.admin.results.dnfCount(dnfEntries.length)}
            </span>
          </div>
        </div>
      </AdminCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 font-bold ml-4 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
          <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
          <div>{uiText.admin.results.loading}</div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: OPEN START ORDER (Zeiterfassung) */}
          <AdminCard>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-50 text-indigo-500 p-2 rounded-lg">
                  <Timer size={20} />
                </div>
                <h3 className="font-bold text-slate-800 tracking-wide text-lg">
                  {uiText.admin.results.openRunsTitle}
                </h3>
                <span className="text-xs text-indigo-600 font-mono bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-semibold">
                  {openEntries.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                {uiText.admin.results.autoValidBefore}{' '}
                <strong className="text-emerald-600 font-semibold">{uiText.admin.results.validStatus}</strong>{' '}
                {uiText.admin.results.autoValidAfter}
              </p>
            </div>

            <div>
              {openEntries.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {uiText.admin.results.noOpenRuns}
                </div>
              ) : (
                <div className="space-y-4">
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
                        className="bg-slate-50 border border-slate-100 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:shadow-sm transition-all"
                      >
                        {/* Entry info */}
                        <div className="flex items-center space-x-4 min-w-[240px]">
                          <div className="w-10 h-10 rounded-xl bg-white text-slate-700 border border-slate-200 flex items-center justify-center font-mono font-bold shadow-sm shrink-0">
                            #{entry.startOrderPosition}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-base">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-xs text-slate-500 font-medium uppercase mt-1">
                              {entry.categoryTypeName || catType?.name || '—'} ({entry.competitionClass})
                            </div>
                          </div>
                        </div>

                        {/* Input controls */}
                        <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          {/* Attack Time Input */}
                          <div className="flex flex-col">
                            <label
                              htmlFor={`time-input-${entry.id}`}
                              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1"
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
                              className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 text-center focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>

                          {/* Attack Errors Input */}
                          <div className="flex flex-col">
                            <label
                              htmlFor={`errors-input-${entry.id}`}
                              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1"
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
                              className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 text-center focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                            />
                          </div>

                          {/* Relay Race Inputs (if category has relay race) */}
                          {showRelay && (
                            <>
                              <div className="flex flex-col border-l border-slate-100 pl-4 ml-1">
                                <label
                                  htmlFor={`relay-time-input-${entry.id}`}
                                  className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1"
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
                                  className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 text-center focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                                />
                              </div>

                              <div className="flex flex-col">
                                <label
                                  htmlFor={`relay-errors-input-${entry.id}`}
                                  className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1"
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
                                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono text-slate-800 text-center focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                                />
                              </div>
                            </>
                          )}

                          {/* Actions: DNF then Speichern */}
                          <div className="flex items-center space-x-2 pt-5 ml-2 lg:pt-0">
                            <button
                              id={`dnf-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'DNF')}
                              disabled={isSaving}
                              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-semibold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {uiText.admin.results.dnf}
                            </button>
                            <button
                              id={`save-btn-${entry.id}`}
                              onClick={() => handleSaveResult(entry.id)}
                              disabled={isSaving}
                              className={`px-5 py-2.5 disabled:opacity-50 font-semibold text-xs rounded-xl transition-all cursor-pointer ${
                                isDirty
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-200 border border-emerald-600'
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
          <AdminCard>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="bg-emerald-50 text-emerald-500 p-2 rounded-lg">
                  <Trophy size={20} />
                </div>
                <h3 className="font-bold text-slate-800 tracking-wide text-lg">
                  {uiText.admin.results.validRankingsTitle}
                </h3>
                <span className="text-xs text-emerald-600 font-mono bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md font-semibold">
                  {validEntriesGrouped.length}
                </span>
              </div>
            </div>

            <div>
              {validEntriesGrouped.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  {uiText.admin.results.noValidRuns}
                </div>
              ) : (
                <div className="space-y-4">
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
                        className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm font-mono shrink-0 ${
                              entry.rank === 1
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : entry.rank === 2
                                  ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                  : entry.rank === 3
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}
                          >
                            {entry.rank}.
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-base">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-xs text-slate-500 font-medium uppercase mt-1">
                              {entry.categoryTypeName || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6 bg-slate-50 rounded-xl p-2 px-4 border border-slate-100">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{uiText.admin.results.attackAndRelay}</div>
                            <div className="text-sm font-mono text-slate-700 font-medium">
                              {formattedAttack}s <span className="text-red-500 text-xs">(+{attackErrors}F)</span>
                              {hasRelay && (
                                <span className="text-slate-400 text-xs ml-2">
                                  | {formattedRelay}s <span className="text-red-500">(+{entry.relayRaceErrors ?? 0}F)</span>
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right pl-4 border-l border-slate-200">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">{uiText.admin.results.totalTime}</div>
                            <div className="text-lg font-bold font-mono text-emerald-600">
                              {formattedScore}s
                            </div>
                          </div>

                          <div className="pl-4">
                            <button
                              id={`revert-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'OPEN')}
                              disabled={isSaving}
                              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 font-semibold text-xs rounded-lg border border-slate-200 shadow-sm transition-colors cursor-pointer"
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
            <AdminCard>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="bg-red-50 text-red-500 p-2 rounded-lg">
                    <XCircle size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800 tracking-wide text-lg">
                    {uiText.admin.results.disqualifiedTitle}
                  </h3>
                  <span className="text-xs text-red-600 font-mono bg-red-50 border border-red-100 px-2 py-0.5 rounded-md font-semibold">
                    {dnfEntries.length}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {dnfEntries.map((entry) => {
                  const isSaving = savingId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      data-testid={`dnf-entry-row-${entry.id}`}
                      className="bg-red-50/50 border border-red-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 border border-red-200 flex items-center justify-center font-bold text-sm font-mono shrink-0">
                          {uiText.admin.results.dnf}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-base">
                            {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                          </div>
                          <div className="text-xs text-slate-500 font-medium uppercase mt-1">
                            {entry.categoryTypeName || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <button
                          id={`revert-dnf-btn-${entry.id}`}
                          onClick={() => handleStatusChange(entry.id, 'OPEN')}
                          disabled={isSaving}
                          className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 shadow-sm transition-colors"
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
