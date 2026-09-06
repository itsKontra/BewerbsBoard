import { useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, ChartNoAxesColumnIncreasing, Check, ChevronRight, Flag, Flame, Radio, RefreshCw, Search, ShieldCheck, Star, UsersRound, WifiOff, X } from 'lucide-react';
import { uiText } from '../../../ui-text';
import { usePublicResults } from '../hooks/usePublicResults';
import { PublicEntryList, PublicResultsList } from './PublicResultsList';
import { brigadeKey, matchesSearch } from '../utils/public-participants';
import type { CategoryResultData } from '../types';
import './public-scoreboard.css';

export type { RunResultRow, RankedResultRow, OpenEntryRow, DnfEntryRow, CategoryResultData, PublicResultsApiResponse } from '../types';

const text = uiText.publicScoreboard;
const FAVORITES_KEY = 'bewerbsboard:favorite-brigades';
type View = 'results' | 'starts' | 'favorites';

function loadFavorites(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="public-empty" role="status">
    <Flag size={25} strokeWidth={1.5} aria-hidden="true" />
    <h3>{title}</h3>
    {hint && <p>{hint}</p>}
  </div>;
}

export function PublicScoreboard() {
  const { data, loading, error, lastUpdated, refresh, isDemo } = usePublicResults();
  const [selectedKey, setSelectedKey] = useState('');
  const [view, setView] = useState<View>('results');
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState(loadFavorites);
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  const categories = Object.entries(data?.categories || {})
    .filter(([, category]) => category.publicEnabled !== false)
    .sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99));
  const activeKey = categories.some(([key]) => key === selectedKey) ? selectedKey : categories[0]?.[0];
  const activeCategory = data?.categories[activeKey];
  const brigades = new Set(categories.flatMap(([, category]) => [...category.rankedResults, ...category.openEntries, ...category.dnfEntries].map(brigadeKey)));
  const finished = activeCategory ? activeCategory.rankedResults.length + activeCategory.dnfEntries.length : 0;
  const total = finished + (activeCategory?.openEntries.length || 0);
  const progress = total > 0 ? (finished / total) * 100 : 0;

  const toggleFavorite = (key: string) => {
    const next = favorites.includes(key) ? favorites.filter((item) => item !== key) : [...favorites, key];
    setFavorites(next);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* Favorites still work for this visit when storage is unavailable. */ }
  };
  const favoriteProps = { favorites, onToggleFavorite: toggleFavorite };

  const filterCategory = (category: CategoryResultData, savedOnly = false): CategoryResultData => {
    const matches = (item: Parameters<typeof matchesSearch>[0]) => matchesSearch(item, query) && (!savedOnly || favorites.includes(brigadeKey(item)));
    return {
      ...category,
      rankedResults: category.rankedResults.filter(matches),
      openEntries: category.openEntries.filter(matches).toSorted((a, b) => (a.startOrderPosition ?? Infinity) - (b.startOrderPosition ?? Infinity)),
      dnfEntries: category.dnfEntries.filter(matches),
    };
  };
  const filtered = activeCategory ? filterCategory(activeCategory) : undefined;
  const savedCategories = categories.map(([key, category]) => [key, filterCategory(category, true)] as const)
    .filter(([, category]) => category.rankedResults.length + category.openEntries.length + category.dnfEntries.length > 0);
  const hasSearchResults = filtered && (view === 'starts'
    ? filtered.openEntries.length > 0
    : filtered.rankedResults.length + filtered.openEntries.length + filtered.dnfEntries.length > 0);

  const switchView = (next: View) => {
    setView(next);
    setQuery('');
    if (window.scrollY > 220) contentRef.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <div className="public-scoreboard" lang="de">
      <a className="public-skip-link" href="#public-results">{text.results}</a>
      <header className="public-header">
        <div className="public-header-inner">
          <a href="/" className="public-brand" aria-label={uiText.common.productName}>
            <span className="public-brand-symbol"><Flame size={22} strokeWidth={2} aria-hidden="true" /></span>
            <span>Bewerbs<span className="public-brand-light">Board</span><span className="public-brand-dot">.</span></span>
          </a>
          <span className={`public-live-status${error ? ' is-offline' : ''}`} role="status">
            {error ? <WifiOff size={13} aria-hidden="true" /> : <span className={`public-live-dot${loading ? ' is-connecting' : ''}`} />}
            {error ? text.offline : loading ? text.connecting : isDemo ? text.demo : text.live}
          </span>
        </div>
      </header>

      <div className="public-event-wrap">
        <section className="public-event" aria-labelledby="public-event-title">
          <div className="public-event-face">
            <svg className="public-race-lanes" viewBox="0 0 200 270" fill="none" aria-hidden="true">
              <path d="M203 -30V110C203 210 46 155 46 257V310" />
              <path d="M181 -30V103C181 191 24 139 24 250V310" />
              <path d="M159 -30V96C159 172 2 123 2 243V310" />
              <path d="M137 -30V89C137 153 -20 107 -20 236V310" />
            </svg>
            <div className="public-event-eyebrow"><Radio size={13} aria-hidden="true" />{text.liveResults}<span className="public-event-sport">{text.sport}</span></div>
            <h1 id="public-event-title">{data?.eventTitle || text.defaultCompetitionTitle}</h1>
            <ArrowDownRight className="public-event-arrow" size={33} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="public-event-meta">
            <span><ShieldCheck size={14} aria-hidden="true" />{text.sport}</span>
            {data && <span><UsersRound size={14} aria-hidden="true" />{text.brigadesCount(brigades.size)}</span>}
            {data && <span className="public-event-category-count"><Flag size={14} aria-hidden="true" />{text.categoriesCount(categories.length)}</span>}
          </div>
        </section>
      </div>

      {categories.length > 0 && view !== 'favorites' && (
        <nav className="public-category-nav" aria-label={text.categories}>
          <div className="public-category-tabs">
            {categories.map(([key, category]) => (
              <button
                type="button"
                key={key}
                aria-pressed={key === activeKey}
                data-testid={`category-tab-${key}`}
                className={`public-category-tab${key === activeKey ? ' is-active' : ''}`}
                onClick={(event) => {
                  setSelectedKey(key);
                  event.currentTarget.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
                }}
              >
                {category.displayName}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="public-content" id="public-results" ref={contentRef}>
        {error && <div className="public-error" role="alert">
          <WifiOff size={18} aria-hidden="true" />
          <div><strong>{data ? text.offline : text.loadingErrorTitle}</strong><p>{data ? text.staleHint : error}</p>
            <button type="button" onClick={() => { void refresh(); }}>{text.retry}<RefreshCw size={13} aria-hidden="true" /></button>
          </div>
        </div>}

        {loading && !data && <div className="public-loading" role="status"><span className="public-loading-track" /><p>{text.loadingResults}</p></div>}

        {data && categories.length === 0 && <EmptyState title={text.noCategories} hint={text.noCategoriesHint} />}

        {data && categories.length > 0 && <>
          <div className="public-section-heading">
            <div>
              <p className="public-eyebrow">{view === 'favorites' ? text.allSavedCategories : view === 'starts' ? text.startOrder : text.interimResult}</p>
              <h2>{view === 'favorites' ? text.myBrigade : view === 'starts' ? text.startList : activeCategory?.displayName}</h2>
            </div>
          </div>

          {activeCategory?.type === 'standard' && view === 'results' && <div className="public-progress">
            <div className="public-progress-label"><span>{text.progress(finished, total)}</span><span>{total > 0 && finished === total ? <Check size={13} aria-hidden="true" /> : <><span className="public-pending-dot" />{text.openCount(activeCategory.openEntries.length)}</>}</span></div>
            <div className="public-progress-track" role="progressbar" aria-label={text.progress(finished, total)} aria-valuenow={finished} aria-valuemin={0} aria-valuemax={total || 1}><span style={{ width: `${progress}%` }} /></div>
          </div>}

          {(view !== 'favorites' || favorites.length > 0) && <div className="public-search" role="search">
            <Search size={18} strokeWidth={1.8} aria-hidden="true" />
            <input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label={text.search} placeholder={text.search} />
            {query && <button type="button" aria-label={text.clearSearch} onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}
          </div>}

          {view === 'favorites' ? <>
            {favorites.length === 0 ? <div className="public-favorites-empty">
              <span className="public-favorites-illustration"><ShieldCheck size={57} strokeWidth={1.2} /><Star size={24} fill="currentColor" /></span>
              <h3>{text.favoritesTitle}</h3><p>{text.favoritesHint}</p>
              <button type="button" className="public-primary-button" onClick={() => {
                switchView('results');
                requestAnimationFrame(() => searchRef.current?.focus());
              }}>{text.findBrigade}<ArrowRight size={17} aria-hidden="true" /></button>
            </div> : savedCategories.length === 0 ? <EmptyState title={query ? text.noSearchResults : text.noSavedResults} hint={query ? text.noSearchResultsHint : text.noSavedResultsHint} /> : savedCategories.map(([key, category]) => (
              <section className="public-saved-category" key={key} aria-label={category.displayName}>
                <h3>{category.displayName}<ChevronRight size={16} aria-hidden="true" /></h3>
                {category.rankedResults.length > 0 && <PublicResultsList category={category} {...favoriteProps} />}
                {category.openEntries.length > 0 && <><p className="public-list-caption">{text.pending}</p><PublicEntryList entries={category.openEntries} {...favoriteProps} /></>}
                {category.dnfEntries.length > 0 && <><p className="public-list-caption">{text.disqualified}</p><PublicEntryList entries={category.dnfEntries} dnf {...favoriteProps} /></>}
              </section>
            ))}
          </> : filtered && <>
            {query && !hasSearchResults ? <EmptyState title={text.noSearchResults} hint={text.noSearchResultsHint} /> : <>
              {view === 'results' && <section aria-label={text.rankingList}>
                {filtered.rankedResults.length > 0 ? <PublicResultsList category={filtered} {...favoriteProps} /> : !query && <EmptyState title={text.noRankedTimes} hint={text.waitingHint} />}
                {filtered.rankedResults.length > 0 && <p className="public-scoring-note">{text.scoringHint}</p>}
              </section>}
              {filtered.type === 'standard' && (view === 'starts' || !query || filtered.openEntries.length > 0) && <section className="public-upcoming" aria-label={text.upcomingStarts}>
                <div className="public-subheading"><h3><Flag size={16} aria-hidden="true" />{text.upcomingStarts}</h3><span>{filtered.openEntries.length}</span></div>
                {filtered.openEntries.length > 0 ? <PublicEntryList entries={filtered.openEntries} {...favoriteProps} /> : <EmptyState title={text.noPendingRuns} />}
              </section>}
              {filtered.type === 'combined' && view === 'starts' && <EmptyState title={text.startList} hint={text.combinedStartHint} />}
              {view === 'results' && filtered.type === 'standard' && filtered.dnfEntries.length > 0 && <section className="public-upcoming" aria-label={text.disqualified}>
                <div className="public-subheading"><h3>{text.disqualified}</h3><span>{filtered.dnfEntries.length}</span></div>
                <PublicEntryList entries={filtered.dnfEntries} dnf {...favoriteProps} />
              </section>}
            </>}
          </>}

          {view !== 'favorites' && <button className="public-save-hint" type="button" onClick={() => switchView('favorites')}><Star size={15} aria-hidden="true" /><span>{text.saveHint}</span><ChevronRight size={15} aria-hidden="true" /></button>}
        </>}

        {lastUpdated && <div className="public-update-note"><RefreshCw size={12} aria-hidden="true" /><span>{text.lastUpdated(lastUpdated.toLocaleTimeString('de-AT'))}<span>{text.autoUpdates}</span></span></div>}
        <footer className="public-footer"><Flame size={15} aria-hidden="true" /><span>{uiText.common.productName}</span><span>© {new Date().getFullYear()}</span></footer>
      </main>

      <nav className="public-bottom-nav" aria-label={text.navigation}>
        <div className="public-bottom-nav-inner">
          {([{ id: 'results', label: text.results, Icon: ChartNoAxesColumnIncreasing }, { id: 'starts', label: text.startList, Icon: Flag }, { id: 'favorites', label: text.myBrigade, Icon: Star }] as const).map(({ id, label, Icon }) => (
            <button key={id} type="button" aria-label={label} aria-current={view === id ? 'page' : undefined} onClick={() => switchView(id)}>
              <span className="public-nav-icon"><Icon size={21} strokeWidth={view === id ? 2.2 : 1.7} aria-hidden="true" />{id === 'favorites' && favorites.length > 0 && <span className="public-favorite-count">{favorites.length}</span>}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
