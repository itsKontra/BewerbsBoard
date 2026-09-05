import type { CategoryResultData } from '../../../public/types';
import type { TvTheme } from '../../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../../utils/tv-presentation-styles';
import { resolveCategoryShape } from '../../utils/category-shape';
import { SingleRankingRow } from '../rows/SingleRankingRow';
import { SingleRelayRow } from '../rows/SingleRelayRow';
import { OverallRankingRow } from '../rows/OverallRankingRow';
import { CombinedRelayRow } from '../rows/CombinedRelayRow';
import { RANKING_PAGE_SIZE, RANKING_DENSITY_PRESENTATION } from '../../utils/presentation-constants';
import { uiText } from '../../../../ui-text';

export type RankingPresentationRow =
  | { kind: 'ranked'; entry: CategoryResultData['rankedResults'][number] }
  | { kind: 'upcoming'; entry: CategoryResultData['openEntries'][number] };

export interface RankingCanvasProps {
  activeCategory: CategoryResultData | undefined;
  visibleRankingRows: RankingPresentationRow[];
  rankingPresentationRowsCount: number;
  rankingDensity?: keyof typeof RANKING_DENSITY_PRESENTATION;
  theme: TvTheme;
}

export function RankingCanvas({
  activeCategory,
  visibleRankingRows,
  rankingPresentationRowsCount,
  rankingDensity = 'balanced',
  theme,
}: RankingCanvasProps) {
  const shape = resolveCategoryShape(activeCategory);
  const themeStyles = TV_PRESENTATION_STYLES[theme];
  const rankingPresentation = RANKING_DENSITY_PRESENTATION[rankingDensity];

  return (
    <main className="flex min-h-0 flex-1 flex-col p-3 sm:p-5" data-testid="tv-mode-canvas">
      {!activeCategory ? (
        <div className={`flex flex-1 items-center justify-center font-oswald text-2xl tracking-widest ${themeStyles.emptyTableMessage}`}>
          {uiText.tv.noActiveCategory}
        </div>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-none flex-1 flex-col">
          <div className={`mb-2 border-b pb-1.5 ${themeStyles.sectionBorder}`}>
            <h2 className={`font-oswald text-3xl sm:text-4xl font-black uppercase tracking-wider ${themeStyles.categoryTitle}`}>
              {activeCategory.displayName}
            </h2>
          </div>

          <div className={`flex-1 overflow-hidden rounded-2xl border ${themeStyles.tableContainer}`}>
            <table
              aria-label={uiText.tv.ranking(activeCategory.displayName)}
              className={`grid h-full w-full text-left ${shape.kind === 'combined-relay'
                ? 'grid-rows-[4.5rem_minmax(0,1fr)]'
                : 'grid-rows-[3.25rem_minmax(0,1fr)]'}`}
              data-density={rankingDensity}
            >
              <thead className={`font-oswald text-base uppercase tracking-widest ${themeStyles.tableHeader} ${shape.kind === 'combined-relay'
                ? `grid grid-rows-2 ${shape.gridColumns}`
                : ''}`}>
                {shape.kind === 'combined-relay' ? (
                  <>
                    <tr className="contents">
                      <th rowSpan={2} className={`${shape.headers[0].className} row-span-2 content-center`}>
                        {shape.headers[0].label}
                      </th>
                      <th rowSpan={2} className={`${shape.headers[1].className} row-span-2 content-center`}>
                        {shape.headers[1].label}
                      </th>
                      <th colSpan={2} scope="colgroup" className="col-span-2 content-center border-b border-current/20 px-2 py-1 text-center">
                        {shape.headers[2].groupLabel}
                      </th>
                      <th colSpan={2} scope="colgroup" className="col-span-2 content-center border-b border-current/20 px-2 py-1 text-center">
                        {shape.headers[4].groupLabel}
                      </th>
                      <th rowSpan={2} className={`${shape.headers[6].className} row-span-2 content-center ${themeStyles.tableHeaderCombinedAccent}`}>
                        {shape.headers[6].label}
                      </th>
                    </tr>
                    <tr className="contents">
                      {shape.headers.slice(2, 6).map((header) => (
                        <th key={header.key} className={header.className}>
                          {header.label}
                        </th>
                      ))}
                    </tr>
                  </>
                ) : (
                  <tr className={`grid h-full items-center ${shape.gridColumns}`}>
                    {shape.headers.map((header) => (
                      <th
                        key={header.key}
                        className={`${header.className} ${header.isAccent ? themeStyles.tableHeaderCombinedAccent : ''}`}
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody className={`grid min-h-0 grid-rows-8 divide-y ${themeStyles.tableDivider}`}>
                {visibleRankingRows.map((presentationRow, index) => {
                  const startsUpcomingSection = index > 0
                    && visibleRankingRows[index - 1].kind === 'ranked';

                  if (presentationRow.kind === 'upcoming') {
                    if (shape.kind === 'combined-relay') {
                      return (
                        <CombinedRelayRow
                          key={`upcoming-${presentationRow.entry.id ?? index}`}
                          rank={null}
                          fireBrigadeName={presentationRow.entry.fireBrigadeName}
                          groupName={presentationRow.entry.groupName}
                          isUpcoming
                          startsUpcomingSection={startsUpcomingSection}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    }
                    if (shape.kind === 'single-relay') {
                      return (
                        <SingleRelayRow
                          key={`upcoming-${presentationRow.entry.id ?? index}`}
                          rank={null}
                          fireBrigadeName={presentationRow.entry.fireBrigadeName}
                          groupName={presentationRow.entry.groupName}
                          isUpcoming
                          startsUpcomingSection={startsUpcomingSection}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    }
                    if (shape.kind === 'combined') {
                      return (
                        <OverallRankingRow
                          key={`upcoming-${presentationRow.entry.id ?? index}`}
                          rank={null}
                          fireBrigadeName={presentationRow.entry.fireBrigadeName}
                          groupName={presentationRow.entry.groupName}
                          isBrigadePairing={activeCategory.isBrigadePairing}
                          isUpcoming
                          startsUpcomingSection={startsUpcomingSection}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    }
                    return (
                      <SingleRankingRow
                        key={`upcoming-${presentationRow.entry.id ?? index}`}
                        rank={null}
                        fireBrigadeName={presentationRow.entry.fireBrigadeName}
                        groupName={presentationRow.entry.groupName}
                        isUpcoming
                        startsUpcomingSection={startsUpcomingSection}
                        theme={theme}
                        gridColumns={shape.gridColumns}
                        identityClass={rankingPresentation.identity}
                        rankClass={rankingPresentation.rank}
                      />
                    );
                  }

                  const row = presentationRow.entry;

                  switch (shape.kind) {
                    case 'combined-relay':
                      return (
                        <CombinedRelayRow
                          key={`ranked-${row.groupId ?? row.rank ?? index}`}
                          rank={row.rank ?? null}
                          fireBrigadeName={row.fireBrigadeName}
                          groupName={row.groupName ?? ''}
                          attackTimeHundredths1={row.primaryRun?.attackTimeHundredths ?? null}
                          attackTimeErrors1={row.primaryRun?.attackTimeErrors ?? null}
                          relayRaceHundredths1={row.primaryRun?.relayRaceHundredths ?? null}
                          relayRaceErrors1={row.primaryRun?.relayRaceErrors ?? null}
                          attackTimeHundredths2={row.secondaryRun?.attackTimeHundredths ?? null}
                          attackTimeErrors2={row.secondaryRun?.attackTimeErrors ?? null}
                          relayRaceHundredths2={row.secondaryRun?.relayRaceHundredths ?? null}
                          relayRaceErrors2={row.secondaryRun?.relayRaceErrors ?? null}
                          runStatus1={row.primaryRun?.runStatus}
                          runStatus2={row.secondaryRun?.runStatus}
                          totalScoreHundredths={row.scoreHundredths}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    case 'single-relay':
                      return (
                        <SingleRelayRow
                          key={`ranked-${row.groupId ?? row.rank ?? index}`}
                          rank={row.rank ?? null}
                          fireBrigadeName={row.fireBrigadeName}
                          groupName={row.groupName ?? ''}
                          attackTimeHundredths={row.primaryRun?.attackTimeHundredths ?? null}
                          attackTimeErrors={row.primaryRun?.attackTimeErrors ?? null}
                          relayRaceHundredths={row.primaryRun?.relayRaceHundredths ?? null}
                          relayRaceErrors={row.primaryRun?.relayRaceErrors ?? null}
                          totalScoreHundredths={row.scoreHundredths}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    case 'combined':
                      return (
                        <OverallRankingRow
                          key={`ranked-${row.groupId ?? row.rank ?? index}`}
                          rank={row.rank ?? null}
                          fireBrigadeName={row.fireBrigadeName}
                          groupName={row.groupName ?? ''}
                          secondaryGroupName={row.secondaryGroupName}
                          isBrigadePairing={activeCategory.isBrigadePairing}
                          score1Hundredths={row.primaryRun?.scoreHundredths ?? null}
                          score2Hundredths={row.secondaryRun?.scoreHundredths ?? null}
                          attackTimeHundredths1={row.primaryRun?.attackTimeHundredths ?? null}
                          attackTimeHundredths2={row.secondaryRun?.attackTimeHundredths ?? null}
                          runStatus1={row.primaryRun?.runStatus}
                          runStatus2={row.secondaryRun?.runStatus}
                          totalScoreHundredths={row.scoreHundredths}
                          showTotal={shape.isCombinedCategory}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                          scoreClass={rankingPresentation.score}
                        />
                      );
                    case 'standard':
                    default:
                      return (
                        <SingleRankingRow
                          key={`ranked-${row.groupId ?? row.rank ?? index}`}
                          rank={row.rank ?? null}
                          fireBrigadeName={row.fireBrigadeName}
                          groupName={row.groupName ?? ''}
                          scoreHundredths={row.scoreHundredths}
                          attackTimeHundredths={row.primaryRun?.attackTimeHundredths ?? null}
                          theme={theme}
                          gridColumns={shape.gridColumns}
                          identityClass={rankingPresentation.identity}
                          rankClass={rankingPresentation.rank}
                        />
                      );
                  }
                })}
                {visibleRankingRows.length > 0 && Array.from(
                  { length: RANKING_PAGE_SIZE - visibleRankingRows.length },
                  (_, index) => (
                    <tr
                      key={`empty-${index}`}
                      aria-hidden="true"
                      className={`grid min-h-0 border-l-4 border-l-transparent ${themeStyles.rowBase} ${shape.gridColumns}`}
                      data-row-kind="empty"
                    >
                      <td
                        className="col-span-full"
                        colSpan={shape.colSpan}
                      />
                    </tr>
                  ),
                )}
                {rankingPresentationRowsCount === 0 && (
                  <tr className="row-span-8 grid place-items-center">
                    <td colSpan={shape.colSpan} className={`col-span-full px-6 py-12 text-center font-oswald text-xl uppercase tracking-widest ${themeStyles.emptyTableMessage}`}>
                      {uiText.tv.noResults}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
