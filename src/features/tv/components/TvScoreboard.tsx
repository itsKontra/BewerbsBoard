import { DEFAULT_TV_PRESENTATION } from '../../../../shared/domain/tv-presentation';
import { TV_PRESENTATION_STYLES } from '../utils/tv-presentation-styles';
import { ScoreboardHeader } from './ui/ScoreboardHeader';
import { TvQrPopupCard } from './ui/TvQrPopupCard';
import { RankingCanvas } from './canvases/RankingCanvas';
import { MessageCanvas } from './canvases/MessageCanvas';
import { WinnersCanvas } from './canvases/WinnersCanvas';
import { AdminAccessSplashCanvas } from './canvases/AdminAccessSplashCanvas';
import { useTvDataFeed } from '../hooks/useTvDataFeed';
import { useRankingPager } from '../hooks/useRankingPager';
import { useTvScale } from '../hooks/useTvScale';
import { uiText } from '../../../ui-text';

export function TvScoreboard() {
  const { scale, width, height } = useTvScale();
  const { tvState, resultsData, isDisconnected } = useTvDataFeed();
  const {
    activeCategory,
    activeRankedResults,
    visibleRankingRows,
    rankingPresentationRowsCount,
  } = useRankingPager(tvState, resultsData);

  if (!tvState || !resultsData) {
    return (
      <div
        className="fixed inset-0 overflow-hidden bg-black font-sans text-white select-none"
        data-testid="tv-viewport-container"
      >
        <div
          className="flex flex-col items-center justify-center"
          style={{
            width,
            height,
            minWidth: width,
            minHeight: height,
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <h1 className="mb-4 animate-pulse text-4xl font-extrabold uppercase tracking-widest text-red-600">
            {uiText.tv.results}
          </h1>
          <p className="font-mono text-neutral-500">{uiText.tv.connecting}</p>
        </div>
      </div>
    );
  }

  const { eventTitle, mode } = tvState;
  const announcementHeadline = tvState.tvAnnouncement?.headline?.trim() ?? '';
  const announcementMessage = tvState.tvAnnouncement?.message?.trim() ?? '';
  const tvPresentation = tvState.tvPresentation ?? {
    theme: DEFAULT_TV_PRESENTATION.theme,
    logoUrl: '/logo.png',
    headerLabel: DEFAULT_TV_PRESENTATION.headerLabel,
    qrCodeEnabled: DEFAULT_TV_PRESENTATION.qrCodeEnabled,
    qrCodeAlwaysVisible: DEFAULT_TV_PRESENTATION.qrCodeAlwaysVisible,
    qrCodeIntervalSeconds: DEFAULT_TV_PRESENTATION.qrCodeIntervalSeconds,
    qrCodeDurationSeconds: DEFAULT_TV_PRESENTATION.qrCodeDurationSeconds,
    adminSplashEnabled: DEFAULT_TV_PRESENTATION.adminSplashEnabled,
  };
  const themeStyles = TV_PRESENTATION_STYLES[tvPresentation.theme];
  const isAdminSplashActive = tvPresentation.adminSplashEnabled ?? false;

  const modeCanvas = isAdminSplashActive ? (
    <AdminAccessSplashCanvas
      theme={tvPresentation.theme}
      serverInfo={tvState.serverInfo}
    />
  ) : mode === 'MESSAGE' ? (
    <MessageCanvas
      announcementHeadline={announcementHeadline}
      announcementMessage={announcementMessage}
      theme={tvPresentation.theme}
    />
  ) : mode === 'WINNERS' ? (
    <WinnersCanvas
      activeCategory={activeCategory}
      activeRankedResults={activeRankedResults}
      theme={tvPresentation.theme}
    />
  ) : (
    <RankingCanvas
      activeCategory={activeCategory}
      visibleRankingRows={visibleRankingRows}
      rankingPresentationRowsCount={rankingPresentationRowsCount}
      rankingDensity="full"
      theme={tvPresentation.theme}
    />
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden bg-black select-none"
      data-testid="tv-viewport-container"
    >
      <div
        className={`relative flex shrink-0 flex-col overflow-hidden select-none bg-gradient-to-br font-sans ${
          themeStyles.textColor
        } ${themeStyles.frameGradient}`}
        style={{
          width,
          height,
          minWidth: width,
          minHeight: height,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        data-theme={tvPresentation.theme}
        data-testid="tv-shared-frame"
      >
        {!isAdminSplashActive && (
          <TvQrPopupCard
            publicUrl={resultsData.publicUrl}
            theme={tvPresentation.theme}
            enabled={tvPresentation.qrCodeEnabled ?? DEFAULT_TV_PRESENTATION.qrCodeEnabled}
            alwaysVisible={tvPresentation.qrCodeAlwaysVisible ?? DEFAULT_TV_PRESENTATION.qrCodeAlwaysVisible}
            intervalSeconds={tvPresentation.qrCodeIntervalSeconds ?? DEFAULT_TV_PRESENTATION.qrCodeIntervalSeconds}
            durationSeconds={tvPresentation.qrCodeDurationSeconds ?? DEFAULT_TV_PRESENTATION.qrCodeDurationSeconds}
          />
        )}

        <ScoreboardHeader
          eventTitle={eventTitle}
          headerLabel={tvPresentation.headerLabel || DEFAULT_TV_PRESENTATION.headerLabel}
          logoUrl={tvPresentation.logoUrl || '/logo.png'}
          theme={tvPresentation.theme}
          statusLabel={isDisconnected ? uiText.tv.disconnected : undefined}
        />

        {modeCanvas}
      </div>
    </div>
  );
}
