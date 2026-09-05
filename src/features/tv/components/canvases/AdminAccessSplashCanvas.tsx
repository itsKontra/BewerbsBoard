import { QrSvg } from '../ui/QrSvg';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { uiText } from '../../../../ui-text';
import type { ServerNetworkInfo } from '../../hooks/useTvDataFeed';

export interface AdminAccessSplashCanvasProps {
  theme: TvTheme;
  serverInfo?: ServerNetworkInfo;
}

export function AdminAccessSplashCanvas({
  theme,
  serverInfo,
}: AdminAccessSplashCanvasProps) {
  // Resolve active display URL
  let resolvedAdminUrl = serverInfo?.adminUrl;

  if (!resolvedAdminUrl && typeof window !== 'undefined') {
    const host = window.location.hostname || '127.0.0.1';
    const port = window.location.port ? Number.parseInt(window.location.port, 10) : 80;
    const portSuffix = port && port !== 80 && port !== 443 ? `:${port}` : '';
    resolvedAdminUrl = `http://${host}${portSuffix}/admin`;
  }

  const finalAdminUrl = resolvedAdminUrl || 'http://127.0.0.1:3080/admin';
  const availableIps = serverInfo?.availableIps || [];

  return (
    <main
      className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 sm:p-8"
      data-testid="tv-mode-canvas"
    >
      <div
        className={`w-full max-w-5xl rounded-3xl border p-6 sm:p-10 shadow-2xl backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 transition-all ${
          theme === 'outdoor'
            ? 'bg-white/95 border-amber-300 text-neutral-900 shadow-amber-950/20'
            : theme === 'ceremony'
            ? 'bg-neutral-900/90 border-amber-500/40 text-amber-50 shadow-amber-950/40'
            : 'bg-neutral-950/85 border-neutral-800 text-white shadow-black/80'
        }`}
        data-testid="tv-admin-splash-canvas"
      >
        {/* Left column: Text instructions & connection info */}
        <div className="flex-1 space-y-6 text-left w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-600/20 border border-red-500/50 text-red-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            <span>{uiText.tv.adminSplash.badge}</span>
          </div>

          {/* Title */}
          <div>
            <h2
              className={`font-oswald text-3xl sm:text-5xl font-black uppercase tracking-wide leading-none ${
                theme === 'outdoor'
                  ? 'text-neutral-900'
                  : theme === 'ceremony'
                  ? 'text-amber-300'
                  : 'text-white'
              }`}
            >
              {uiText.tv.adminSplash.title}
            </h2>
            <p className="mt-2 text-sm sm:text-base opacity-80 max-w-xl">
              {uiText.tv.adminSplash.qrHint}
            </p>
          </div>

          {/* Action Box: Access Admin Dashboard on URL */}
          <div
            className={`rounded-2xl border p-4 sm:p-6 shadow-inner ${
              theme === 'outdoor'
                ? 'bg-neutral-100 border-neutral-300'
                : 'bg-neutral-900/90 border-neutral-700/80'
            }`}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 mb-1.5">
              {uiText.tv.adminSplash.accessPrompt}
            </div>
            <div
              className="font-mono text-xl sm:text-3xl font-extrabold tracking-tight break-all select-all text-red-500"
              data-testid="admin-access-url"
            >
              {uiText.tv.adminSplash.accessUrl(finalAdminUrl.replace(/^https?:\/\//, ''))}
            </div>
          </div>

          {/* Detected Network Interfaces */}
          {availableIps.length > 0 && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                {uiText.tv.adminSplash.networkInterfaces}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableIps.map((item) => (
                  <span
                    key={`${item.interfaceName}-${item.ip}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono bg-black/30 border border-white/10"
                  >
                    <span className="opacity-60">{item.interfaceName}:</span>
                    <strong className="text-red-400">{item.ip}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dismiss Helper Notice */}
          <div className="text-xs opacity-60 flex items-center gap-2 pt-2 border-t border-white/10">
            <span>ℹ️</span>
            <span>{uiText.tv.adminSplash.dismissHint}</span>
          </div>
        </div>

        {/* Right column: Large Scannable QR Code */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div
            className="p-4 sm:p-6 bg-white rounded-3xl shadow-2xl border-4 border-white flex flex-col items-center justify-center transition-transform hover:scale-105"
            data-testid="admin-access-qr"
          >
            <QrSvg
              value={finalAdminUrl}
              size={220}
              level="M"
              includeMargin={false}
              aria-label={uiText.tv.adminSplash.title}
            />
            <span className="mt-3 font-mono text-[11px] font-bold text-neutral-800 tracking-wider uppercase">
              /admin
            </span>
          </div>
          <span className="mt-2 text-xs font-bold uppercase tracking-wider opacity-75">
            📱 {uiText.tv.adminSplash.badge}
          </span>
        </div>
      </div>
    </main>
  );
}
