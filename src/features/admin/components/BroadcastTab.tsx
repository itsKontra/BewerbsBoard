import { useState, useEffect } from 'react';
import type { ConfigState } from './SettingsTab';
import type { TvPresentationConfig } from '../../../../shared/domain/tv-presentation';
import { uiText } from '../../../ui-text';
import { AdminCard } from './AdminCard';
import { Tv, RotateCw, Pin, Trophy, Megaphone, Settings, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';
import type { AdminTabId } from './AdminLayout';

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
      const cfgRes = await fetch('/api/admin/config');
      if (!cfgRes.ok) throw new Error(uiText.admin.broadcast.configLoadError);
      const currentCfg = await cfgRes.json();
      const putRes = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...currentCfg,
          tvAnnouncement: editAnnouncement,
        }),
      });
      if (!putRes.ok) throw new Error(uiText.admin.broadcast.announcementSaveError);
      setAnnouncement(editAnnouncement);
      setIsEditingAnnouncement(false);

      if (activateMessageMode) {
        await handleModeChange('MESSAGE');
      }
      setAnnouncementSuccess(uiText.admin.broadcast.announcementSaved);
    } catch (err: any) {
      setError(err.message || uiText.admin.broadcast.announcementSaveError);
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
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
        <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
        <p className="text-sm">{uiText.admin.broadcast.loading}</p>
      </div>
    );
  }

  const activeMode = tvState?.mode || 'ROTATION';
  const categoryKeys = Object.keys(categories).sort(
    (a, b) => (categories[a]?.order || 99) - (categories[b]?.order || 99)
  );

  return (
    <div className="space-y-4">
      {updating && (
        <div className="fixed inset-0 bg-slate-900/30 z-50 flex items-center justify-center backdrop-blur-xs">
          <div className="bg-white px-5 py-3 rounded-xl shadow-lg flex items-center space-x-3 border border-slate-200">
            <Loader2 className="animate-spin text-indigo-600" size={18} />
            <span className="text-xs font-bold text-slate-700">{uiText.admin.broadcast.updating}</span>
          </div>
        </div>
      )}

      {/* Admin Splash Active Notice Banner */}
      {tvPresentation?.adminSplashEnabled && (
        <div
          className="bg-amber-50 border border-amber-300/80 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-2xs"
          data-testid="admin-splash-active-banner"
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-amber-200/60 rounded-lg text-amber-800 shrink-0">
              <Tv size={18} />
            </div>
            <div>
              <strong className="block text-xs font-bold text-amber-950">
                {uiText.admin.broadcast.adminSplashActiveBanner}
              </strong>
              <p className="text-[11px] text-amber-800 mt-0.5">
                {uiText.admin.settings.adminSplashHelp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisableAdminSplash}
            disabled={updating}
            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold border border-amber-500/40 rounded-lg text-xs transition-all whitespace-nowrap shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
          >
            {uiText.admin.broadcast.disableSplashButton}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2 font-semibold">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-700 p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {announcementSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2 font-semibold">
            <CheckCircle2 size={16} />
            <span>{announcementSuccess}</span>
          </div>
          <button type="button" onClick={() => setAnnouncementSuccess(null)} className="text-emerald-400 hover:text-emerald-700 p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {rankingPageDurationSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center space-x-2 font-semibold">
            <CheckCircle2 size={16} />
            <span>{rankingPageDurationSuccess}</span>
          </div>
          <button type="button" onClick={() => setRankingPageDurationSuccess(null)} className="text-emerald-400 hover:text-emerald-700 p-1 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Control Station Top Deck */}
      <AdminCard className="!p-3.5 sm:!p-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2.5">
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {uiText.admin.broadcast.title}
              </h3>
              <div className="inline-flex items-center space-x-1.5 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-md">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                <span className="font-mono font-bold text-indigo-700 text-xs tracking-wider">{activeMode}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {uiText.admin.broadcast.subtitle}
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-end">
            {/* Quick Duration Setting Inline */}
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
              <label htmlFor="ranking-page-duration" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {uiText.admin.broadcast.pageDuration}
              </label>
              <input
                id="ranking-page-duration"
                type="number"
                min={1}
                max={300}
                step={1}
                value={rankingPageDurationSeconds}
                onChange={(event) => setRankingPageDurationSeconds(Number(event.target.value))}
                className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs text-center font-mono font-bold text-slate-800 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleSaveRankingPageDuration}
                disabled={savingRankingPageDuration}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap"
              >
                {savingRankingPageDuration ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveDuration}
              </button>
            </div>

            <button
              type="button"
              onClick={navigateToSettingsTab}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 text-xs font-semibold border border-slate-200 transition-colors flex items-center space-x-1.5 shadow-2xs"
              title={uiText.admin.broadcast.settingsTitle}
            >
              <Settings size={13} className="text-slate-400" />
              <span>{uiText.admin.broadcast.settings}</span>
            </button>
          </div>
        </div>
      </AdminCard>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        {/* 1. ROTATION MODE */}
        <button
          onClick={() => handleModeChange('ROTATION')}
          className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
            activeMode === 'ROTATION'
              ? 'bg-indigo-50/40 border-indigo-600 shadow-xs ring-1 ring-indigo-500/30'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-2xs'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className={`p-2 rounded-lg mb-2.5 ${activeMode === 'ROTATION' ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'}`}>
              <RotateCw size={18} />
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'ROTATION' ? 'border-indigo-600' : 'border-slate-300'
            }`}>
              {activeMode === 'ROTATION' && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
            </div>
          </div>
          <h4 className="text-sm font-bold text-slate-900 mb-0.5">{uiText.admin.broadcast.rotation}</h4>
          <p className="text-xs text-slate-500 leading-normal">
            {uiText.admin.broadcast.rotationHelp}
          </p>
        </button>

        {/* 2. FIXED MODE */}
        <div
          className={`p-4 rounded-xl border transition-all flex flex-col ${
            activeMode === 'FIXED'
              ? 'bg-blue-50/40 border-blue-600 shadow-xs ring-1 ring-blue-500/30'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('FIXED')}
          >
            <div className={`p-2 rounded-lg mb-2.5 ${activeMode === 'FIXED' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'}`}>
              <Pin size={18} />
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'FIXED' ? 'border-blue-600' : 'border-slate-300'
            }`}>
              {activeMode === 'FIXED' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('FIXED')}>
            <h4 className="text-sm font-bold text-slate-900 mb-0.5">{uiText.admin.broadcast.fixed}</h4>
            <p className="text-xs text-slate-500 leading-normal mb-3">
              {uiText.admin.broadcast.fixedHelp}
            </p>
          </div>
          
          <div className={`mt-auto pt-2 border-t border-slate-100 transition-opacity ${activeMode === 'FIXED' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {uiText.admin.broadcast.selectCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('FIXED', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 shadow-2xs transition-all"
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
          className={`p-4 rounded-xl border transition-all flex flex-col ${
            activeMode === 'WINNERS'
              ? 'bg-amber-50/40 border-amber-500 shadow-xs ring-1 ring-amber-500/30'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('WINNERS')}
          >
            <div className={`p-2 rounded-lg mb-2.5 ${activeMode === 'WINNERS' ? 'bg-amber-500 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'}`}>
              <Trophy size={18} />
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'WINNERS' ? 'border-amber-500' : 'border-slate-300'
            }`}>
              {activeMode === 'WINNERS' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('WINNERS')}>
            <h4 className="text-sm font-bold text-slate-900 mb-0.5">{uiText.admin.broadcast.winners}</h4>
            <p className="text-xs text-slate-500 leading-normal mb-3">
              {uiText.admin.broadcast.winnersHelp}
            </p>
          </div>

          <div className={`mt-auto pt-2 border-t border-slate-100 transition-opacity ${activeMode === 'WINNERS' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              {uiText.admin.broadcast.selectWinnerCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('WINNERS', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 shadow-2xs transition-all"
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
          className={`p-4 rounded-xl border transition-all flex flex-col ${
            activeMode === 'MESSAGE'
              ? 'bg-purple-50/40 border-purple-600 shadow-xs ring-1 ring-purple-500/30'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('MESSAGE')}
          >
            <div className={`p-2 rounded-lg mb-2.5 ${activeMode === 'MESSAGE' ? 'bg-purple-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600'}`}>
              <Megaphone size={18} />
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'MESSAGE' ? 'border-purple-600' : 'border-slate-300'
            }`}>
              {activeMode === 'MESSAGE' && <div className="w-2 h-2 rounded-full bg-purple-600" />}
            </div>
          </div>
          <div className="cursor-pointer mb-2" onClick={() => handleModeChange('MESSAGE')}>
            <h4 className="text-sm font-bold text-slate-900 mb-0.5">{uiText.admin.broadcast.announcement}</h4>
            <p className="text-xs text-slate-500 leading-normal">
              {uiText.admin.broadcast.announcementHelp}
            </p>
          </div>

          <div className="mt-auto pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {isEditingAnnouncement ? uiText.admin.broadcast.editAnnouncement : uiText.admin.broadcast.currentAnnouncement}
              </span>
              <button
                type="button"
                onClick={() => setIsEditingAnnouncement(!isEditingAnnouncement)}
                className="text-xs text-purple-600 hover:text-purple-800 font-semibold underline cursor-pointer"
              >
                {isEditingAnnouncement ? uiText.admin.broadcast.preview : uiText.admin.broadcast.editText}
              </button>
            </div>

            {isEditingAnnouncement ? (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-2 shadow-2xs">
                <div>
                  <label htmlFor="quick-announcement-headline" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.headline}
                  </label>
                  <input
                    id="quick-announcement-headline"
                    type="text"
                    value={editAnnouncement.headline}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, headline: e.target.value })}
                    placeholder={uiText.admin.broadcast.headlinePlaceholder}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label htmlFor="quick-announcement-message" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.message}
                  </label>
                  <textarea
                    id="quick-announcement-message"
                    rows={2}
                    value={editAnnouncement.message}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, message: e.target.value })}
                    placeholder={uiText.admin.broadcast.messagePlaceholder}
                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-purple-500 resize-none shadow-2xs"
                  />
                </div>
                <div className="flex items-center justify-end space-x-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAnnouncement(announcement);
                      setIsEditingAnnouncement(false);
                    }}
                    disabled={savingAnnouncement}
                    className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    {uiText.admin.broadcast.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndBroadcastAnnouncement(true)}
                    disabled={savingAnnouncement}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center space-x-1 cursor-pointer"
                  >
                    {savingAnnouncement ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveAndShow}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                {announcement.headline || announcement.message ? (
                  <>
                    {announcement.headline && <div className="font-bold text-slate-900 text-xs mb-0.5">{announcement.headline}</div>}
                    {announcement.message && <div className="text-xs text-slate-600 break-words">{announcement.message}</div>}
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">{uiText.admin.broadcast.noAnnouncement}</span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
