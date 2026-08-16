import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { conciseDestination } from '../../../../../shared/utils/tv-destination';
import { uiText } from '../../../../ui-text';

export interface TvQrPopupCardProps {
  publicUrl: string;
  theme?: TvTheme;
  enabled?: boolean;
  alwaysVisible?: boolean;
  intervalSeconds?: number;
  durationSeconds?: number;
  initialVisible?: boolean;
}

interface QrThemeStyle {
  card: string;
  minimalCard: string;
  qrContainer: string;
  badge: string;
  badgeDotPing: string;
  badgeDot: string;
  badgeText: string;
  link: string;
  hint: string;
}

const QR_THEME_STYLES: Record<TvTheme, QrThemeStyle> = {
  broadcast: {
    card: 'border-b border-l border-slate-700/80 bg-slate-950/95 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-white',
    minimalCard: 'border-b border-l border-slate-800/40 bg-slate-950/90 shadow-md text-white',
    qrContainer: 'bg-white p-0 rounded-none rounded-bl-2xl shadow-sm border-r border-neutral-200 overflow-clip',
    badge: 'bg-sky-500/15 border-sky-500/30 text-sky-300',
    badgeDotPing: 'bg-sky-400',
    badgeDot: 'bg-sky-500',
    badgeText: uiText.tv.qr.liveResults,
    link: 'text-white hover:text-sky-300 decoration-slate-600',
    hint: 'text-slate-400',
  },
  ceremony: {
    card: 'border-b border-l border-amber-700/60 bg-stone-950/95 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-amber-50',
    minimalCard: 'border-b border-l border-amber-900/30 bg-stone-950/90 shadow-md text-amber-50',
    qrContainer: 'bg-white p-0 rounded-none rounded-bl-2xl shadow-sm border-r border-amber-200/40 overflow-clip',
    badge: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    badgeDotPing: 'bg-amber-400',
    badgeDot: 'bg-amber-500',
    badgeText: uiText.tv.qr.liveResults,
    link: 'text-amber-100 hover:text-amber-300 decoration-amber-800/70',
    hint: 'text-amber-200/70',
  },
  outdoor: {
    card: 'border-b border-l border-slate-300 bg-white/95 shadow-[0_15px_40px_rgba(0,0,0,0.2)] text-slate-900',
    minimalCard: 'border-b border-l border-slate-200/80 bg-white/90 shadow-sm text-slate-900',
    qrContainer: 'bg-white p-0 rounded-none rounded-bl-2xl shadow-sm border-r border-slate-200 overflow-clip',
    badge: 'bg-sky-100 border-sky-300 text-sky-800',
    badgeDotPing: 'bg-sky-400',
    badgeDot: 'bg-sky-600',
    badgeText: uiText.tv.qr.liveResults,
    link: 'text-slate-950 hover:text-sky-700 decoration-slate-300',
    hint: 'text-slate-600',
  },
};

export function TvQrPopupCard({
  publicUrl,
  theme = 'broadcast',
  enabled = true,
  alwaysVisible = false,
  intervalSeconds = 30,
  durationSeconds = 10,
  initialVisible = true,
}: TvQrPopupCardProps) {
  const [isVisible, setIsVisible] = useState(enabled && (alwaysVisible || initialVisible));

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    if (alwaysVisible) {
      setIsVisible(true);
      return;
    }

    const delay = isVisible ? durationSeconds * 1000 : intervalSeconds * 1000;
    const timer = setTimeout(() => {
      setIsVisible((prev) => !prev);
    }, Math.max(100, delay));

    return () => clearTimeout(timer);
  }, [enabled, alwaysVisible, isVisible, intervalSeconds, durationSeconds]);

  if (!enabled) {
    return null;
  }

  const styles = QR_THEME_STYLES[theme] || QR_THEME_STYLES.broadcast;
  const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bewerb.feuerwehr.at';
  const payload = publicUrl || fallbackOrigin;
  const destination = conciseDestination(payload);

  return (
    <aside
      aria-label={uiText.tv.qr.regionLabel}
      aria-hidden={!isVisible}
      data-testid="tv-qr-popup"
      data-visible={isVisible}
      data-always-visible={alwaysVisible}
      className={`fixed top-0 right-0 z-50 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible
        ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
        : '-translate-y-full opacity-0 scale-95 pointer-events-none'
        }`}
    >
      <div className={`rounded-none rounded-bl-2xl ${alwaysVisible ? styles.minimalCard : styles.card} py-0 pl-0 pr-4 sm:pr-5 backdrop-blur-md w-auto min-w-[320px] max-w-md sm:max-w-lg overflow-clip`}>
        <div className="flex items-center gap-4">
          {/* High-Contrast QR-Code (Left Side) */}
          <div
            className={`shrink-0 flex items-center justify-center overflow-clip ${styles.qrContainer}`}
            style={{ overflow: 'clip' }}
            data-testid="tv-qr-code"
          >
            <QRCodeSVG
              value={payload}
              size={150}
              level="M"
              bgColor="#FFFFFF"
              fgColor="#000000"
              marginSize={4}
              title={uiText.tv.qr.codeTitle}
            />
          </div>

          {/* Text Content (Right Side) */}
          <div className="flex flex-col justify-center min-w-0 text-left py-2.5 sm:py-3">
            {/* Header Badge */}
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-black uppercase tracking-wider self-start mb-1 ${styles.badge}`}>
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.badgeDotPing}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${styles.badgeDot}`} />
              </span>
              <span>{styles.badgeText}</span>
            </div>

            {/* Destination link */}
            <a
              className={`block truncate font-mono text-sm sm:text-base font-extrabold underline underline-offset-4 tracking-tight ${styles.link}`}
              href={payload}
            >
              {destination}
            </a>

            {/* Helper subtitle */}
            <p className={`mt-0.5 text-xs font-medium truncate ${styles.hint}`}>
              {uiText.tv.qr.scanHint}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
