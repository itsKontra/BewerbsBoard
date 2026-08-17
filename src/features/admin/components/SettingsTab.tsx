import React, { useState, useEffect, useMemo } from 'react';
import { DEFAULT_TV_PRESENTATION, TV_THEMES, type TvPresentationConfig } from '../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../tv/utils/tv-presentation-styles';
import { uiText } from '../../../ui-text';
import { DataManagementSection } from './settings/DataManagementSection';

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
  icon: string;
}

const SETTINGS_SUB_TABS: SettingsSubTabConfig[] = [
  { id: 'general', label: uiText.admin.settings.generalTab, icon: '🏷️' },
  { id: 'qr-code', label: uiText.admin.settings.qrTab, icon: '📱' },
  { id: 'data-management', label: uiText.admin.settings.dataTab, icon: '💾' },
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
      <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-oswald uppercase tracking-wider text-sm">{uiText.admin.settings.loading}</p>
      </div>
    );
  }

  const selectedThemeStyle = TV_PRESENTATION_STYLES[config.tvPresentation.theme] || TV_PRESENTATION_STYLES.broadcast;

  return (
    <div className="space-y-6 pb-20 @container">
      {/* Sleek Segmented Sub-Tab Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1.5 shadow-md">
        {SETTINGS_SUB_TABS.map((tab) => {
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

      {/* Alert Banners */}
      {error && (
        <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2.5 text-sm font-semibold">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-white text-xs font-mono ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-800 text-emerald-200 px-4 py-3.5 rounded-xl flex items-center justify-between shadow-lg">
          <div className="flex items-center space-x-2.5 text-sm font-semibold">
            <span className="text-lg">✅</span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-white text-xs font-mono ml-4"
          >
            ✕
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
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider px-1 flex items-center space-x-2">
              <span>👁️</span>
              <span>{uiText.admin.settings.livePreview}</span>
            </div>
            
            <div className={`rounded-xl border p-4 flex items-center justify-between shadow-lg ${selectedThemeStyle.identityRail} ${selectedThemeStyle.textColor}`}>
              <div className="flex items-center space-x-3.5 truncate">
                <img
                  alt={uiText.admin.settings.logoPreviewAlt}
                  className="max-h-9 @sm:max-h-10 w-auto max-w-28 shrink-0 object-contain object-left"
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
              <div className="hidden @sm:flex items-center space-x-2 text-xs font-mono opacity-80 bg-black/20 border border-white/10 px-3 py-1.5 rounded-lg flex-shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{uiText.admin.settings.themePrefix} {selectedThemeStyle.label}</span>
              </div>
            </div>
          </div>

          {/* General Event & Visual Theme Card */}
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
            <div>
              <label htmlFor="eventTitle" className="block text-xs font-bold text-neutral-300 uppercase tracking-wide mb-2">
                {uiText.admin.settings.eventTitle}
              </label>
              <input
                id="eventTitle"
                type="text"
                value={config.eventTitle}
                onChange={(e) => setConfig({ ...config, eventTitle: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors shadow-inner"
                placeholder={uiText.admin.settings.eventTitlePlaceholder}
                required
              />
              <p className="text-[11px] text-neutral-500 mt-1.5">
                {uiText.admin.settings.eventTitleHelp}
              </p>
            </div>

            <div className="grid grid-cols-1 @md:grid-cols-2 gap-6 pt-2 border-t border-neutral-800/80">
              <div>
                <label htmlFor="tvHeaderLabel" className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-300">
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
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white transition-colors focus:border-red-600 focus:outline-none shadow-inner"
                  placeholder={uiText.admin.settings.tvHeaderPlaceholder}
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  {uiText.admin.settings.tvHeaderHelp}
                </p>
              </div>

              <div>
                <label htmlFor="tvLogoOverride" className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-300">
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
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm text-white transition-colors focus:border-red-600 focus:outline-none shadow-inner"
                  placeholder={uiText.admin.settings.logoPlaceholder}
                />
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  {uiText.admin.settings.logoHelp} <code className="text-neutral-400 font-mono">/logo.png</code>.
                </p>
              </div>
            </div>

            {/* Visual Theme Selection */}
            <fieldset className="pt-2 border-t border-neutral-800/80">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-neutral-300">
                {uiText.admin.settings.visualTvTheme}
              </legend>
              <div className="grid grid-cols-1 gap-4 @lg:grid-cols-3">
                {TV_THEMES.map((themeId) => {
                  const theme = TV_PRESENTATION_STYLES[themeId];
                  return (
                    <label
                      key={themeId}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${
                        config.tvPresentation.theme === themeId
                          ? 'border-red-500 bg-red-950/20 ring-2 ring-red-500/40 shadow-lg shadow-red-950/40'
                          : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
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
                      <div className={`mb-3 h-24 overflow-hidden rounded-lg bg-gradient-to-br ${theme.frameGradient}`} aria-hidden="true">
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
                      <span className="block text-sm font-bold text-white">{theme.label}</span>
                      <span className="mt-0.5 block text-xs text-neutral-400">{theme.summary}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 2. SUB-TAB: QR-CODE & SPECTATOR URL                                       */}
        {/* ========================================================================= */}
        <div className={activeSubTab === 'qr-code' ? 'space-y-6' : 'hidden'}>
          <section className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="border-b border-neutral-800 pb-3">
              <h3 className="font-oswald text-lg font-bold text-white uppercase tracking-wider">
                {uiText.admin.settings.qrTitle}
              </h3>
              <p className="text-xs text-neutral-400">
                {uiText.admin.settings.qrDescription}
              </p>
            </div>

            {/* Spectator URL Setting */}
            <div>
              <label htmlFor="publicUrl" className="block text-xs font-bold text-neutral-300 uppercase tracking-wide mb-2">
                {uiText.admin.settings.publicUrl}
              </label>
              <div className="flex gap-2.5">
                <input
                  id="publicUrl"
                  type="url"
                  value={config.publicUrl}
                  onChange={(e) => setConfig({ ...config, publicUrl: e.target.value })}
                  className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-red-600 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none transition-colors shadow-inner"
                  placeholder={uiText.admin.settings.publicUrlPlaceholder}
                  required
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700 transition-colors whitespace-nowrap cursor-pointer"
                  title={uiText.admin.settings.copyUrlTitle}
                >
                  {copiedUrl ? uiText.admin.settings.copied : uiText.admin.settings.copyUrl}
                </button>
                <a
                  href={config.publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden @sm:inline-flex items-center px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold border border-neutral-700 transition-colors whitespace-nowrap"
                >
                  {uiText.admin.settings.open}
                </a>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1.5">
                {uiText.admin.settings.publicUrlHelp}
              </p>
            </div>

            {/* TV QR Code Overlay Configuration */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-5 space-y-4 shadow-inner">
              <div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                <div>
                  <h4 className="font-oswald text-sm font-bold uppercase tracking-wider text-white">
                    {uiText.admin.settings.qrOverlayTitle}
                  </h4>
                  <p className="text-[11px] text-neutral-400">
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
                    className="w-4 h-4 accent-red-600 rounded bg-neutral-950 border-neutral-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-neutral-200">
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
                      className="w-4 h-4 accent-red-600 rounded bg-neutral-950 border-neutral-700 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="tvQrCodeAlwaysVisible" className="text-xs font-bold text-neutral-200 cursor-pointer select-none">
                      {uiText.admin.settings.alwaysVisible}
                    </label>
                  </div>

                  {config.tvPresentation.qrCodeAlwaysVisible ? (
                    <p className="text-[11px] text-neutral-400 bg-neutral-900/90 border border-neutral-800 rounded-lg px-3.5 py-2.5">
                      {uiText.admin.settings.alwaysVisibleHelp}
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 @sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tvQrCodeIntervalSeconds" className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-300">
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
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-mono text-white transition-colors focus:border-red-600 focus:outline-none"
                          required
                        />
                        <p className="mt-1 text-[11px] text-neutral-500">
                          {uiText.admin.settings.intervalHelp}
                        </p>
                      </div>

                      <div>
                        <label htmlFor="tvQrCodeDurationSeconds" className="mb-2 block text-xs font-bold uppercase tracking-wide text-neutral-300">
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
                          className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-2.5 text-sm font-mono text-white transition-colors focus:border-red-600 focus:outline-none"
                          required
                        />
                        <p className="mt-1 text-[11px] text-neutral-500">
                          {uiText.admin.settings.durationHelp}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-neutral-500 italic">
                  {uiText.admin.settings.qrDisabled}
                </p>
              )}
            </div>

            {/* TV Admin Access Splash / Onboarding Configuration */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-5 space-y-4 shadow-inner">
              <div className="flex flex-col @sm:flex-row @sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                <div>
                  <h4 className="font-oswald text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <span>📺</span>
                    <span>{uiText.admin.settings.adminSplashSection}</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400">
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
                    className="w-4 h-4 accent-red-600 rounded bg-neutral-950 border-neutral-700 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-neutral-200">
                    {config.tvPresentation.adminSplashEnabled ? uiText.admin.settings.adminSplashEnabledLabel : uiText.admin.settings.adminSplashDisabledLabel}
                  </span>
                </label>
              </div>

              {config.serverInfo && (
                <div className="grid grid-cols-1 @sm:grid-cols-3 gap-3 p-3.5 bg-black/40 rounded-lg border border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">
                      {uiText.admin.settings.detectedIp}
                    </span>
                    <span className="font-mono font-bold text-neutral-200">
                      {config.serverInfo.serverIp}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">
                      {uiText.admin.settings.detectedPort}
                    </span>
                    <span className="font-mono font-bold text-neutral-200">
                      {config.serverInfo.serverPort}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-0.5">
                      {uiText.admin.settings.adminUrl}
                    </span>
                    <span className="font-mono font-bold text-red-400 break-all select-all">
                      {config.serverInfo.adminUrl}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-neutral-500">
                {uiText.admin.settings.adminSplashHelp}
              </p>
            </div>
          </section>
        </div>

        {/* ========================================================================= */}
        {/* 3. SUB-TAB: DATENVERWALTUNG (DATA MANAGEMENT)                            */}
        {/* ========================================================================= */}
        <div className={activeSubTab === 'data-management' ? 'block' : 'hidden'}>
          <DataManagementSection />
        </div>

        {/* Action Buttons */}
        {isDirty && activeSubTab !== 'data-management' && (
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/90 border-t border-neutral-800 backdrop-blur-md flex items-center justify-end space-x-4 z-40 lg:pl-72 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)]">
            <span className="text-sm text-neutral-400 font-medium hidden @sm:inline-block">
              {uiText.admin.settings.unsaved}
            </span>
            <button
              type="button"
              onClick={handleDiscardChanges}
              disabled={saving}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-lg text-sm font-semibold border border-neutral-700 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500/50"
            >
              {uiText.admin.settings.discard}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-red-900/40 border border-red-500/50 transition-all flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-red-500/70"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
