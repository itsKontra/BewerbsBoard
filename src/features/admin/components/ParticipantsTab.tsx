import React, { useState, useEffect } from 'react';
import { DEFAULT_CATALOG_SEED } from '../../../../shared/seed/seed-data';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { ClipboardList, Users, Plus, ChevronUp, ChevronDown, Trash2, Loader2, X } from 'lucide-react';

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
  icon: React.FC<{ size?: number; className?: string }>;
}

const PARTICIPANTS_SUB_TABS: ParticipantsSubTabConfig[] = [
  { id: 'startreihenfolge', label: uiText.admin.participants.startOrder, icon: ClipboardList },
  { id: 'stammdaten', label: uiText.admin.participants.masterData, icon: Users },
];

const FALLBACK_COMPETITION_CLASSES: CompetitionClass[] = DEFAULT_CATALOG_SEED.competitionClasses;

export function ParticipantsTab() {
  const [activeSubTab, setActiveSubTab] = useState<ParticipantsSubTab>('stammdaten');

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
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
        <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
        <span>{uiText.admin.participants.loadingMasterData}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-Tab Bar */}
      <AdminCard className="!p-1.5 sm:!p-2">
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5">
          {PARTICIPANTS_SUB_TABS.map((tab) => {
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
          <div className="flex items-center gap-2 font-semibold">
            <span>{uiText.admin.participants.errorPrefix}</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 font-bold p-1 cursor-pointer transition-colors"
            title={uiText.admin.participants.close}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SUB-TAB: STARTREIHENFOLGE                                              */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'startreihenfolge' ? 'space-y-4' : 'hidden'}>
        {categoryTypes.length > 0 ? (
          <>
            {/* Category Selection Tabs */}
            <AdminCard className="!p-2.5 sm:!p-3">
              <div className="flex space-x-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {categoryTypes.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-2 cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs border border-indigo-500'
                          : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>{cat.name}</span>
                      {cat.hasRelayRace ? (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                        }`}>
                          {uiText.admin.participants.relay}
                        </span>
                      ) : (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {uiText.admin.participants.withoutRelay}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </AdminCard>

            {currentCategory && (
              <AdminCard className="!p-4 sm:!p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">{uiText.admin.participants.groupsInCategory(currentCategory.name)}</h3>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="text-slate-500 text-[11px]">{uiText.admin.participants.relayRace}</span>
                    {currentCategory.hasRelayRace ? (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold">
                        {uiText.admin.participants.available}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold">
                        {uiText.admin.participants.noRelayRace}
                      </span>
                    )}
                  </div>
                </div>

                {/* Add Group Form */}
                <form onSubmit={handleAddGroup} className="flex flex-col sm:flex-row gap-2 mb-3.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 shadow-2xs transition-all"
                    disabled={loading || availableGroups.length === 0}
                  >
                    <option value="">
                      {availableGroups.length > 0 ? uiText.admin.participants.selectGroup : uiText.admin.participants.noAvailableGroups}
                    </option>
                    {availableGroups.map((g) => {
                      const brigade = brigades.find((b) => b.id === g.fireBrigadeId);
                      const brigadeName = brigade?.name || g.fireBrigadeName;
                      return (
                        <option key={g.id} value={g.id}>
                          {brigadeName ? `${brigadeName} - ` : ''}{g.name}
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="submit"
                    disabled={!selectedGroupId || isAdding}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-md shadow-2xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                  >
                    <Plus size={14} />
                    {isAdding ? uiText.admin.participants.adding : uiText.admin.participants.add}
                  </button>
                </form>

                {/* Entries List */}
                {loading && entries.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-xs">{uiText.admin.participants.loadingStartList}</div>
                ) : currentCategoryEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 text-xs">
                    {uiText.admin.participants.noGroupsRegistered}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {currentCategoryEntries.map((entry) => {
                      const isOpen = entry.runStatus === 'OPEN';
                      const openIndex = isOpen ? openEntries.indexOf(entry) : -1;

                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between p-2 sm:p-2.5 rounded-lg border transition-all ${
                            isOpen ? 'bg-white border-slate-200 shadow-2xs hover:border-slate-300' : 'bg-slate-50 border-slate-200/60 opacity-60'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold font-mono shrink-0 ${
                              isOpen ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {isOpen ? entry.startOrderPosition : '-'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs sm:text-sm truncate leading-tight">
                                {entry.fireBrigadeName ? `${entry.fireBrigadeName} - ` : ''}{entry.groupName}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {uiText.admin.participants.status} <span className={isOpen ? 'text-indigo-600 font-semibold' : 'text-slate-400'}>{entry.runStatus}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0 ml-2">
                            {isOpen && (
                              <>
                                <button
                                  onClick={() => handleMove(openEntries, openIndex, 'up')}
                                  disabled={openIndex === 0}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-20 transition-colors cursor-pointer"
                                  title={uiText.admin.participants.moveUp}
                                >
                                  <ChevronUp size={15} />
                                </button>
                                <button
                                  onClick={() => handleMove(openEntries, openIndex, 'down')}
                                  disabled={openIndex === openEntries.length - 1}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-20 transition-colors cursor-pointer"
                                  title={uiText.admin.participants.moveDown}
                                >
                                  <ChevronDown size={15} />
                                </button>
                                <button
                                  onClick={() => handleRemove(entry.id)}
                                  disabled={removingId === entry.id}
                                  className="ml-1 p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 focus:outline-none rounded-md disabled:opacity-30 transition-colors cursor-pointer"
                                  title={uiText.admin.participants.removeEntry}
                                  aria-label={uiText.admin.participants.removeEntry}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </AdminCard>
            )}
          </>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            {uiText.admin.participants.noSetup}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TAB: STAMMDATEN                                                    */}
      {/* ========================================================================= */}
      <div className={activeSubTab === 'stammdaten' ? 'space-y-4' : 'hidden'}>

        {/* Brigades Section */}
        <AdminCard className="!p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{uiText.admin.participants.brigades}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                  {brigades.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {uiText.admin.participants.brigadesDescription}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateBrigade} className="flex gap-2 mb-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <input
              type="text"
              placeholder={uiText.admin.participants.brigadeNamePlaceholder}
              value={newBrigadeName}
              onChange={e => setNewBrigadeName(e.target.value)}
              className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all shadow-2xs"
            />
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-1.5 rounded-md font-bold transition-all shadow-2xs text-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              {uiText.admin.participants.add}
            </button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">{uiText.admin.participants.name}</th>
                  <th className="px-3 py-2">{uiText.admin.participants.groups}</th>
                  <th className="px-3 py-2 text-right">{uiText.admin.participants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brigades.map(b => {
                  const bGroupsCount = groups.filter(g => g.fireBrigadeId === b.id).length;
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2 text-slate-900 font-semibold">{b.name}</td>
                      <td className="px-3 py-2 text-slate-500 font-mono">
                        {uiText.admin.participants.groupCount(bGroupsCount)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteBrigade(b.id, b.name)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 focus:outline-none rounded-md transition-colors inline-flex items-center justify-center cursor-pointer"
                          title={uiText.admin.participants.deleteBrigadeConfirm(b.name)}
                          aria-label={uiText.admin.participants.deleteBrigadeConfirm(b.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {brigades.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-xs">
                      {uiText.admin.participants.noBrigades}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>

        {/* Groups Section */}
        <AdminCard className="!p-4 sm:!p-5">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{uiText.admin.participants.groups}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                  {filteredGroups.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {uiText.admin.participants.groupsDescription}
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateGroup} className="flex gap-2 mb-3 flex-wrap bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <select
              value={selectedBrigade}
              onChange={e => setSelectedBrigade(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 min-w-[180px] shadow-2xs"
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
              className="flex-1 bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 min-w-[140px] shadow-2xs"
            />

            <select
              value={newGroupType}
              onChange={e => setNewGroupType(e.target.value)}
              className="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 min-w-[130px] shadow-2xs"
              aria-label={uiText.admin.participants.selectCompetitionClass}
            >
              {competitionClasses.map(cc => (
                <option key={cc.id} value={cc.name}>{cc.name}</option>
              ))}
            </select>

            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 py-1.5 rounded-md font-bold transition-all shadow-2xs text-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus size={14} />
              {uiText.admin.participants.createGroup}
            </button>
          </form>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2">{uiText.admin.participants.brigade}</th>
                  <th className="px-3 py-2">{uiText.admin.participants.group}</th>
                  <th className="px-3 py-2">{uiText.admin.participants.competitionClass}</th>
                  <th className="px-3 py-2 text-right">{uiText.admin.participants.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map(g => {
                  const brigade = brigades.find(b => b.id === g.fireBrigadeId);
                  return (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2 text-slate-700">{brigade?.name || uiText.admin.participants.unknown}</td>
                      <td className="px-3 py-2 text-slate-900 font-semibold">{g.name}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700">
                          {g.competitionClass}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleDeleteGroup(g.id, g.name)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 focus:text-red-700 focus:bg-red-50 focus:outline-none rounded-md transition-colors inline-flex items-center justify-center cursor-pointer"
                          title={uiText.admin.participants.deleteGroupConfirm(g.name)}
                          aria-label={uiText.admin.participants.deleteGroupConfirm(g.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs">
                      {uiText.admin.participants.noGroups}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
