import { useState, useEffect } from 'react';
import type { ConfigState } from './SettingsTab';
import type { TvPresentationConfig } from '../../../../shared/domain/tv-presentation';
import { uiText } from '../../../ui-text';

interface CategorySetting {
  name: string;
  publicEnabled: boolean;
  tvEnabled: boolean;
  displayDuration: number;
  order: number;
}

interface TvState {
  mode: 'ROTATION' | 'FIXED' | 'MESSAGE' | 'WINNERS';
  selectedCategoryId: string | null;
  updatedAt?: number;
}

import type { AdminTabId } from './AdminLayout';

export interface BroadcastTabProps {
  onNavigate?: (tab: AdminTabId) => void;
}

export function BroadcastTab({ onNavigate }: BroadcastTabProps = {}) {
  const [tvState, setTvState] = useState<TvState | null>(null);
  const [tvPresentation, setTvPresentation] = useState<TvPresentationConfig | null>(null);
  const [categories, setCategories] = useState<Record<string, CategorySetting>>({});
  const [announcement, setAnnouncement] = useState<{ headline: string; message: string }>({ headline: '', message: '' });
  const [editAnnouncement, setEditAnnouncement] = useState<{ headline: string; message: string }>({ headline: '', message: '' });
  const [isEditingAnnouncement, setIsEditingAnnouncement] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [rankingPageDurationSeconds, setRankingPageDurationSeconds] = useState(8);
  const [savingRankingPageDuration, setSavingRankingPageDuration] = useState(false);
  const [rankingPageDurationSuccess, setRankingPageDurationSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [announcementSuccess, setAnnouncementSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch TV state, display config, and the canonical evaluation types.
      const [tvRes, configRes, evalRes] = await Promise.all([
        fetch('/api/admin/tv-state'),
        fetch('/api/admin/config'),
        fetch('/api/admin/evaluation-types').catch(() => null),
      ]);

      if (!tvRes.ok) throw new Error(uiText.admin.broadcast.tvStateError(tvRes.status));
      if (!configRes.ok) throw new Error(uiText.admin.broadcast.configError(configRes.status));

      const tvData = await tvRes.json();
      const configData: ConfigState = await configRes.json();
      const evalTypes: Array<{ id: string; name: string; public?: boolean; order?: number; displayDurationSeconds?: number; publicTv?: boolean }> =
        evalRes && evalRes.ok ? await evalRes.json().catch(() => []) : [];

      const mergedCategories: Record<string, CategorySetting> = {};
      if (Array.isArray(evalTypes)) {
        evalTypes.forEach((et) => {
          mergedCategories[et.id] = {
            name: et.name,
            publicEnabled: et.public ?? true,
            tvEnabled: et.publicTv ?? true,
            displayDuration: et.displayDurationSeconds ?? 10,
            order: et.order ?? 99,
          };
        });
      }

      setTvState({
        mode: tvData.mode,
        selectedCategoryId: tvData.selectedCategoryId,
        updatedAt: tvData.updatedAt,
      });
      setCategories(mergedCategories);
      setTvPresentation(configData.tvPresentation || null);
      const ann = configData.tvAnnouncement || { headline: '', message: '' };
      setAnnouncement(ann);
      setEditAnnouncement(ann);
      setRankingPageDurationSeconds((configData.rankingPageDurationMs ?? 8000) / 1000);
    } catch (err: any) {
      setError(err.message || uiText.admin.broadcast.loadFallback);
    } finally {
      setLoading(false);
    }
  };

  const handleDisableAdminSplash = async () => {
    setUpdating(true);
    setError(null);
    try {
      const cfgRes = await fetch('/api/admin/config');
      const currentCfg = cfgRes.ok ? await cfgRes.json() : {};
      const updatedCfg = {
        ...currentCfg,
        tvPresentation: {
          ...(currentCfg.tvPresentation || {}),
          adminSplashEnabled: false,
        },
      };
      const putRes = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCfg),
      });
      if (!putRes.ok) {
        throw new Error('Failed to update config');
      }
      setTvPresentation(updatedCfg.tvPresentation);
    } catch (err: any) {
      setError(err.message || 'Error disabling admin splash');
    } finally {
      setUpdating(false);
    }
  };

  const handleModeChange = async (mode: TvState['mode'], categoryId?: string | null) => {
    if (!tvState) return;

    setUpdating(true);
    setError(null);

    // If changing to FIXED or WINNERS without a category, try to pick the first one
    let targetCategoryId = categoryId !== undefined ? categoryId : tvState.selectedCategoryId;
    if ((mode === 'FIXED' || mode === 'WINNERS') && !targetCategoryId) {
      const firstCat = Object.keys(categories)[0];
      if (firstCat) targetCategoryId = firstCat;
    }

    try {
      const res = await fetch('/api/admin/tv-state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, selectedCategoryId: targetCategoryId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.broadcast.updateError(res.status));
      }

      const updated = await res.json();
      setTvState(updated);
    } catch (err: any) {
      setError(err.message || uiText.admin.broadcast.modeFallback);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveAndBroadcastAnnouncement = async (activateMessageMode = true) => {
    setSavingAnnouncement(true);
    setError(null);
    setAnnouncementSuccess(null);

    try {
      // 1. Get current config to preserve other settings
      const cfgRes = await fetch('/api/admin/config');
      const currentCfg = cfgRes.ok ? await cfgRes.json() : {};

      // 2. Put updated config
      const updatedCfg = {
        ...currentCfg,
        tvAnnouncement: {
          headline: editAnnouncement.headline,
          message: editAnnouncement.message,
        },
      };

      const putRes = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCfg),
      });

      if (!putRes.ok) {
        throw new Error(uiText.admin.broadcast.announcementSaveError);
      }

      setAnnouncement(editAnnouncement);
      setIsEditingAnnouncement(false);
      setAnnouncementSuccess(uiText.admin.broadcast.announcementSaved);
      setTimeout(() => setAnnouncementSuccess(null), 3000);

      // 3. Activate MESSAGE mode if requested
      if (activateMessageMode) {
        await handleModeChange('MESSAGE');
      }
    } catch (err: any) {
      setError(err.message || uiText.admin.broadcast.announcementFallback);
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const handleSaveRankingPageDuration = async () => {
    if (!Number.isFinite(rankingPageDurationSeconds) || rankingPageDurationSeconds < 1 || rankingPageDurationSeconds > 300) {
      setError(uiText.admin.broadcast.durationRangeError);
      return;
    }

    setSavingRankingPageDuration(true);
    setError(null);
    setRankingPageDurationSuccess(null);
    try {
      const cfgRes = await fetch('/api/admin/config');
      if (!cfgRes.ok) throw new Error(uiText.admin.broadcast.configLoadError);
      const currentCfg = await cfgRes.json();
      const putRes = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentCfg,
          rankingPageDurationMs: rankingPageDurationSeconds * 1000,
        }),
      });
      if (!putRes.ok) throw new Error(uiText.admin.broadcast.durationSaveError);
      setRankingPageDurationSuccess(uiText.admin.broadcast.durationSaved);
    } catch (err: any) {
      setError(err.message || uiText.admin.broadcast.durationSaveError);
    } finally {
      setSavingRankingPageDuration(false);
    }
  };

  const navigateToSettingsTab = () => {
    onNavigate?.('settings');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-oswald uppercase tracking-wider text-sm">{uiText.admin.broadcast.loading}</p>
      </div>
    );
  }

  const activeMode = tvState?.mode || 'ROTATION';
  const categoryKeys = Object.keys(categories).sort(
    (a, b) => (categories[a]?.order || 99) - (categories[b]?.order || 99)
  );

  return (
    <div className="space-y-6 @container">
      {updating && (
        <div className="absolute inset-0 bg-neutral-950/40 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[1px]">
          <div className="bg-neutral-900 border border-neutral-700 px-6 py-4 rounded-xl shadow-2xl flex items-center space-x-3">
            <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-oswald uppercase tracking-widest text-sm text-neutral-200">{uiText.admin.broadcast.updating}</span>
          </div>
        </div>
      )}

      {/* Admin Splash Active Notice Banner */}
      {tvPresentation?.adminSplashEnabled && (
        <div
          className="bg-amber-950/80 border border-amber-800/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-200 shadow-xl"
          data-testid="admin-splash-active-banner"
        >
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📺</span>
            <div>
              <strong className="block text-sm text-amber-100 font-bold">
                {uiText.admin.broadcast.adminSplashActiveBanner}
              </strong>
              <p className="text-xs text-amber-300/80 mt-0.5">
                {uiText.admin.settings.adminSplashHelp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisableAdminSplash}
            disabled={updating}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors whitespace-nowrap shadow-md cursor-pointer shrink-0"
          >
            {uiText.admin.broadcast.disableSplashButton}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-white text-xs font-mono">
            ✕
          </button>
        </div>
      )}

      {announcementSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <span>✅</span>
            <span>{announcementSuccess}</span>
          </div>
          <button type="button" onClick={() => setAnnouncementSuccess(null)} className="text-emerald-400 hover:text-white text-xs font-mono">
            ✕
          </button>
        </div>
      )}

      {rankingPageDurationSuccess && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2 text-sm font-semibold">
            <span>✅</span>
            <span>{rankingPageDurationSuccess}</span>
          </div>
          <button type="button" onClick={() => setRankingPageDurationSuccess(null)} className="text-emerald-400 hover:text-white text-xs font-mono">
            ✕
          </button>
        </div>
      )}

      {/* Header and Current State */}
      <section className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-oswald text-xl font-bold text-white uppercase tracking-wider mb-1">
            {uiText.admin.broadcast.title}
          </h3>
          <p className="text-xs text-neutral-400">
            {uiText.admin.broadcast.subtitle}
          </p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={navigateToSettingsTab}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition-colors flex items-center space-x-1.5"
            title={uiText.admin.broadcast.settingsTitle}
          >
            <span>⚙️</span>
            <span>{uiText.admin.broadcast.settings}</span>
          </button>

          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
              {uiText.admin.broadcast.activeMode}
            </div>
            <div className="inline-flex items-center space-x-2 bg-neutral-950 border border-neutral-700 px-4 py-2 rounded-xl shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-oswald font-bold text-white tracking-widest">{activeMode}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label htmlFor="ranking-page-duration" className="block font-oswald text-base font-bold text-white uppercase tracking-wider mb-2">
              {uiText.admin.broadcast.pageDuration}
            </label>
            <p className="text-xs text-neutral-400 mb-3">
              {uiText.admin.broadcast.pageDurationHelp}
            </p>
            <input
              id="ranking-page-duration"
              type="number"
              min={1}
              max={300}
              step={1}
              value={rankingPageDurationSeconds}
              onChange={(event) => setRankingPageDurationSeconds(Number(event.target.value))}
              className="w-full sm:w-40 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500 shadow-inner"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveRankingPageDuration}
            disabled={savingRankingPageDuration}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            {savingRankingPageDuration ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveDuration}
          </button>
        </div>
      </section>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. ROTATION MODE */}
        <button
          onClick={() => handleModeChange('ROTATION')}
          className={`text-left p-6 rounded-2xl border-2 transition-all ${
            activeMode === 'ROTATION'
              ? 'bg-red-950/30 border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.2)] ring-1 ring-red-500/50'
              : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/60'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="text-3xl mb-3">🔄</div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'ROTATION' ? 'border-red-500' : 'border-neutral-600'
            }`}>
              {activeMode === 'ROTATION' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
            </div>
          </div>
          <h4 className="font-oswald text-lg font-bold text-white uppercase tracking-wider mb-1">{uiText.admin.broadcast.rotation}</h4>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {uiText.admin.broadcast.rotationHelp}
          </p>
        </button>

        {/* 2. FIXED MODE */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all ${
            activeMode === 'FIXED'
              ? 'bg-blue-950/20 border-blue-600 shadow-[0_0_25px_rgba(37,99,235,0.2)] ring-1 ring-blue-500/50'
              : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('FIXED')}
          >
            <div className="text-3xl mb-3">📌</div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'FIXED' ? 'border-blue-500' : 'border-neutral-600'
            }`}>
              {activeMode === 'FIXED' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('FIXED')}>
            <h4 className="font-oswald text-lg font-bold text-white uppercase tracking-wider mb-1">{uiText.admin.broadcast.fixed}</h4>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4">
              {uiText.admin.broadcast.fixedHelp}
            </p>
          </div>
          
          <div className={`transition-opacity ${activeMode === 'FIXED' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
              {uiText.admin.broadcast.selectCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('FIXED', e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 shadow-inner"
            >
              <option value="" disabled>{uiText.admin.broadcast.pleaseSelect}</option>
              {categoryKeys.map(k => (
                <option key={k} value={k}>{categories[k].name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 3. WINNERS MODE */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all ${
            activeMode === 'WINNERS'
              ? 'bg-amber-950/20 border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.2)] ring-1 ring-amber-500/50'
              : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('WINNERS')}
          >
            <div className="text-3xl mb-3">🏆</div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'WINNERS' ? 'border-amber-500' : 'border-neutral-600'
            }`}>
              {activeMode === 'WINNERS' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('WINNERS')}>
            <h4 className="font-oswald text-lg font-bold text-white uppercase tracking-wider mb-1">{uiText.admin.broadcast.winners}</h4>
            <p className="text-sm text-neutral-400 leading-relaxed mb-4">
              {uiText.admin.broadcast.winnersHelp}
            </p>
          </div>

          <div className={`transition-opacity ${activeMode === 'WINNERS' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-2">
              {uiText.admin.broadcast.selectWinnerCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('WINNERS', e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 shadow-inner"
            >
              <option value="" disabled>{uiText.admin.broadcast.pleaseSelect}</option>
              {categoryKeys.map(k => (
                <option key={k} value={k}>{categories[k].name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4. MESSAGE MODE */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all flex flex-col ${
            activeMode === 'MESSAGE'
              ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/50'
              : 'bg-neutral-900/40 border-neutral-800 hover:border-neutral-700'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('MESSAGE')}
          >
            <div className="text-3xl mb-3">📢</div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'MESSAGE' ? 'border-purple-500' : 'border-neutral-600'
            }`}>
              {activeMode === 'MESSAGE' && <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />}
            </div>
          </div>
          <div className="cursor-pointer mb-4" onClick={() => handleModeChange('MESSAGE')}>
            <h4 className="font-oswald text-lg font-bold text-white uppercase tracking-wider mb-1">{uiText.admin.broadcast.announcement}</h4>
            <p className="text-sm text-neutral-400 leading-relaxed">
              {uiText.admin.broadcast.announcementHelp}
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-neutral-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                {isEditingAnnouncement ? uiText.admin.broadcast.editAnnouncement : uiText.admin.broadcast.currentAnnouncement}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingAnnouncement(!isEditingAnnouncement)}
                className="text-xs text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
              >
                {isEditingAnnouncement ? uiText.admin.broadcast.preview : uiText.admin.broadcast.editText}
              </button>
            </div>

            {isEditingAnnouncement ? (
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 shadow-inner">
                <div>
                  <label htmlFor="quick-announcement-headline" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.headline}
                  </label>
                  <input
                    id="quick-announcement-headline"
                    type="text"
                    value={editAnnouncement.headline}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, headline: e.target.value })}
                    placeholder={uiText.admin.broadcast.headlinePlaceholder}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="quick-announcement-message" className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.message}
                  </label>
                  <textarea
                    id="quick-announcement-message"
                    rows={2}
                    value={editAnnouncement.message}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, message: e.target.value })}
                    placeholder={uiText.admin.broadcast.messagePlaceholder}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAnnouncement(announcement);
                      setIsEditingAnnouncement(false);
                    }}
                    disabled={savingAnnouncement}
                    className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs rounded-lg font-semibold transition-colors"
                  >
                    {uiText.admin.broadcast.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndBroadcastAnnouncement(true)}
                    disabled={savingAnnouncement}
                    className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center space-x-1.5 shadow-md cursor-pointer"
                  >
                    {savingAnnouncement ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveAndShow}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 shadow-inner">
                {announcement.headline || announcement.message ? (
                  <>
                    {announcement.headline && <div className="font-bold text-white text-sm mb-1">{announcement.headline}</div>}
                    {announcement.message && <div className="text-xs text-neutral-300 break-words">{announcement.message}</div>}
                  </>
                ) : (
                  <span className="text-xs text-neutral-600 italic">{uiText.admin.broadcast.noAnnouncement}</span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
