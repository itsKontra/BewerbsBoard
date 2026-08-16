import React, { useState, useEffect } from 'react';
import { DEFAULT_CATALOG_SEED } from '../../../../shared/seed/seed-data';
import { uiText } from '../../../ui-text';

// ---- Domain types --------------------------------------------------------

export interface FireBrigade {
  id: string;
  name: string;
}

export interface CompetitionClass {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  fireBrigadeId: string;
  name: string;
  competitionClass: string;
  competitionClassId?: string;
  fireBrigadeName?: string;
}

interface CategoryType {
  id: string;
  name: string;
  competitionClassId: string;
  hasRelayRace: boolean;
}

interface CategoryEntry {
  id: string;
  groupId: string;
  categoryTypeId?: string;
  categoryTypeName?: string;
  runStatus: 'OPEN' | 'VALID' | 'DNF';
  startOrderPosition: number;
  groupName: string;
  competitionClass: string;
  fireBrigadeId: string;
  fireBrigadeName: string;
}

// ---- Sub-tab config -------------------------------------------------------

type ParticipantsSubTab = 'startreihenfolge' | 'stammdaten';

interface ParticipantsSubTabConfig {
  id: ParticipantsSubTab;
  label: string;
  icon: string;
}

const PARTICIPANTS_SUB_TABS: ParticipantsSubTabConfig[] = [
  { id: 'startreihenfolge', label: uiText.admin.participants.startOrder, icon: '📋' },
  { id: 'stammdaten', label: uiText.admin.participants.masterData, icon: '🚒' },
];

const FALLBACK_COMPETITION_CLASSES: CompetitionClass[] = DEFAULT_CATALOG_SEED.competitionClasses;

export function ParticipantsTab() {
  const [activeSubTab, setActiveSubTab] = useState<ParticipantsSubTab>('startreihenfolge');

  // ---- Stammdaten state --------------------------------------------------
  const [brigades, setBrigades] = useState<FireBrigade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [competitionClasses, setCompetitionClasses] = useState<CompetitionClass[]>(FALLBACK_COMPETITION_CLASSES);

  const [newBrigadeName, setNewBrigadeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Group form state
  const [selectedBrigade, setSelectedBrigade] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState(FALLBACK_COMPETITION_CLASSES[0]?.name ?? '');

  // ---- Startreihenfolge state --------------------------------------------
  const [categoryTypes, setCategoryTypes] = useState<CategoryType[]>([]);
  const [entries, setEntries] = useState<CategoryEntry[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // ---- Data fetching -----------------------------------------------------

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let loadedCompetitionClasses = competitionClasses;
      const [bRes, gRes, cRes, catTypesRes, entriesRes] = await Promise.all([
        fetch('/api/admin/brigades'),
        fetch('/api/admin/groups'),
        fetch('/api/admin/competition-classes').catch(() => null),
        fetch('/api/admin/category-types').catch(() => null),
        fetch('/api/admin/category-entries').catch(() => null),
      ]);

      if (bRes.ok) {
        const bData = await bRes.json();
        setBrigades(Array.isArray(bData) ? bData : []);
      }
      if (gRes.ok) {
        const gData = await gRes.json();
        setGroups(Array.isArray(gData) ? gData : []);
      }
      if (cRes && cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) {
          loadedCompetitionClasses = cData;
          setCompetitionClasses(cData);
          setNewGroupType((prev) => {
            const exists = cData.some((c: CompetitionClass) => c.name === prev);
            return exists ? prev : cData[0].name;
          });
        }
      }
      const types = catTypesRes && catTypesRes.ok ? await catTypesRes.json().catch(() => []) : [];
      const entryList = entriesRes && entriesRes.ok ? await entriesRes.json().catch(() => []) : [];
      const competitionClassNames = new Map(
        loadedCompetitionClasses.map((competitionClass) => [competitionClass.id, competitionClass.name])
      );
      const safeTypes = Array.isArray(types)
        ? [...(types as CategoryType[])].sort((left, right) => {
            const classComparison = (competitionClassNames.get(left.competitionClassId) ?? left.competitionClassId)
              .localeCompare(competitionClassNames.get(right.competitionClassId) ?? right.competitionClassId, 'de');
            return classComparison || left.name.localeCompare(right.name, 'de');
          })
        : [];
      const safeEntries = Array.isArray(entryList) ? (entryList as CategoryEntry[]) : [];

      setCategoryTypes(safeTypes);
      setEntries(safeEntries);

      if (safeTypes.length > 0) {
        setSelectedCategoryId((prev) => {
          const exists = safeTypes.some((t) => t.id === prev || t.name === prev);
          return exists ? prev : safeTypes[0].id;
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : uiText.admin.participants.loadError);
    } finally {
      setLoading(false);
    }
  };

  // ---- Stammdaten handlers -----------------------------------------------

  const handleCreateBrigade = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBrigadeName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/brigades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || uiText.admin.participants.createBrigadeError);
      }
      setNewBrigadeName('');
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : uiText.admin.participants.genericError);
    }
  };

  const handleDeleteBrigade = async (id: string, name?: string) => {
    setError(null);
    if (name && !window.confirm(uiText.admin.participants.deleteBrigadeConfirm(name))) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/brigades/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || uiText.admin.participants.deleteBrigadeError);
      }
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : uiText.admin.participants.genericError);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!selectedBrigade || !trimmed) return;
    const targetClass = competitionClasses.find((competitionClass) => competitionClass.name === newGroupType) ?? competitionClasses[0];
    if (!targetClass) {
      setError(uiText.admin.participants.noCompetitionClass);
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fireBrigadeId: selectedBrigade,
          name: trimmed,
          competitionClassId: targetClass.id
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 409) {
          throw new Error(uiText.admin.participants.duplicateGroup);
        }
        throw new Error(data.error || uiText.admin.participants.createGroupError);
      }
      setNewGroupName('');
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : uiText.admin.participants.genericError);
    }
  };

  const handleDeleteGroup = async (id: string, name?: string) => {
    setError(null);
    if (name && !window.confirm(uiText.admin.participants.deleteGroupConfirm(name))) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/groups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || uiText.admin.participants.deleteGroupError);
      }
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : uiText.admin.participants.genericError);
    }
  };

  // ---- Startreihenfolge handlers -----------------------------------------

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !currentCategory) return;

    setIsAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/category-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: selectedGroupId, categoryTypeId: currentCategory.id }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error: string };
        throw new Error(errorData.error || uiText.admin.participants.addGroupError);
      }

      await fetchData();
      setSelectedGroupId('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.participants.unknownError);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemove = async (entryId: string) => {
    setRemovingId(entryId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/category-entries/${entryId}`, { method: 'DELETE' });

      if (!res.ok) {
        const errorData = await res.json() as { error: string };
        throw new Error(errorData.error || uiText.admin.participants.removeEntryError);
      }

      await fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.participants.unknownError);
    } finally {
      setRemovingId(null);
    }
  };

  const handleMove = async (openEntries: CategoryEntry[], index: number, direction: 'up' | 'down') => {
    if (!currentCategory) return;
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === openEntries.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newOrderedIds = openEntries.map((e) => e.id);

    // Swap
    [newOrderedIds[index], newOrderedIds[targetIndex]] = [newOrderedIds[targetIndex], newOrderedIds[index]];

    // Immutable optimistic update
    const startOrderMap = new Map(newOrderedIds.map((id, idx) => [id, idx + 1]));
    setEntries((prev) =>
      prev.map((entry) =>
        (entry.categoryTypeId === currentCategory.id || entry.categoryTypeName === currentCategory.name) && entry.runStatus === 'OPEN'
          ? { ...entry, startOrderPosition: startOrderMap.get(entry.id) ?? entry.startOrderPosition }
          : entry
      )
    );

    try {
      const res = await fetch('/api/admin/category-entries/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryTypeId: currentCategory.id, orderedIds: newOrderedIds }),
      });

      if (!res.ok) {
        const errorData = await res.json() as { error: string };
        throw new Error(errorData.error || uiText.admin.participants.reorderError);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : uiText.admin.participants.unknownError);
      await fetchData(); // Revert on failure
    }
  };

  // ---- Derived state -----------------------------------------------------

  const filteredGroups = Array.isArray(groups)
    ? (selectedBrigade ? groups.filter(g => g.fireBrigadeId === selectedBrigade) : groups)
    : [];

  const currentCategory = Array.isArray(categoryTypes)
    ? (categoryTypes.find((c) => c.id === selectedCategoryId || c.name === selectedCategoryId) ?? categoryTypes[0])
    : undefined;

  const currentCategoryEntries = currentCategory && Array.isArray(entries)
    ? entries
        .filter((e) => e.categoryTypeId === currentCategory.id || e.categoryTypeName === currentCategory.name)
        .sort((a, b) => {
          if (a.runStatus === 'OPEN' && b.runStatus === 'OPEN') return (a.startOrderPosition ?? 0) - (b.startOrderPosition ?? 0);
          if (a.runStatus === 'OPEN') return -1;
          if (b.runStatus === 'OPEN') return 1;
          return 0;
        })
    : [];

  const openEntries = currentCategoryEntries.filter((e) => e.runStatus === 'OPEN');

  const availableGroups = currentCategory && Array.isArray(groups)
    ? groups.filter(
        (g) =>
          g.competitionClassId === currentCategory.competitionClassId &&
          !entries.some(
            (e) =>
              e.groupId === g.id &&
              (e.categoryTypeId === currentCategory.id || e.categoryTypeName === currentCategory.name)
          )
      )
    : [];

  // ---- Render ------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mr-3"></div>
        <span>{uiText.admin.participants.loadingMasterData}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 @container">
      {/* Sub-Tab Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1.5 shadow-md">
        {PARTICIPANTS_SUB_TABS.map((tab) => {
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
        <div className="bg-red-950/80 border border-red-500/80 text-red-200 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg shadow-red-950/20 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-bold">{uiText.admin.participants.errorPrefix}</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200 font-bold px-2 py-1 transition-colors"
            title={uiText.admin.participants.close}
          >
            ✕
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: STARTREIHENFOLGE                                              */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'startreihenfolge' ? 'space-y-6' : 'hidden'}>
        {categoryTypes.length > 0 ? (
          <>
            {/* Category Selection Tabs */}
            <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-neutral-800 scrollbar-hide">
              {categoryTypes.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition-colors whitespace-nowrap flex items-center space-x-2 ${
                      isSelected
                        ? 'bg-neutral-800 text-white border-b-2 border-red-500'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {cat.hasRelayRace ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                        {uiText.admin.participants.relay}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-400">
                        {uiText.admin.participants.withoutRelay}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {currentCategory && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-xl">
                <div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-2 mb-4 border-b border-neutral-800 pb-3">
                  <h3 className="text-lg font-oswald uppercase tracking-wide font-bold text-white">{uiText.admin.participants.groupsInCategory(currentCategory.name)}</h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-neutral-400">{uiText.admin.participants.relayRace}</span>
                    {currentCategory.hasRelayRace ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-700/70 text-emerald-300 font-semibold">
                        {uiText.admin.participants.available}
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-400 font-semibold">
                        {uiText.admin.participants.noRelayRace}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add Group Form */}
                <form onSubmit={handleAddGroup} className="flex flex-col @sm:flex-row space-y-3 @sm:space-y-0 @sm:space-x-3 mb-6">
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg p-2.5 text-sm text-neutral-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 shadow-inner"
                    disabled={loading || availableGroups.length === 0}
                  >
                    <option value="">
                      {availableGroups.length > 0 ? uiText.admin.participants.selectGroup : uiText.admin.participants.noAvailableGroups}
                    </option>
                    {availableGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.fireBrigadeName ? `${g.fireBrigadeName} - ` : ''}{g.name} ({g.competitionClass})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedGroupId || isAdding}
                    className="px-6 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md transition-colors"
                  >
                    {isAdding ? uiText.admin.participants.adding : uiText.admin.participants.add}
                  </button>
                </form>

                {/* Entries List */}
                {loading && entries.length === 0 ? (
                  <div className="text-center py-8 text-neutral-400">{uiText.admin.participants.loadingStartList}</div>
                ) : currentCategoryEntries.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 bg-neutral-950/50 rounded-lg border border-dashed border-neutral-800">
                    {uiText.admin.participants.noGroupsRegistered}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentCategoryEntries.map((entry) => {
                      const isOpen = entry.runStatus === 'OPEN';
                      const openIndex = isOpen ? openEntries.indexOf(entry) : -1;

                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            isOpen ? 'bg-neutral-800/80 border-neutral-700 hover:border-neutral-600' : 'bg-neutral-900/50 border-neutral-800/50 opacity-60'
                          }`}
                        >
                          <div className="flex items-center space-x-4">
                            <div className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold font-mono ${isOpen ? 'bg-neutral-950 text-neutral-300' : 'text-neutral-500'}`}>
                              {isOpen ? entry.startOrderPosition : '-'}
                            </div>
                            <div>
                              <div className="font-bold text-white text-sm">
                                {entry.fireBrigadeName ? `${entry.fireBrigadeName} - ` : ''}{entry.groupName}
                              </div>
                              <div className="text-xs text-neutral-400 mt-0.5">
                                {uiText.admin.participants.status} <span className={isOpen ? 'text-blue-400 font-semibold' : 'text-neutral-500'}>{entry.runStatus}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            {isOpen && (
                              <>
                                <button
                                  onClick={() => handleMove(openEntries, openIndex, 'up')}
                                  disabled={openIndex === 0}
                                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md disabled:opacity-30 transition-colors"
                                  title={uiText.admin.participants.moveUp}
                                >
                                  ▲
                                </button>
                                <button
                                  onClick={() => handleMove(openEntries, openIndex, 'down')}
                                  disabled={openIndex === openEntries.length - 1}
                                  className="p-2 text-neutral-400 hover:text-white hover:bg-neutral-700 rounded-md disabled:opacity-30 transition-colors"
                                  title={uiText.admin.participants.moveDown}
                                >
                                  ▼
                                </button>
                                <button
                                  onClick={() => handleRemove(entry.id)}
                                  disabled={removingId === entry.id}
                                  className="ml-2 p-2 text-red-400 hover:text-red-200 hover:bg-red-900/50 rounded-md disabled:opacity-30 transition-colors"
                                  title={uiText.admin.participants.removeEntry}
                                >
                                  {removingId === entry.id ? '…' : '✕'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-neutral-500">
            {uiText.admin.participants.noSetup}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TAB: STAMMDATEN                                                    */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'stammdaten' ? 'space-y-6' : 'hidden'}>

        {/* Brigades Section */}
        <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{uiText.admin.participants.brigades}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                  {brigades.length}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {uiText.admin.participants.brigadesDescription}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateBrigade} className="flex gap-3 mb-6">
            <input
              type="text"
              placeholder={uiText.admin.participants.brigadeNamePlaceholder}
              value={newBrigadeName}
              onChange={e => setNewBrigadeName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors"
            />
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
            >
              {uiText.admin.participants.add}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 rounded-l-lg">{uiText.admin.participants.name}</th>
                  <th className="px-4 py-2.5">{uiText.admin.participants.groups}</th>
                  <th className="px-4 py-2.5 rounded-r-lg text-right">{uiText.admin.participants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {brigades.map(b => {
                  const bGroupsCount = groups.filter(g => g.fireBrigadeId === b.id).length;
                  return (
                    <tr key={b.id} className="hover:bg-neutral-800/20 transition-colors">
                      <td className="px-4 py-3 text-neutral-200 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-neutral-400 text-xs">
                        {uiText.admin.participants.groupCount(bGroupsCount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteBrigade(b.id, b.name)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors text-xs font-medium"
                        >
                          {uiText.admin.participants.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {brigades.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-neutral-500">
                      {uiText.admin.participants.noBrigades}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Groups Section */}
        <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{uiText.admin.participants.groups}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-mono">
                  {filteredGroups.length}
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {uiText.admin.participants.groupsDescription}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateGroup} className="flex gap-3 mb-6 flex-wrap">
            <select
              value={selectedBrigade}
              onChange={e => setSelectedBrigade(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 min-w-[200px]"
              aria-label={uiText.admin.participants.selectBrigadeLabel}
            >
              <option value="">{uiText.admin.participants.selectBrigade}</option>
              {brigades.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder={uiText.admin.participants.groupNamePlaceholder}
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 min-w-[150px]"
            />

            <select
              value={newGroupType}
              onChange={e => setNewGroupType(e.target.value)}
              className="bg-neutral-950 border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-red-500 min-w-[140px]"
              aria-label={uiText.admin.participants.selectCompetitionClass}
            >
              {competitionClasses.map(cc => (
                <option key={cc.id} value={cc.name}>{cc.name}</option>
              ))}
            </select>

            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm"
            >
              {uiText.admin.participants.createGroup}
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-800/50 text-neutral-400">
                <tr>
                  <th className="px-4 py-2.5 rounded-l-lg">{uiText.admin.participants.brigade}</th>
                  <th className="px-4 py-2.5">{uiText.admin.participants.group}</th>
                  <th className="px-4 py-2.5">{uiText.admin.participants.competitionClass}</th>
                  <th className="px-4 py-2.5 rounded-r-lg text-right">{uiText.admin.participants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredGroups.map(g => {
                  const brigade = brigades.find(b => b.id === g.fireBrigadeId);
                  return (
                    <tr key={g.id} className="hover:bg-neutral-800/20 transition-colors">
                      <td className="px-4 py-3 text-neutral-200">{brigade?.name || uiText.admin.participants.unknown}</td>
                      <td className="px-4 py-3 text-neutral-200 font-medium">{g.name}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-neutral-800 border border-neutral-700 text-neutral-300">
                          {g.competitionClass}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1 rounded transition-colors text-xs font-medium"
                        >
                          {uiText.admin.participants.delete}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-neutral-500">
                      {uiText.admin.participants.noGroups}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
