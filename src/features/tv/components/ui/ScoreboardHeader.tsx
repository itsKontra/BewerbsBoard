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
  const isDisconnected = statusLabel === uiText.tv.disconnected;

  const statusBadgeStyle = isDisconnected
    ? 'border border-red-500 bg-red-600 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm'
    : theme === 'outdoor'
      ? 'border border-slate-900 bg-slate-950 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-400 shadow-sm'
      : theme === 'ceremony'
        ? 'border border-amber-600/60 bg-stone-900/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-300 shadow-sm'
        : 'border border-slate-700 bg-slate-800/90 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-sky-300 shadow-sm';

  return (
    <header
      aria-label={uiText.tv.identityRegion}
      className={`flex h-[96px] min-h-[96px] max-h-[96px] shrink-0 items-center justify-between border-b px-6 ${themeStyles.identityRail}`}
    >
      <div className="flex min-w-0 items-center gap-6">
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
        <div className="min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-3">
            <p className={`text-xs font-bold uppercase tracking-[0.25em] leading-tight ${themeStyles.headerSublabel}`}>
              {headerLabel}
            </p>
            {statusLabel && (
              <span className={`rounded-sm ${statusBadgeStyle}`}>
                {statusLabel}
              </span>
            )}
          </div>
          <h1 className={`mt-0.5 truncate font-oswald text-2xl sm:text-3xl font-black uppercase tracking-wide leading-tight ${themeStyles.textColor}`}>
            {eventTitle}
          </h1>
          {categoryDisplayName && (
            <p className={`truncate font-oswald text-base sm:text-lg font-bold uppercase tracking-wider leading-tight ${themeStyles.categoryTitle}`}>
              {categoryDisplayName}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
