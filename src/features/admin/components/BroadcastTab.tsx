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
    <div className="space-y-6 @container">
      {updating && (
        <div className="fixed inset-0 bg-slate-900/20 z-50 flex items-center justify-center backdrop-blur-xs">
          <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex items-center space-x-3 border border-slate-100">
            <Loader2 className="animate-spin text-indigo-600" size={20} />
            <span className="text-sm font-semibold text-slate-700">{uiText.admin.broadcast.updating}</span>
          </div>
        </div>
      )}

      {/* Admin Splash Active Notice Banner */}
      {tvPresentation?.adminSplashEnabled && (
        <div
          className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800 shadow-sm"
          data-testid="admin-splash-active-banner"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
              <Tv size={20} />
            </div>
            <div>
              <strong className="block text-sm font-bold text-amber-900">
                {uiText.admin.broadcast.adminSplashActiveBanner}
              </strong>
              <p className="text-xs text-amber-700 mt-0.5">
                {uiText.admin.settings.adminSplashHelp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisableAdminSplash}
            disabled={updating}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-500 active:bg-amber-600 text-slate-950 font-bold border border-amber-500/40 rounded-xl text-xs transition-all whitespace-nowrap shadow-sm cursor-pointer shrink-0 disabled:opacity-50"
          >
            {uiText.admin.broadcast.disableSplashButton}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 font-medium">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-700 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {announcementSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle2 size={18} />
            <span>{announcementSuccess}</span>
          </div>
          <button type="button" onClick={() => setAnnouncementSuccess(null)} className="text-emerald-400 hover:text-emerald-700 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {rankingPageDurationSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2 font-medium">
            <CheckCircle2 size={18} />
            <span>{rankingPageDurationSuccess}</span>
          </div>
          <button type="button" onClick={() => setRankingPageDurationSuccess(null)} className="text-emerald-400 hover:text-emerald-700 p-1">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header and Current State */}
      <AdminCard>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">
              {uiText.admin.broadcast.title}
            </h3>
            <p className="text-xs text-slate-500">
              {uiText.admin.broadcast.subtitle}
            </p>
          </div>
          <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
            <button
              type="button"
              onClick={navigateToSettingsTab}
              className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors flex items-center space-x-2 shadow-sm"
              title={uiText.admin.broadcast.settingsTitle}
            >
              <Settings size={16} className="text-slate-500" />
              <span>{uiText.admin.broadcast.settings}</span>
            </button>

            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                {uiText.admin.broadcast.activeMode}
              </div>
              <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl shadow-xs">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                <span className="font-bold text-indigo-700 text-sm tracking-wide">{activeMode}</span>
              </div>
            </div>
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex-1">
            <label htmlFor="ranking-page-duration" className="block text-sm font-bold text-slate-800 mb-1">
              {uiText.admin.broadcast.pageDuration}
            </label>
            <p className="text-xs text-slate-500 mb-3">
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
              className="w-full sm:w-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 shadow-sm transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleSaveRankingPageDuration}
            disabled={savingRankingPageDuration}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold shadow-sm shadow-indigo-200 transition-all cursor-pointer"
          >
            {savingRankingPageDuration ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveDuration}
          </button>
        </div>
      </AdminCard>

      {/* Mode Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* 1. ROTATION MODE */}
        <button
          onClick={() => handleModeChange('ROTATION')}
          className={`text-left p-6 rounded-2xl border-2 transition-all cursor-pointer ${
            activeMode === 'ROTATION'
              ? 'bg-indigo-50/50 border-indigo-600 shadow-lg shadow-indigo-100 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className={`p-3 rounded-2xl mb-4 ${activeMode === 'ROTATION' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
              <RotateCw size={24} />
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'ROTATION' ? 'border-indigo-600' : 'border-slate-300'
            }`}>
              {activeMode === 'ROTATION' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
            </div>
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">{uiText.admin.broadcast.rotation}</h4>
          <p className="text-sm text-slate-500 leading-relaxed">
            {uiText.admin.broadcast.rotationHelp}
          </p>
        </button>

        {/* 2. FIXED MODE */}
        <div
          className={`p-6 rounded-2xl border-2 transition-all flex flex-col ${
            activeMode === 'FIXED'
              ? 'bg-blue-50/50 border-blue-600 shadow-lg shadow-blue-100 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('FIXED')}
          >
            <div className={`p-3 rounded-2xl mb-4 ${activeMode === 'FIXED' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-600'}`}>
              <Pin size={24} />
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'FIXED' ? 'border-blue-600' : 'border-slate-300'
            }`}>
              {activeMode === 'FIXED' && <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('FIXED')}>
            <h4 className="text-base font-bold text-slate-800 mb-1">{uiText.admin.broadcast.fixed}</h4>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {uiText.admin.broadcast.fixedHelp}
            </p>
          </div>
          
          <div className={`mt-auto pt-2 transition-opacity ${activeMode === 'FIXED' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              {uiText.admin.broadcast.selectCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('FIXED', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-blue-500 shadow-sm transition-all"
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
          className={`p-6 rounded-2xl border-2 transition-all flex flex-col ${
            activeMode === 'WINNERS'
              ? 'bg-amber-50/50 border-amber-500 shadow-lg shadow-amber-100 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('WINNERS')}
          >
            <div className={`p-3 rounded-2xl mb-4 ${activeMode === 'WINNERS' ? 'bg-amber-500 text-white shadow-md shadow-amber-200' : 'bg-slate-100 text-slate-600'}`}>
              <Trophy size={24} />
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'WINNERS' ? 'border-amber-500' : 'border-slate-300'
            }`}>
              {activeMode === 'WINNERS' && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
            </div>
          </div>
          <div className="cursor-pointer" onClick={() => handleModeChange('WINNERS')}>
            <h4 className="text-base font-bold text-slate-800 mb-1">{uiText.admin.broadcast.winners}</h4>
            <p className="text-sm text-slate-500 leading-relaxed mb-4">
              {uiText.admin.broadcast.winnersHelp}
            </p>
          </div>

          <div className={`mt-auto pt-2 transition-opacity ${activeMode === 'WINNERS' ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              {uiText.admin.broadcast.selectWinnerCategory}
            </label>
            <select
              value={tvState?.selectedCategoryId || ''}
              onChange={(e) => handleModeChange('WINNERS', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 shadow-sm transition-all"
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
              ? 'bg-purple-50/50 border-purple-600 shadow-lg shadow-purple-100 ring-2 ring-purple-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
          }`}
        >
          <div 
            className="flex items-start justify-between cursor-pointer"
            onClick={() => handleModeChange('MESSAGE')}
          >
            <div className={`p-3 rounded-2xl mb-4 ${activeMode === 'MESSAGE' ? 'bg-purple-600 text-white shadow-md shadow-purple-200' : 'bg-slate-100 text-slate-600'}`}>
              <Megaphone size={24} />
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              activeMode === 'MESSAGE' ? 'border-purple-600' : 'border-slate-300'
            }`}>
              {activeMode === 'MESSAGE' && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
            </div>
          </div>
          <div className="cursor-pointer mb-4" onClick={() => handleModeChange('MESSAGE')}>
            <h4 className="text-base font-bold text-slate-800 mb-1">{uiText.admin.broadcast.announcement}</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              {uiText.admin.broadcast.announcementHelp}
            </p>
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                <div>
                  <label htmlFor="quick-announcement-headline" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.headline}
                  </label>
                  <input
                    id="quick-announcement-headline"
                    type="text"
                    value={editAnnouncement.headline}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, headline: e.target.value })}
                    placeholder={uiText.admin.broadcast.headlinePlaceholder}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 shadow-sm"
                  />
                </div>
                <div>
                  <label htmlFor="quick-announcement-message" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {uiText.admin.broadcast.message}
                  </label>
                  <textarea
                    id="quick-announcement-message"
                    rows={2}
                    value={editAnnouncement.message}
                    onChange={(e) => setEditAnnouncement({ ...editAnnouncement, message: e.target.value })}
                    placeholder={uiText.admin.broadcast.messagePlaceholder}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-purple-500 resize-none shadow-sm"
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
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs rounded-xl font-semibold transition-colors"
                  >
                    {uiText.admin.broadcast.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveAndBroadcastAnnouncement(true)}
                    disabled={savingAnnouncement}
                    className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-purple-200 flex items-center space-x-1.5 cursor-pointer"
                  >
                    {savingAnnouncement ? uiText.admin.broadcast.saving : uiText.admin.broadcast.saveAndShow}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {announcement.headline || announcement.message ? (
                  <>
                    {announcement.headline && <div className="font-bold text-slate-800 text-sm mb-1">{announcement.headline}</div>}
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
