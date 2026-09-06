import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { uiText } from '../../../../ui-text';

export interface MessageCanvasProps {
  announcementHeadline?: string;
  announcementMessage?: string;
  theme: TvTheme;
}

export function MessageCanvas({
  announcementHeadline,
  announcementMessage,
  theme,
}: MessageCanvasProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];

  return (
    <main
      className="flex flex-1 flex-col items-center justify-center p-8 sm:p-14 text-center"
      data-testid="tv-mode-canvas"
    >
      {announcementHeadline || announcementMessage ? (
        <div
          className={`w-full max-w-5xl rounded-lg border-2 p-10 sm:p-16 transition-all ${
            theme === 'outdoor'
              ? 'border-amber-500/80 bg-white shadow-md'
              : theme === 'ceremony'
              ? 'border-amber-500/50 bg-stone-900/80 shadow-none'
              : 'border-amber-500/40 bg-slate-900/70 shadow-none'
          }`}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-sm border border-red-500/40 bg-red-600/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-red-500">
            <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span>Durchsage</span>
          </div>

          {announcementHeadline && (
            <h2
              className={`font-oswald text-[clamp(2.5rem,4.5vw,4.5rem)] font-black uppercase leading-[1.1] tracking-wide max-w-4xl mx-auto break-words ${themeStyles.announcement.headline}`}
            >
              {announcementHeadline}
            </h2>
          )}
          {announcementMessage && (
            <p
              className={`mt-6 max-w-3xl mx-auto text-[clamp(1.25rem,2.2vw,2rem)] font-medium leading-relaxed ${themeStyles.announcement.message}`}
            >
              {announcementMessage}
            </p>
          )}
        </div>
      ) : (
        <p className={`font-oswald text-2xl uppercase tracking-widest ${themeStyles.emptyTableMessage}`}>
          {uiText.tv.noAnnouncement}
        </p>
      )}
    </main>
  );
}
