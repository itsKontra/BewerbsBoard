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
                    ? 'rounded border border-red-500/40 bg-red-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300'
                    : 'rounded border border-sky-400/30 bg-sky-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-300'
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
