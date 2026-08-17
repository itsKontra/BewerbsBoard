import { useState, useEffect } from 'react';
import { rankEntries } from '../../../../shared/domain/ranking';
import { type CategoryEntry as ScoringCategoryEntry } from '../../../../shared/domain/scoring';
import { DEFAULT_CATALOG_SEED } from '../../../../shared/seed/seed-data';
import { parseGermanTimeToHundredths, formatHundredthsToGerman } from '../../../../shared/utils/time-parser';
import { uiText } from '../../../ui-text';

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
      <div className="flex flex-col @md:flex-row justify-between items-start @md:items-center gap-4 bg-neutral-900/80 border border-neutral-800 p-4 rounded-xl backdrop-blur">
        <div className="flex items-center space-x-2 overflow-x-auto max-w-full py-1">
          {categoryFilterOptions.map((cat) => (
            <button
              key={cat.id}
              id={`cat-filter-${cat.id}`}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${selectedCategory === cat.id
                  ? 'bg-red-600 text-white shadow-md shadow-red-950/40 border border-red-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent'
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Quick Counters */}
        <div className="flex items-center space-x-3 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-blue-950/60 border border-blue-800/50 text-blue-300 font-mono">
            {uiText.admin.results.openCount(openEntries.length)}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 font-mono">
            {uiText.admin.results.validCount(validEntriesGrouped.length)}
          </span>
          <span className="px-2.5 py-1 rounded-md bg-red-950/60 border border-red-800/50 text-red-300 font-mono">
            {uiText.admin.results.dnfCount(dnfEntries.length)}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-600 text-red-200 p-3.5 rounded-xl text-sm flex items-center justify-between shadow-lg">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-neutral-400 font-medium">
          <div className="inline-block animate-spin text-2xl mb-2">⏱️</div>
          <div>{uiText.admin.results.loading}</div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECTION 1: OPEN START ORDER (Zeiterfassung) */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-neutral-800/60 px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">⏱️</span>
                <h3 className="font-bold text-white tracking-wide">
                  {uiText.admin.results.openRunsTitle}
                </h3>
                <span className="text-xs text-blue-400 font-mono bg-blue-950/50 border border-blue-800/40 px-2 py-0.5 rounded-md">
                  {openEntries.length}
                </span>
              </div>
              <p className="text-xs text-neutral-400 hidden md:block">
                {uiText.admin.results.autoValidBefore}{' '}
                <strong className="text-emerald-400 font-semibold">{uiText.admin.results.validStatus}</strong>{' '}
                {uiText.admin.results.autoValidAfter}
              </p>
            </div>

            <div className="p-5">
              {openEntries.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  {uiText.admin.results.noOpenRuns}
                </div>
              ) : (
                <div className="space-y-3">
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

                    return (
                      <div
                        key={entry.id}
                        data-testid={`open-entry-row-${entry.id}`}
                        className="bg-neutral-950/70 border border-neutral-800/90 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:border-neutral-700 transition-colors"
                      >
                        {/* Entry info */}
                        <div className="flex items-center space-x-4 min-w-[240px]">
                          <div className="w-9 h-9 rounded-lg bg-blue-950 text-blue-300 border border-blue-800/60 flex items-center justify-center font-mono font-bold text-sm shadow-inner shrink-0">
                            #{entry.startOrderPosition}
                          </div>
                          <div>
                            <div className="font-bold text-white text-base">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-xs text-neutral-400 font-mono uppercase mt-0.5">
                              {entry.categoryTypeName || catType?.name || '—'} ({entry.competitionClass})
                            </div>
                          </div>
                        </div>

                        {/* Input controls */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Attack Time Input */}
                          <div className="flex flex-col">
                            <label
                              htmlFor={`time-input-${entry.id}`}
                              className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1"
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
                              className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white text-center focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>

                          {/* Attack Errors Input */}
                          <div className="flex flex-col">
                            <label
                              htmlFor={`errors-input-${entry.id}`}
                              className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1"
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
                              className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white text-center focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                            />
                          </div>

                          {/* Relay Race Inputs (if category has relay race) */}
                          {showRelay && (
                            <>
                              <div className="flex flex-col">
                                <label
                                  htmlFor={`relay-time-input-${entry.id}`}
                                  className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1"
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
                                  className="w-28 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white text-center focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                              </div>

                              <div className="flex flex-col">
                                <label
                                  htmlFor={`relay-errors-input-${entry.id}`}
                                  className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1"
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
                                  className="w-20 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white text-center focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                                />
                              </div>
                            </>
                          )}

                          {/* Actions: DNF then Speichern */}
                          <div className="flex items-center space-x-2 pt-4 lg:pt-0">
                            <button
                              id={`dnf-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'DNF')}
                              disabled={isSaving}
                              className="px-3.5 py-1.5 bg-red-950/80 hover:bg-red-900 border border-red-800 text-red-300 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              {uiText.admin.results.dnf}
                            </button>
                            <button
                              id={`save-btn-${entry.id}`}
                              onClick={() => handleSaveResult(entry.id)}
                              disabled={isSaving}
                              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md shadow-emerald-950/40 transition-colors cursor-pointer"
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
          </section>

          {/* SECTION 2: VALID EVALUATED RESULTS */}
          <section className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-neutral-800/60 px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-lg">🏆</span>
                <h3 className="font-bold text-white tracking-wide">
                  {uiText.admin.results.validRankingsTitle}
                </h3>
                <span className="text-xs text-emerald-400 font-mono bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded-md">
                  {validEntriesGrouped.length}
                </span>
              </div>
            </div>

            <div className="p-5">
              {validEntriesGrouped.length === 0 ? (
                <div className="text-center py-8 text-neutral-500 text-sm">
                  {uiText.admin.results.noValidRuns}
                </div>
              ) : (
                <div className="space-y-3">
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
                        className="bg-neutral-950/70 border border-emerald-900/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-inner font-mono shrink-0 ${entry.rank === 1
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-500/80 ring-1 ring-amber-500/30'
                                : entry.rank === 2
                                  ? 'bg-slate-800 text-slate-200 border border-slate-400/80 ring-1 ring-slate-400/30'
                                  : entry.rank === 3
                                    ? 'bg-amber-950/40 text-amber-500 border border-amber-700/80 ring-1 ring-amber-700/30'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              }`}
                          >
                            {entry.rank}.
                          </div>
                          <div>
                            <div className="font-bold text-white text-base">
                              {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                            </div>
                            <div className="text-xs text-neutral-400 font-mono uppercase mt-0.5">
                              {entry.categoryTypeName || '—'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className="text-right">
                            <div className="text-xs text-neutral-400">{uiText.admin.results.attackAndRelay}</div>
                            <div className="text-sm font-mono text-neutral-300">
                              {formattedAttack}s (+{attackErrors}F)
                              {hasRelay && (
                                <span className="text-neutral-400 text-xs ml-1">
                                  | {formattedRelay}s (+{entry.relayRaceErrors ?? 0}F)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right pr-2">
                            <div className="text-xs text-neutral-400">{uiText.admin.results.totalTime}</div>
                            <div className="text-lg font-bold font-mono text-emerald-400">
                              {formattedScore}s
                            </div>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              id={`revert-btn-${entry.id}`}
                              onClick={() => handleStatusChange(entry.id, 'OPEN')}
                              disabled={isSaving}
                              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-lg border border-neutral-700 transition-colors cursor-pointer"
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
          </section>

          {/* SECTION 3: DNF / DISQUALIFIED */}
          {dnfEntries.length > 0 && (
            <section className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-neutral-800/60 px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">❌</span>
                  <h3 className="font-bold text-white tracking-wide">
                    {uiText.admin.results.disqualifiedTitle}
                  </h3>
                  <span className="text-xs text-red-400 font-mono bg-red-950/50 border border-red-800/40 px-2 py-0.5 rounded-md">
                    {dnfEntries.length}
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {dnfEntries.map((entry) => {
                  const isSaving = savingId === entry.id;

                  return (
                    <div
                      key={entry.id}
                      data-testid={`dnf-entry-row-${entry.id}`}
                      className="bg-neutral-950/70 border border-red-900/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-9 h-9 rounded-lg bg-red-950 text-red-300 border border-red-800/60 flex items-center justify-center font-bold text-xs font-mono">
                          {uiText.admin.results.dnf}
                        </div>
                        <div>
                          <div className="font-bold text-white text-base">
                            {entry.fireBrigadeName ? `${entry.fireBrigadeName} — ` : ''}{entry.groupName}
                          </div>
                          <div className="text-xs text-neutral-400 font-mono uppercase mt-0.5">
                            {entry.categoryTypeName || '—'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <button
                          id={`revert-dnf-btn-${entry.id}`}
                          onClick={() => handleStatusChange(entry.id, 'OPEN')}
                          disabled={isSaving}
                          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-lg border border-neutral-700 transition-colors"
                        >
                          {uiText.admin.results.resetToOpen}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
