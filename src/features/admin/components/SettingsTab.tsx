import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_TV_PRESENTATION, TV_THEMES, type TvPresentationConfig } from '../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../tv/utils/tv-presentation-styles';
import { uiText } from '../../../ui-text';
import { DataManagementSection } from './settings/DataManagementSection';
import { AdminCard } from './AdminCard';
import { Sliders, QrCode, Database, CheckCircle2, AlertTriangle, X, Loader2, Copy, ExternalLink, Eye, Tv } from 'lucide-react';

export interface ServerInfoState {
  serverIp: string;
  serverPort: number;
  adminUrl: string;
  availableIps: Array<{ interfaceName: string; ip: string }>;
}

export interface ConfigState {
  eventTitle: string;
  publicUrl: string;
  rankingPageDurationMs: number;
  tvAnnouncement: {
    headline: string;
    message: string;
  };
  tvPresentation: TvPresentationConfig;
  serverInfo?: ServerInfoState;
}

export type SettingsSubTab = 'general' | 'qr-code' | 'data-management';

interface SettingsSubTabConfig {
  id: SettingsSubTab;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
}

const SETTINGS_SUB_TABS: SettingsSubTabConfig[] = [
  { id: 'general', label: uiText.admin.settings.generalTab, icon: Sliders },
  { id: 'qr-code', label: uiText.admin.settings.qrTab, icon: QrCode },
  { id: 'data-management', label: uiText.admin.settings.dataTab, icon: Database },
];

const DEFAULT_CONFIG: ConfigState = {
  eventTitle: 'Feuerwehr Leistungsbewerb',
  publicUrl: 'https://bewerb.feuerwehr.at',
  rankingPageDurationMs: 8000,
  tvAnnouncement: {
    headline: '',
    message: '',
  },
  tvPresentation: { ...DEFAULT_TV_PRESENTATION },
};

export function SettingsTab() {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [savedConfig, setSavedConfig] = useState<ConfigState>(DEFAULT_CONFIG);
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('general');
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const configRes = await fetch('/api/admin/config');
      if (!configRes.ok) {
        throw new Error(uiText.admin.settings.loadError(configRes.status));
      }
      const data = await configRes.json();

      const merged: ConfigState = {
        ...DEFAULT_CONFIG,
        ...data,
        tvPresentation: {
          ...DEFAULT_CONFIG.tvPresentation,
          ...data.tvPresentation,
        },
      };
      setConfig(merged);
      setSavedConfig(merged);
    } catch (err: any) {
      setError(err.message || uiText.admin.settings.loadFallback);
    } finally {
      setLoading(false);
    }
  };

  const isDirty = useMemo(() => {
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || uiText.admin.settings.saveError(res.status));
      }

      const updated = await res.json();
      const merged: ConfigState = {
        ...DEFAULT_CONFIG,
        ...updated,
        tvPresentation: {
          ...DEFAULT_CONFIG.tvPresentation,
          ...(updated.tvPresentation || {}),
        },
      };
      setConfig(merged);
      setSavedConfig(merged);
      setSuccessMessage(uiText.admin.settings.saved);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || uiText.admin.settings.saveFallback);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardChanges = () => {
    setConfig(savedConfig);
    setSuccessMessage(uiText.admin.settings.discarded);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(config.publicUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-medium">
        <Loader2 className="animate-spin mb-3 text-indigo-500" size={32} />
        <p className="text-sm">{uiText.admin.settings.loading}</p>
      </div>
    );
  }

  const selectedThemeStyle = TV_PRESENTATION_STYLES[config.tvPresentation.theme] || TV_PRESENTATION_STYLES.broadcast;

  return (
    <div className="space-y-6 pb-20 @container">
      {/* Sleek Segmented Sub-Tab Bar */}
      <AdminCard className="!p-2">
        <div className="flex flex-wrap sm:flex-nowrap gap-2">
          {SETTINGS_SUB_TABS.map((tab) => {
            const isActive = activeSubTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex-1 min-w-[140px] px-4 py-2.5 rounded-xl text-xs @sm:text-sm font-semibold transition-all flex items-center justify-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </AdminCard>

      {/* Alert Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5 text-sm font-medium">
            <AlertTriangle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5 text-sm font-medium">
            <CheckCircle2 size={18} />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-700 p-1"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSave} className="space-y-6">
        
        {/* ========================================================================= */}
        {/* 1. SUB-TAB: ALLGEMEIN & BRANDING                                          */}
        {/* ========================================================================= */}
        <div className={activeSubTab === 'general' ? 'space-y-6' : 'hidden'}>
          
          {/* Live Header & Branding Preview Widget */}
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center space-x-2">
              <Eye size={14} />
              <span>{uiText.admin.settings.livePreview}</span>
            </div>
            
            {/* TV Screen Preview Frame */}
            <div className={`rounded-2xl overflow-hidden border border-slate-200 shadow-md bg-gradient-to-br ${selectedThemeStyle.frameGradient}`}>
              <div className={`p-5 flex items-center justify-between border-b ${selectedThemeStyle.identityRail} ${selectedThemeStyle.textColor}`}>
                <div className="flex items-center space-x-4 truncate">
                  <img
                    alt={uiText.admin.settings.logoPreviewAlt}
                    className="max-h-10 w-auto max-w-28 shrink-0 object-contain object-left"
                    src={config.tvPresentation.logoOverride || '/logo.png'}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/logo.png';
                    }}
                  />
                  <div className="truncate">
                    <div className={`text-[10px] font-bold uppercase tracking-[0.25em] ${selectedThemeStyle.headerSublabel}`}>
                      {config.tvPresentation.headerLabel || DEFAULT_TV_PRESENTATION.headerLabel}
                    </div>
                    <h4 className="text-base @sm:text-xl font-black uppercase tracking-wide truncate font-oswald">
                      {config.eventTitle || uiText.admin.settings.eventTitlePreviewPlaceholder}
                    </h4>
                  </div>
                </div>
                <div className="hidden @sm:flex items-center space-x-2 text-xs font-mono opacity-90 bg-black/30 border border-white/15 px-3 py-1.5 rounded-xl flex-shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{uiText.admin.settings.themePrefix} {selectedThemeStyle.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* General Event & Visual Theme Card */}
          <AdminCard className="space-y-6">
            <div>
              <label htmlFor="eventTitle" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                {uiText.admin.settings.eventTitle}
              </label>
              <input
                id="eventTitle"
                type="text"
                value={config.eventTitle}
                onChange={(e) => setConfig({ ...config, eventTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none transition-all shadow-sm"
                placeholder={uiText.admin.settings.eventTitlePlaceholder}
                required
              />
              <p className="text-[11px] text-slate-400 mt-1.5">
                {uiText.admin.settings.eventTitleHelp}
              </p>
            </div>

            <div className="grid grid-cols-1 @md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div>
                <label htmlFor="tvHeaderLabel" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">
                  {uiText.admin.settings.tvHeader}
                </label>
                <input
                  id="tvHeaderLabel"
                  type="text"
                  value={config.tvPresentation.headerLabel}
                  onChange={(event) => setConfig({
                    ...config,
                    tvPresentation: { ...config.tvPresentation, headerLabel: event.target.value },
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none shadow-sm"
                  placeholder={uiText.admin.settings.tvHeaderPlaceholder}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {uiText.admin.settings.tvHeaderHelp}
                </p>
              </div>

              <div>
                <label htmlFor="tvLogoOverride" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">
                  {uiText.admin.settings.logoOverride}
                </label>
                <input
                  id="tvLogoOverride"
                  inputMode="url"
                  type="text"
                  value={config.tvPresentation.logoOverride}
                  onChange={(event) => setConfig({
                    ...config,
                    tvPresentation: { ...config.tvPresentation, logoOverride: event.target.value },
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none shadow-sm"
                  placeholder={uiText.admin.settings.logoPlaceholder}
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  {uiText.admin.settings.logoHelp} <code className="text-slate-600 font-mono">/logo.png</code>.
                </p>
              </div>
            </div>

            {/* Visual Theme Selection */}
            <fieldset className="pt-4 border-t border-slate-100">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                {uiText.admin.settings.visualTvTheme}
              </legend>
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-3">
                {TV_THEMES.map((themeId) => {
                  const theme = TV_PRESENTATION_STYLES[themeId];
                  return (
                    <label
                      key={themeId}
                      className={`cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                        config.tvPresentation.theme === themeId
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20'
                          : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <input
                        checked={config.tvPresentation.theme === themeId}
                        className="sr-only"
                        name="tv-theme"
                        onChange={() => setConfig({
                          ...config,
                          tvPresentation: { ...config.tvPresentation, theme: themeId },
                        })}
                        type="radio"
                        value={themeId}
                      />
                      <div className={`mb-3 h-24 overflow-hidden rounded-xl bg-gradient-to-br shadow-inner ${theme.frameGradient}`} aria-hidden="true">
                        <div className="flex h-8 items-center justify-between border-b border-white/15 px-3">
                          <span className={`h-2 w-20 rounded-full ${theme.preview.accent}`} />
                          <span className="h-4 w-4 rounded bg-white" />
                        </div>
                        <div className="space-y-1.5 p-2.5">
                          <span className={`block h-2.5 w-1/2 rounded-full ${theme.preview.cardBg}`} />
                          <span className={`block h-1.5 w-full rounded-full ${theme.preview.text}`} />
                          <span className={`block h-1.5 w-4/5 rounded-full ${theme.preview.text}`} />
                        </div>
                      </div>
                      <span className="block text-sm font-bold text-slate-800">{theme.label}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">{theme.summary}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </AdminCard>
        </div>

        {/* ========================================================================= */}
        {/* 2. SUB-TAB: QR-CODE & SPECTATOR URL                                       */}
        {/* ========================================================================= */}
        <div className={activeSubTab === 'qr-code' ? 'space-y-6' : 'hidden'}>
          <AdminCard className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {uiText.admin.settings.qrTitle}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {uiText.admin.settings.qrDescription}
              </p>
            </div>

            {/* Spectator URL Setting */}
            <div>
              <label htmlFor="publicUrl" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                {uiText.admin.settings.publicUrl}
              </label>
              <div className="flex gap-2.5">
                <input
                  id="publicUrl"
                  type="url"
                  value={config.publicUrl}
                  onChange={(e) => setConfig({ ...config, publicUrl: e.target.value })}
                  className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none transition-all shadow-sm"
                  placeholder={uiText.admin.settings.publicUrlPlaceholder}
                  required
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors whitespace-nowrap cursor-pointer flex items-center space-x-1.5"
                  title={uiText.admin.settings.copyUrlTitle}
                >
                  <Copy size={14} />
                  <span>{copiedUrl ? uiText.admin.settings.copied : uiText.admin.settings.copyUrl}</span>
                </button>
                <a
                  href={config.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden @sm:inline-flex items-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition-colors whitespace-nowrap space-x-1.5"
                >
                  <ExternalLink size={14} />
                  <span>{uiText.admin.settings.open}</span>
                </a>
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {uiText.admin.settings.publicUrlHelp}
              </p>
            </div>

            {/* TV QR Code Overlay Configuration */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4 shadow-sm">
              <div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {uiText.admin.settings.qrOverlayTitle}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {uiText.admin.settings.qrOverlayHelp}
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    id="tvQrCodeEnabled"
                    type="checkbox"
                    checked={config.tvPresentation.qrCodeEnabled}
                    onChange={(event) => setConfig({
                      ...config,
                      tvPresentation: { ...config.tvPresentation, qrCodeEnabled: event.target.checked },
                    })}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white border-slate-300 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {config.tvPresentation.qrCodeEnabled ? uiText.admin.settings.enabled : uiText.admin.settings.disabled}
                  </span>
                </label>
              </div>

              {config.tvPresentation.qrCodeEnabled ? (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="tvQrCodeAlwaysVisible"
                      type="checkbox"
                      checked={config.tvPresentation.qrCodeAlwaysVisible}
                      onChange={(event) => setConfig({
                        ...config,
                        tvPresentation: { ...config.tvPresentation, qrCodeAlwaysVisible: event.target.checked },
                      })}
                      className="w-4 h-4 accent-indigo-600 rounded bg-white border-slate-300 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="tvQrCodeAlwaysVisible" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                      {uiText.admin.settings.alwaysVisible}
                    </label>
                  </div>

                  {config.tvPresentation.qrCodeAlwaysVisible ? (
                    <p className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs">
                      {uiText.admin.settings.alwaysVisibleHelp}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tvQrCodeIntervalSeconds" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          {uiText.admin.settings.interval}
                        </label>
                        <input
                          id="tvQrCodeIntervalSeconds"
                          type="number"
                          min={5}
                          max={3600}
                          value={config.tvPresentation.qrCodeIntervalSeconds}
                          onChange={(event) => setConfig({
                            ...config,
                            tvPresentation: {
                              ...config.tvPresentation,
                              qrCodeIntervalSeconds: Math.max(5, Math.min(3600, parseInt(event.target.value, 10) || 30)),
                            },
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 transition-all focus:border-indigo-400 focus:outline-none shadow-sm"
                          required
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          {uiText.admin.settings.intervalHelp}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="tvQrCodeDurationSeconds" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
                          {uiText.admin.settings.duration}
                        </label>
                        <input
                          id="tvQrCodeDurationSeconds"
                          type="number"
                          min={2}
                          max={300}
                          value={config.tvPresentation.qrCodeDurationSeconds}
                          onChange={(event) => setConfig({
                            ...config,
                            tvPresentation: {
                              ...config.tvPresentation,
                              qrCodeDurationSeconds: Math.max(2, Math.min(300, parseInt(event.target.value, 10) || 10)),
                            },
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-mono text-slate-800 transition-all focus:border-indigo-400 focus:outline-none shadow-sm"
                          required
                        />
                        <p className="mt-1 text-[11px] text-slate-400">
                          {uiText.admin.settings.durationHelp}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  {uiText.admin.settings.qrDisabled}
                </p>
              )}
            </div>

            {/* TV Admin Access Splash / Onboarding Configuration */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4 shadow-sm">
              <div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Tv size={16} className="text-indigo-600" />
                    <span>{uiText.admin.settings.adminSplashSection}</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {uiText.admin.settings.adminSplashSectionDescription}
                  </p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    id="tvAdminSplashEnabled"
                    aria-label={uiText.admin.settings.adminSplashToggle}
                    type="checkbox"
                    checked={config.tvPresentation.adminSplashEnabled}
                    onChange={(event) => setConfig({
                      ...config,
                      tvPresentation: { ...config.tvPresentation, adminSplashEnabled: event.target.checked },
                    })}
                    className="w-4 h-4 accent-indigo-600 rounded bg-white border-slate-300 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-700">
                    {config.tvPresentation.adminSplashEnabled ? uiText.admin.settings.adminSplashEnabledLabel : uiText.admin.settings.adminSplashDisabledLabel}
                  </span>
                </label>
              </div>

              {config.serverInfo && (
                <div className="grid grid-cols-1 @sm:grid-cols-3 gap-3 p-4 bg-white rounded-xl border border-slate-200 text-xs shadow-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      {uiText.admin.settings.detectedIp}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {config.serverInfo.serverIp}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      {uiText.admin.settings.detectedPort}
                    </span>
                    <span className="font-mono font-bold text-slate-700">
                      {config.serverInfo.serverPort}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      {uiText.admin.settings.adminUrl}
                    </span>
                    <span className="font-mono font-bold text-indigo-600 break-all select-all">
                      {config.serverInfo.adminUrl}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                {uiText.admin.settings.adminSplashHelp}
              </p>
            </div>
          </AdminCard>
        </div>

        {/* ========================================================================= */}
        {/* 3. SUB-TAB: DATENVERWALTUNG (DATA MANAGEMENT)                            */}
        {/* ========================================================================= */}
        <div className={activeSubTab === 'data-management' ? 'block' : 'hidden'}>
          <DataManagementSection />
        </div>

        {/* Action Buttons */}
        {isDirty && activeSubTab !== 'data-management' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 border-t border-slate-200 backdrop-blur-md flex items-center justify-end space-x-4 z-40 lg:pl-72 shadow-lg">
            <span className="text-sm text-slate-500 font-medium hidden @sm:inline-block">
              {uiText.admin.settings.unsaved}
            </span>
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              {uiText.admin.settings.discard}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-200 transition-all flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/70"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{uiText.admin.settings.saving}</span>
                </>
              ) : (
                <span>{uiText.admin.settings.save}</span>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
