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
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 py-6 text-center" data-testid="tv-mode-canvas">
      {announcementHeadline && (
        <h2 className={`max-w-5xl font-oswald text-[clamp(2.5rem,5vw,5rem)] font-black uppercase leading-tight tracking-wide ${themeStyles.announcement.headline}`}>
          {announcementHeadline}
        </h2>
      )}
      {announcementMessage && (
        <p className={`mt-8 max-w-5xl text-[clamp(1.5rem,2.5vw,3rem)] text-[48px] font-bold leading-snug line-clamp-3 ${themeStyles.announcement.message}`}>
          {announcementMessage}
        </p>
      )}
      {!announcementHeadline && !announcementMessage && (
        <p className={`font-oswald text-2xl uppercase tracking-widest ${themeStyles.emptyTableMessage}`}>
          {uiText.tv.noAnnouncement}
        </p>
      )}
    </main>
  );
}
