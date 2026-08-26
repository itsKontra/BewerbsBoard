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
      className={`flex items-center justify-between border-b px-6 py-2.5 sm:px-8 ${themeStyles.identityRail}`}
    >
      <div className="flex min-w-0 items-center gap-8">
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
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className={`text-xs font-bold uppercase tracking-[0.25em] ${themeStyles.headerSublabel}`}>
              {headerLabel}
            </p>
            {statusLabel && (
              <span
                className={
                  statusLabel === uiText.tv.disconnected
                    ? 'rounded border border-red-600 bg-red-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm'
                    : 'rounded border border-slate-900 bg-slate-950 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm ring-1 ring-white/10'
                }
              >
                {statusLabel}
              </span>
            )}
          </div>
          <h1 className={`mt-0.5 truncate font-oswald text-2xl sm:text-3xl font-black uppercase tracking-wide ${themeStyles.textColor}`}>
            {eventTitle}
          </h1>
          {categoryDisplayName && (
            <p className={`font-oswald text-lg sm:text-xl font-bold uppercase tracking-wider ${themeStyles.categoryTitle}`}>
              {categoryDisplayName}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
