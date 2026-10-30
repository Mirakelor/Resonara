import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  DiscoverCard,
  EnvironmentMode,
  ListeningIntent,
  Track,
} from "@resonara/contracts";
import { DiscoverGrid } from "./components/DiscoverGrid";
import { Icon } from "./components/Icon";
import { MoodSelector } from "./components/MoodSelector";
import { PlayerDock } from "./components/PlayerDock";
import { TrackCard } from "./components/TrackCard";
import { SettingsButton } from "./features/settings/SettingsButton";
import { useListeningContext } from "./features/context/useListeningContext";
import { useRecommendationBatch } from "./features/recommendations/useRecommendationBatch";
import { useDailyDiscover } from "./features/discover/useDailyDiscover";
import { usePlayerController } from "./features/player/usePlayerController";
import { useFeedback } from "./features/profile/useFeedback";
import { intentMeta } from "./data/intents";
import "./styles/app.css";

const ExpandedPlayer = lazy(() =>
  import("./components/ExpandedPlayer").then((module) => ({
    default: module.ExpandedPlayer,
  })),
);
const SettingsPanel = lazy(() =>
  import("./features/settings/SettingsPanel").then((module) => ({
    default: module.SettingsPanel,
  })),
);

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

export function App() {
  const [selectedIntent, setSelectedIntent] = useState<ListeningIntent | null>(
    null,
  );
  const [environmentMode, setEnvironmentMode] =
    useState<EnvironmentMode>("use_current");
  const [feedback, setFeedback] = useState<"fit" | "miss" | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPlayerDock, setShowPlayerDock] = useState(false);
  const [notice, setNotice] = useState("");
  const {
    context,
    recommendationContext,
    loading: contextLoading,
    refresh: refreshContext,
  } = useListeningContext(environmentMode);
  const {
    batch,
    loading: recommendationLoading,
    error: recommendationError,
    generate: generateRecommendations,
    refresh: refreshRecommendations,
  } = useRecommendationBatch({
    context: recommendationContext,
    contextReady: !contextLoading,
    environmentMode,
    selectedIntent,
  });
  const {
    edition: dailyDiscover,
    loading: discoverLoading,
    error: discoverError,
  } = useDailyDiscover(context);
  const noticeTimerRef = useRef<number | null>(null);
  const pendingSeedSelectionRef = useRef<string | null>(null);

  const tracks = useMemo(
    () => batch?.items.map((item) => item.track) ?? [],
    [batch],
  );
  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const feedbackTracking = useFeedback(context);
  const handlePlaybackStarted = useCallback(
    (track: Track) => {
      void feedbackTracking.record({ event: "play_started", track });
    },
    [feedbackTracking],
  );
  const handlePlaybackCompleted = useCallback(
    (track: Track) => {
      void feedbackTracking.record({ event: "play_completed", track });
    },
    [feedbackTracking],
  );
  const player = usePlayerController({
    queue: tracks,
    onNotice: showNotice,
    onPlaybackStarted: handlePlaybackStarted,
    onPlaybackCompleted: handlePlaybackCompleted,
  });
  const currentTrack = player.currentTrack;

  useEffect(() => {
    if (!batch) return;
    const requestedSeed = pendingSeedSelectionRef.current;
    const desiredTrackId =
      (requestedSeed &&
        batch.items.some(({ track }) => track.id === requestedSeed)
        ? requestedSeed
        : null) ?? batch.featuredTrackId;
    pendingSeedSelectionRef.current = null;
    player.selectTrack(desiredTrackId);
  }, [batch, player.selectTrack]);

  const playTrack = useCallback(
    async (track: Track) => {
      setShowPlayerDock(true);
      setPlayerOpen(true);
      await player.playTrack(track);
    },
    [player],
  );

  const skipNext = useCallback(() => {
    if (player.currentTrack && player.currentTime < 30) {
      void feedbackTracking.record({
        event: "skipped_early",
        track: player.currentTrack,
        positionMs: Math.round(player.currentTime * 1_000),
      });
    }
    void player.next();
  }, [feedbackTracking, player]);

  const selectIntent = useCallback(
    (intent: ListeningIntent) => {
      setSelectedIntent(intent);
      setFeedback(null);
      scrollToId("recommendations");
      void generateRecommendations({
        intent,
        environmentMode,
        useCache: false,
      });
    },
    [environmentMode, generateRecommendations],
  );

  const changeEnvironment = useCallback(
    (mode: EnvironmentMode) => {
      setEnvironmentMode(mode);
      if (mode === "ignore_environment") {
        void generateRecommendations({
          intent: selectedIntent,
          environmentMode: mode,
          useCache: false,
        });
        return;
      }
      void refreshContext().then((nextContext) => {
        void generateRecommendations({
          context: nextContext,
          intent: selectedIntent,
          environmentMode: mode,
          useCache: false,
        });
      });
    },
    [generateRecommendations, refreshContext, selectedIntent],
  );

  const selectDiscoverCard = useCallback(
    async (card: DiscoverCard) => {
      setSelectedIntent(card.presetIntent);
      setFeedback(null);
      scrollToId("recommendations");
      pendingSeedSelectionRef.current = card.trackId;
      const next = await generateRecommendations({
        intent: card.presetIntent,
        seedTrackId: card.trackId,
        environmentMode,
        useCache: false,
      });
      const track =
        next?.items.find(({ track }) => track.id === card.trackId)?.track ??
        next?.items[0]?.track;
      if (track) await playTrack(track);
    },
    [environmentMode, generateRecommendations, playTrack],
  );

  const refresh = useCallback(() => {
    setFeedback(null);
    void feedbackTracking.record({
      event: "refresh_requested",
      track: player.currentTrack ?? undefined,
    });
    void refreshRecommendations().then((next) => {
      if (next) {
        showNotice("A new set has been shaped around your current preferences.");
      }
    });
  }, [
    feedbackTracking,
    player.currentTrack,
    refreshRecommendations,
    showNotice,
  ]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = playerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [playerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPlayerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const currentIntent = selectedIntent ? intentMeta[selectedIntent] : null;
  const featuredTrack =
    batch?.items.find(({ track }) => track.id === batch.featuredTrackId)
      ?.track ??
    tracks[0] ??
    null;

  return (
    <div
      className={`app-shell ${showPlayerDock ? "app-shell--with-player" : ""}`}
      id="top"
    >
      <main className="app-content">
        <section className="experience-card now-card" id="recommendations">
          <header className="card-heading">
            <div>
              <p className="eyebrow">Your Music Moment</p>
              <h1>
                <span>Good afternoon.</span>
                <span>What music fits this moment?</span>
              </h1>
              <div className="now-context" aria-label="Current environment">
                <span>
                  {new Intl.DateTimeFormat("en", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).format(new Date(context.localTime))}
                </span>
                {context.weather ? (
                  <>
                    <span>{Math.round(context.weather.temperatureC)}°C</span>
                    <span>
                      {Math.round(context.weather.relativeHumidity)}% humidity
                    </span>
                    <span>
                      {context.weather.condition
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                    </span>
                  </>
                ) : (
                  <span>
                    {environmentMode === "ignore_environment"
                      ? "Environment ignored"
                      : "Local time only"}
                  </span>
                )}
              </div>
            </div>
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </header>

          <figure className="now-cover">
            {featuredTrack ? (
              <img
                src={featuredTrack.coverUrl}
                alt={`${featuredTrack.title} album cover`}
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <div className="now-cover__placeholder">
                {recommendationError
                  ? "Recommendations are unavailable right now."
                  : "Finding music for this moment…"}
              </div>
            )}
          </figure>

          <div className="now-rationale">
            <h2>AI&apos;s reason for this moment</h2>
            <p>
              {batch?.items[0]?.reason.summary ??
                (recommendationError
                  ? recommendationError
                  : currentIntent
                    ? `You chose ${currentIntent.label}. ${currentIntent.description}, and the recommendation engine is shaping a verified set.`
                    : "The recommendation engine is shaping a verified set for your current context.")}
            </p>
          </div>

          <div className="now-divider" />

          <div className="recommendation-toolbar">
            <h2>Recommended for you</h2>
            <p>
              {recommendationLoading || contextLoading
                ? "Shaping recommendations"
                : `${tracks.length} selected tracks`}
            </p>
            <button
              className="text-button"
              type="button"
              onClick={refresh}
              disabled={recommendationLoading || contextLoading}
            >
              <Icon name="refresh" size={17} />
              Refresh
            </button>
          </div>

          <div
            className={`track-list ${recommendationLoading ? "track-list--pending" : ""}`}
            aria-busy={recommendationLoading}
          >
            {batch?.items.map((item) => (
                <TrackCard
                  key={item.track.id}
                  item={item}
                  onPlay={() => playTrack(item.track)}
                />
              ))}
            {!batch && recommendationLoading ? (
              <div className="track-loading" role="status">
                Checking anonymous playback and building your set…
              </div>
            ) : null}
          </div>

          {batch ? <div className="recommendation-feedback">
            <p>Do these recommendations match your mood?</p>
            <div>
              <button
                className={feedback === "fit" ? "selected" : ""}
                type="button"
                onClick={() => {
                  setFeedback("fit");
                  void feedbackTracking.record({
                    event: "batch_fit",
                    track: player.currentTrack ?? tracks[0],
                  });
                }}
                aria-label="These recommendations fit"
              >
                <Icon name="thumb-up" size={18} />
              </button>
              <button
                className={feedback === "miss" ? "selected" : ""}
                type="button"
                onClick={() => {
                  setFeedback("miss");
                  void feedbackTracking.record({
                    event: "batch_miss",
                    track: player.currentTrack ?? tracks[0],
                  });
                }}
                aria-label="These recommendations do not fit"
              >
                <Icon name="thumb-down" size={18} />
              </button>
            </div>
          </div> : null}
        </section>

        <section className="mood-section" id="mood">
          <MoodSelector
            selectedIntent={selectedIntent}
            environmentMode={environmentMode}
            pending={recommendationLoading || contextLoading}
            onSelectIntent={selectIntent}
            onEnvironmentChange={changeEnvironment}
          />
        </section>

        <section className="experience-card discover-section" id="discover">
          <div className="discover-heading">
            <h2>Discover</h2>
          </div>
          {dailyDiscover ? (
            <DiscoverGrid
              edition={dailyDiscover}
              onSelect={selectDiscoverCard}
              disabled={recommendationLoading || contextLoading}
            />
          ) : (
            <div className="discover-grid discover-grid--loading" role="status">
              {discoverError ?? (discoverLoading ? "Preparing today’s Discover edition…" : "Discover is unavailable.")}
            </div>
          )}
        </section>
      </main>

      {showPlayerDock && currentTrack ? (
        <PlayerDock
          track={currentTrack}
          isPlaying={player.isPlaying}
          progress={player.progress}
          onTogglePlayback={player.toggle}
          onNext={skipNext}
          onOpen={() => setPlayerOpen(true)}
        />
      ) : null}

      {currentTrack && playerOpen ? (
        <Suspense fallback={null}>
          <ExpandedPlayer
            currentTrack={currentTrack}
            tracks={batch?.items ?? []}
            open={playerOpen}
            isPlaying={player.isPlaying}
            progress={player.progress}
            currentTime={player.currentTime}
            duration={player.duration}
            lyrics={player.lyrics}
            lyricTranslations={player.lyricTranslations}
            activeLyricIndex={player.activeLyricIndex}
            hasLyrics={player.hasLyrics}
            lyricsOpen={player.lyricsOpen}
            muted={player.muted}
            volume={player.volume}
            onClose={() => setPlayerOpen(false)}
            onTogglePlayback={player.toggle}
            onSelect={playTrack}
            onNext={skipNext}
            onPrevious={player.previous}
            onRestart={player.restart}
            onSeek={player.seek}
            onToggleLyrics={player.toggleLyrics}
            onToggleMute={player.toggleMute}
            onVolumeChange={player.setVolume}
          />
        </Suspense>
      ) : null}

      {settingsOpen ? (
        <Suspense fallback={null}>
          <SettingsPanel open onClose={() => setSettingsOpen(false)} />
        </Suspense>
      ) : null}

      <div
        className={`notice ${notice ? "notice--visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </div>
  );
}
