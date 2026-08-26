import React, { useState, useEffect, useRef } from 'react';
import {
  BUNDLED_LOGO_PRESETS,
  getLogoPresetId,
  isAllowedLogoMimeType,
} from '../../../../../shared/domain/tv-presentation';
import { uiText } from '../../../../ui-text';
import {
  Upload,
  Download,
  Trash2,
  ImagePlus,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Globe,
  HardDrive,
} from 'lucide-react';

export interface LogoSectionProps {
  logoOverride: string;
  onChangeLogoOverride: (newLogoOverride: string) => void;
  onSyncSavedLogoOverride?: (savedLogoOverride: string) => void;
}

export function LogoSection({
  logoOverride,
  onChangeLogoOverride,
  onSyncSavedLogoOverride,
}: LogoSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasStoredCustomLogo, setHasStoredCustomLogo] = useState(false);
  const [customLogoPreviewUrl, setCustomLogoPreviewUrl] = useState<string | null>(null);
  const [customSourceTab, setCustomSourceTab] = useState<'upload' | 'url'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if a custom logo is stored on the server
  useEffect(() => {
    let isMounted = true;

    if (logoOverride.startsWith('/api/public/logo')) {
      setHasStoredCustomLogo(true);
      setCustomLogoPreviewUrl(logoOverride);
      return;
    }

    fetch('/api/public/logo')
      .then((res) => {
        if (res.ok && isMounted) {
          setHasStoredCustomLogo(true);
          setCustomLogoPreviewUrl('/api/public/logo');
        } else if (isMounted) {
          setHasStoredCustomLogo(false);
        }
      })
      .catch(() => {
        if (isMounted) setHasStoredCustomLogo(false);
      });

    return () => {
      isMounted = false;
    };
  }, [logoOverride]);

  const selectedPresetId = getLogoPresetId(logoOverride);

  const handleSelectPreset = (presetId: string) => {
    setError(null);
    if (presetId === 'custom') {
      if (customLogoPreviewUrl) {
        onChangeLogoOverride(customLogoPreviewUrl);
      }
      return;
    }

    const preset = BUNDLED_LOGO_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      onChangeLogoOverride(preset.id === 'default' ? '' : preset.path);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccess(null);

    // Validate size <= 2MB
    if (file.size > 2 * 1024 * 1024) {
      setError(uiText.admin.settings.logo.fileTooBig);
      return;
    }

    // Validate MIME type or file extension
    const isMimeAllowed = isAllowedLogoMimeType(file.type);
    const hasAllowedExtension = /\.(png|jpe?g|webp|svg)$/i.test(file.name);
    if (!isMimeAllowed && !hasAllowedExtension) {
      setError(uiText.admin.settings.logo.invalidFileType);
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/logo/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || uiText.admin.settings.logo.uploadError(res.status.toString()));
      }

      const newLogoUrl = data.logoUrl || `/api/public/logo?v=${Date.now()}`;
      setHasStoredCustomLogo(true);
      setCustomLogoPreviewUrl(newLogoUrl);
      onChangeLogoOverride(newLogoUrl);
      onSyncSavedLogoOverride?.(newLogoUrl);
      setSuccess(uiText.admin.settings.logo.uploadSuccess);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || uiText.admin.settings.logo.uploadError('Unbekannter Fehler'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileUpload(file);
      e.target.value = '';
    }
  };

  const handleFetchUrl = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmed = remoteUrl.trim();
    if (!trimmed) {
      setError(uiText.admin.settings.logo.emptyUrlError);
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      setError(uiText.admin.settings.logo.emptyUrlError);
      return;
    }

    setIsFetchingUrl(true);
    try {
      const res = await fetch('/api/admin/logo/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || uiText.admin.settings.logo.fetchError(res.status.toString()));
      }

      const newLogoUrl = data.logoUrl || `/api/public/logo?v=${Date.now()}`;
      setHasStoredCustomLogo(true);
      setCustomLogoPreviewUrl(newLogoUrl);
      onChangeLogoOverride(newLogoUrl);
      onSyncSavedLogoOverride?.(newLogoUrl);
      setRemoteUrl('');
      setSuccess(uiText.admin.settings.logo.fetchSuccess);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || uiText.admin.settings.logo.fetchError('Unbekannter Fehler'));
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleDeleteCustomLogo = async () => {
    setError(null);
    setSuccess(null);
    setIsDeleting(true);

    try {
      const res = await fetch('/api/admin/logo', {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || uiText.admin.settings.logo.deleteError(res.status.toString()));
      }

      setHasStoredCustomLogo(false);
      setCustomLogoPreviewUrl(null);
      if (logoOverride.startsWith('/api/public/logo')) {
        onChangeLogoOverride('');
        onSyncSavedLogoOverride?.('');
      }
      setSuccess(uiText.admin.settings.logo.deleteSuccess);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || uiText.admin.settings.logo.deleteError('Unbekannter Fehler'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <fieldset className="space-y-6 pt-4 border-t border-slate-100">
      {/* Section Header */}
      <div>
        <legend className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1">
          {uiText.admin.settings.logo.title}
        </legend>
        <p className="text-[11px] text-slate-400">
          {uiText.admin.settings.logo.description}
        </p>
      </div>

      {/* Inline Feedback Alerts */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle size={16} className="text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700 p-1"
            aria-label={uiText.common.logout || 'Close'}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3.5 rounded-xl flex items-center justify-between text-xs font-medium shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-emerald-400 hover:text-emerald-700 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* 1. Preset & Custom Logo Selection Cards */}
      <div className="grid grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-5 gap-3.5">
        {/* Preset Cards */}
        {BUNDLED_LOGO_PRESETS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <label
              key={preset.id}
              className={`relative flex flex-col items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50'
              }`}
            >
              <input
                type="radio"
                name="tv-logo-preset"
                value={preset.id}
                checked={isSelected}
                onChange={() => handleSelectPreset(preset.id)}
                className="sr-only"
                aria-label={preset.label}
              />
              {/* Badge if selected */}
              {isSelected && (
                <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white shadow-xs">
                  <CheckCircle2 size={12} />
                </span>
              )}

              {/* Thumbnail Container with high-contrast background */}
              <div className="w-full h-20 mb-2.5 rounded-xl bg-white border border-slate-200/80 p-2 flex items-center justify-center shadow-2xs overflow-hidden">
                <img
                  src={preset.path}
                  alt={preset.label}
                  className="max-h-16 max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/logo.png';
                  }}
                />
              </div>

              {/* Text Info */}
              <div className="text-center w-full">
                <span className="block text-xs font-bold text-slate-800 truncate">
                  {preset.label}
                </span>
                <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                  {preset.subtitle}
                </span>
              </div>
            </label>
          );
        })}

        {/* 5. Custom Upload Card */}
        {(() => {
          const isSelected = selectedPresetId === 'custom';
          const hasImage = hasStoredCustomLogo || customLogoPreviewUrl || logoOverride.startsWith('/api/public/logo');
          const customSrc = customLogoPreviewUrl || (logoOverride.startsWith('/api/public/logo') ? logoOverride : (logoOverride.startsWith('http') || logoOverride.startsWith('/') ? logoOverride : '/logo.png'));

          return (
            <label
              className={`relative flex flex-col items-center justify-between p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/50 shadow-md shadow-indigo-100 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50'
              }`}
            >
              <input
                type="radio"
                name="tv-logo-preset"
                value="custom"
                checked={isSelected}
                onChange={() => handleSelectPreset('custom')}
                className="sr-only"
                aria-label={uiText.admin.settings.logo.presetCustom}
              />
              {isSelected && (
                <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white shadow-xs">
                  <CheckCircle2 size={12} />
                </span>
              )}

              {/* Thumbnail Container */}
              <div className="w-full h-20 mb-2.5 rounded-xl bg-white border border-slate-200/80 p-2 flex items-center justify-center shadow-2xs overflow-hidden">
                {hasImage ? (
                  <img
                    src={customSrc}
                    alt={uiText.admin.settings.logo.presetCustom}
                    className="max-h-16 max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/logo.png';
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <ImagePlus size={24} className="text-indigo-400 mb-1" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-500">Upload</span>
                  </div>
                )}
              </div>

              {/* Text Info */}
              <div className="text-center w-full">
                <span className="block text-xs font-bold text-slate-800 truncate">
                  {uiText.admin.settings.logo.presetCustom}
                </span>
                <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                  {hasStoredCustomLogo ? uiText.admin.settings.logo.storedLogoBadge : uiText.admin.settings.logo.presetCustomDesc}
                </span>
              </div>
            </label>
          );
        })()}
      </div>

      {/* 2. Custom Logo Manager (Upload / Remote URL / Stored Actions) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-2">
              <Upload size={14} className="text-indigo-600" />
              <span>{uiText.admin.settings.logo.uploadTitle}</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {uiText.admin.settings.logo.uploadSubtitle}
            </p>
          </div>

          {/* Subtabs: Datei-Upload vs. URL-Download */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCustomSourceTab('upload')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                customSourceTab === 'upload'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload size={13} />
              <span>{uiText.admin.settings.logo.customTabUpload}</span>
            </button>
            <button
              type="button"
              onClick={() => setCustomSourceTab('url')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                customSourceTab === 'url'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe size={13} />
              <span>{uiText.admin.settings.logo.customTabUrl}</span>
            </button>
          </div>
        </div>

        {/* Tab Content A: File Upload Dropzone */}
        {customSourceTab === 'upload' && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/70 scale-[1.005] shadow-inner'
                : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileInputChange}
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="sr-only"
              aria-label={uiText.admin.settings.logo.uploadTitle}
              disabled={isUploading}
            />

            {isUploading ? (
              <div className="py-4 flex flex-col items-center justify-center space-y-2 text-indigo-600">
                <Loader2 size={32} className="animate-spin" />
                <span className="text-xs font-bold">{uiText.admin.settings.logo.uploading}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {uiText.admin.settings.logo.dropzoneText}{' '}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-indigo-600 font-bold hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-500/50 rounded-sm"
                    >
                      {uiText.admin.settings.logo.browseButton}
                    </button>
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    PNG, JPEG, WebP, SVG (max. 2 MB)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content B: Remote URL Fetcher */}
        {customSourceTab === 'url' && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-2xs">
            <label htmlFor="remoteLogoUrlInput" className="block text-xs font-bold text-slate-700">
              {uiText.admin.settings.logo.fetchUrlTitle}
            </label>
            <p className="text-[11px] text-slate-400">
              {uiText.admin.settings.logo.fetchUrlSubtitle}
            </p>
            <div className="flex flex-col @sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Globe size={15} />
                </div>
                <input
                  id="remoteLogoUrlInput"
                  type="url"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchUrl();
                    }
                  }}
                  placeholder={uiText.admin.settings.logo.urlPlaceholder}
                  disabled={isFetchingUrl}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 rounded-xl text-slate-800 focus:outline-none transition-all"
                />
              </div>
              <button
                type="button"
                onClick={handleFetchUrl}
                disabled={isFetchingUrl || !remoteUrl.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                {isFetchingUrl ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{uiText.admin.settings.logo.fetching}</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>{uiText.admin.settings.logo.fetchButton}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Stored Custom Logo Info & Delete Button */}
        {hasStoredCustomLogo && (
          <div className="flex flex-col @sm:flex-row items-start @sm:items-center justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 p-1 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={customLogoPreviewUrl || '/api/public/logo'}
                  alt="Custom Logo Thumbnail"
                  className="max-h-8 max-w-full object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/logo.png';
                  }}
                />
              </div>
              <div>
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <HardDrive size={13} className="text-emerald-600" />
                  <span>{uiText.admin.settings.logo.storedLogoTitle}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {uiText.admin.settings.logo.storedLogoBadge}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDeleteCustomLogo}
              disabled={isDeleting}
              className="w-full @sm:w-auto px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-semibold border border-red-200 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={13} className="animate-spin text-red-600" />
                  <span>{uiText.admin.settings.logo.deleting}</span>
                </>
              ) : (
                <>
                  <Trash2 size={13} />
                  <span>{uiText.admin.settings.logo.deleteCustomLogo}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 3. Manual Path / URL Fallback Field */}
      <div>
        <label htmlFor="tvLogoOverride" className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-700">
          {uiText.admin.settings.logoOverride}
        </label>
        <input
          id="tvLogoOverride"
          inputMode="url"
          type="text"
          value={logoOverride}
          onChange={(event) => onChangeLogoOverride(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition-all focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 focus:outline-none shadow-sm"
          placeholder={uiText.admin.settings.logoPlaceholder}
        />
        <p className="mt-1.5 text-[11px] text-slate-400">
          {uiText.admin.settings.logoHelp} <code className="text-slate-600 font-mono">/logo.png</code>.
        </p>
      </div>
    </fieldset>
  );
}
