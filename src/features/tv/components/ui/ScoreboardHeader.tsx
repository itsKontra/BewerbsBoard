import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { uiText } from '../../../../ui-text';

export interface ScoreboardHeaderProps {
  eventTitle: string;
  headerLabel: string;
  logoUrl: string;
  theme: TvTheme;
  publicUrl?: string;
  categoryDisplayName?: string;
  statusLabel?: string;
}

export function ScoreboardHeader({
  eventTitle,
  headerLabel,
  logoUrl,
  theme,
  categoryDisplayName,
  statusLabel = uiText.tv.interimResult,
}: ScoreboardHeaderProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];

  return (
    <header
      aria-label={uiText.tv.identityRegion}
      className={`relative flex min-h-[5rem] max-h-[5.5rem] items-center justify-between border-b px-6 py-3 sm:px-8 overflow-hidden ${themeStyles.identityRail}`}
    >
      {/* Subtle Austrian Telemetry Race-Lanes Graphic */}
      <svg
        className={`pointer-events-none absolute -right-6 -top-12 h-36 w-64 rotate-12 opacity-10 stroke-current ${
          theme === 'outdoor' ? 'text-slate-950' : theme === 'ceremony' ? 'text-amber-400' : 'text-sky-400'
        }`}
        viewBox="0 0 200 270"
        fill="none"
        aria-hidden="true"
      >
        <path d="M203 -30V110C203 210 46 155 46 257V310" strokeWidth="1.5" />
        <path d="M181 -30V103C181 191 24 139 24 250V310" strokeWidth="1.5" />
        <path d="M159 -30V96C159 172 2 123 2 243V310" strokeWidth="1.5" />
        <path d="M137 -30V89C137 153 -20 107 -20 236V310" strokeWidth="1.5" />
      </svg>

      <div className="relative z-10 flex min-w-0 items-center gap-7">
        <div className="flex h-12 w-36 shrink-0 items-center justify-start">
          <img
            key={logoUrl || '/logo.png'}
            data-testid="tv-header-logo"
            alt={uiText.tv.eventLogoAlt}
            className="max-h-10 w-auto max-w-32 shrink-0 origin-left scale-150 object-contain object-left"
            src={logoUrl || '/logo.png'}
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/logo.png';
            }}
          />
        </div>
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <p className={`text-xs font-black uppercase tracking-[0.2em] ${themeStyles.headerSublabel}`}>
              {headerLabel}
            </p>
            {statusLabel && (
              <span
                className={
                  statusLabel === uiText.tv.disconnected
                    ? 'inline-flex items-center gap-1.5 rounded-sm border border-red-600 bg-red-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm'
                    : theme === 'outdoor'
                    ? 'inline-flex items-center gap-1.5 rounded-sm border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-900 shadow-sm'
                    : 'inline-flex items-center gap-1.5 rounded-sm border border-slate-800 bg-slate-950 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/10'
                }
              >
                {statusLabel !== uiText.tv.disconnected && (
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
                )}
                {statusLabel}
              </span>
            )}
          </div>
          <h1 className={`mt-0.5 truncate font-oswald text-3xl font-black uppercase tracking-wide leading-tight ${themeStyles.textColor}`}>
            {eventTitle}
          </h1>
          {categoryDisplayName && (
            <p className={`font-oswald text-lg font-bold uppercase tracking-wider ${themeStyles.categoryTitle}`}>
              {categoryDisplayName}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
