import type { CategoryResultData } from '../../../public/components/PublicScoreboard';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { formatHundredthsToDisplayTime } from '../../../../../shared/utils/time-parser';
import { uiText } from '../../../../ui-text';

type PodiumPlace = 1 | 2 | 3;

function resultGroupLabel(result: CategoryResultData['rankedResults'][number]) {
  return typeof result.groupName === 'string' ? result.groupName.trim() : '';
}

function podiumBrigadeName(result: CategoryResultData['rankedResults'][number]) {
  return typeof result.fireBrigadeName === 'string' && result.fireBrigadeName.trim()
    ? result.fireBrigadeName.trim()
    : uiText.tv.unknownFireBrigade;
}

function podiumPlace(
  result: CategoryResultData['rankedResults'][number],
  fallback: PodiumPlace,
): PodiumPlace {
  return result.rank === 1 || result.rank === 2 || result.rank === 3 ? result.rank : fallback;
}

export interface WinnersCanvasProps {
  activeCategory: CategoryResultData | undefined;
  activeRankedResults: CategoryResultData['rankedResults'];
  theme: TvTheme;
}

export function WinnersCanvas({
  activeCategory,
  activeRankedResults,
  theme,
}: WinnersCanvasProps) {
  const themeStyles = TV_PRESENTATION_STYLES[theme];

  if (!activeCategory) {
    return (
      <main className={`flex flex-1 items-center justify-center font-oswald text-2xl uppercase tracking-widest ${themeStyles.emptyTableMessage}`} data-testid="tv-mode-canvas">
        {uiText.tv.noActiveCategory}
      </main>
    );
  }

  const winners = Array.isArray(activeRankedResults) ? activeRankedResults.slice(0, 3) : [];
  const podium = [
    { result: winners[1], fallbackPlace: 2 as const, slot: 'left' },
    { result: winners[0], fallbackPlace: 1 as const, slot: 'center' },
    { result: winners[2], fallbackPlace: 3 as const, slot: 'right' },
  ];

  return (
    <main className="flex min-h-0 flex-1 flex-col px-8 pb-6 text-center" data-testid="tv-mode-canvas">
      <div className="mb-4">
        <p className={`text-base font-bold uppercase tracking-[0.24em] ${themeStyles.winnersTitle}`}>{uiText.tv.winnersTitle}</p>
        <h2 className={`mt-1 font-oswald text-[clamp(1.75rem,3.5vw,3.25rem)] font-black uppercase tracking-wide ${themeStyles.categoryTitle}`}>{activeCategory.displayName}</h2>
      </div>
      {winners.length === 0 ? (
        <div className={`flex flex-1 items-center justify-center font-oswald text-2xl uppercase tracking-widest ${themeStyles.emptyTableMessage}`}>
          {uiText.tv.noResults}
        </div>
      ) : (
        <div className="flex flex-1 items-end justify-center gap-6">
          {podium.map(({ result, fallbackPlace, slot }) => {
            if (!result) return null;
            const groupLabel = resultGroupLabel(result);
            const place = podiumPlace(result, fallbackPlace);
            const podiumStyle = themeStyles.podium(place);

            return (
              <section className="flex w-1/3 flex-col items-center" key={slot}>
                <h3 className={`max-w-full truncate text-[clamp(1.25rem,2.2vw,2.25rem)] font-black ${podiumStyle.name}`}>{podiumBrigadeName(result)}</h3>
                {groupLabel && <p className={`mt-1 text-lg ${podiumStyle.group}`}>{groupLabel}</p>}
                <p className={`mt-2 font-mono text-[clamp(1.1rem,1.8vw,1.75rem)] font-black tabular-nums ${podiumStyle.time}`}>
                  {formatHundredthsToDisplayTime(result.scoreHundredths)}
                </p>
                <div className={`mt-3 flex w-full items-start justify-center border-t-8 pt-3 font-oswald text-[clamp(2.5rem,5vw,5rem)] font-black ${podiumStyle.height} ${podiumStyle.tone}`}>
                  {place}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
