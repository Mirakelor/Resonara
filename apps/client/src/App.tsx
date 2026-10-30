import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  DiscoverCard,
  EnvironmentMode,
  ListeningIntent,
  Track,
} from "@resonara/contracts";
import { DiscoverGrid } from "./components/DiscoverGrid";
import { ExpandedPlayer } from "./components/ExpandedPlayer";
import { Icon } from "./components/Icon";
import { MoodSelector } from "./components/MoodSelector";
import { PlayerDock } from "./components/PlayerDock";
import { TrackCard } from "./components/TrackCard";
import { SettingsButton } from "./features/settings/SettingsButton";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { getSettings } from "./db/repositories/settings";
import { resolveFreshPlaybackUrl } from "./recommendation/verifyPlayable";
import { createNeteaseProvider } from "./services/netease/client";
import {
  discoverEdition,
  intentMeta,
  recommendationItems,
} from "./data/mockData";
import "./styles/app.css";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

function nextFeaturedTrackIndex(current: number) {
  if (recommendationItems.length < 2) return current;
  const next = Math.floor(Math.random() * recommendationItems.length);
  return next === current ? (next + 1) % recommendationItems.length : next;
}

export function App() {
  const [selectedIntent, setSelectedIntent] = useState<ListeningIntent | null>(
    null,
  );
  const [environmentMode, setEnvironmentMode] =
    useState<EnvironmentMode>("use_current");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<"fit" | "miss" | null>(null);
  const [featuredTrackIndex, setFeaturedTrackIndex] = useState(() =>
    Math.floor(Math.random() * recommendationItems.length),
  );
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showPlayerDock, setShowPlayerDock] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingTimerRef = useRef<number | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const tracks = useMemo(
    () => recommendationItems.map((item) => item.track),
    [],
  );
  const playableTrackIds = useMemo(
    () =>
      new Set(
        tracks.filter((track) => track.playable).map((track) => track.id),
      ),
    [tracks],
  );
  const currentTrack = tracks[currentTrackIndex] ?? tracks[0]!;

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 3200);
  }, []);

  const playTrack = useCallback(
    async (track: Track) => {
      const index = tracks.findIndex((candidate) => candidate.id === track.id);
      if (index >= 0) setCurrentTrackIndex(index);
      setShowPlayerDock(true);
      setPlayerOpen(true);

      if (!track.playable) {
        setIsPlaying(false);
        showNotice("This track is not available for playback right now.");
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      try {
        const settings = await getSettings();
        const playback = await resolveFreshPlaybackUrl(
          track.id,
          createNeteaseProvider(settings),
        );
        if (!playback) {
          setIsPlaying(false);
          showNotice(
            "This track has no anonymous playback URL right now.",
          );
          return;
        }

        audio.src = playback.url;
        audio.load();
        try {
          await audio.play();
          setIsPlaying(true);
        } catch {
          setIsPlaying(false);
          showNotice("Playback was blocked. Press play again to continue.");
        }
      } catch (error) {
        setIsPlaying(false);
        showNotice(
          error instanceof Error
            ? error.message
            : "The playback URL could not be verified.",
        );
      }
    },
    [showNotice, tracks],
  );

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack.playable) {
      showNotice("This track is not available for playback right now.");
      return;
    }

    if (!audio.src) {
      await playTrack(currentTrack);
      return;
    }
    if (audio.paused) {
      void audio.play().then(
        () => setIsPlaying(true),
        () => showNotice("Playback could not start. Please try again."),
      );
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, playTrack, showNotice]);

  const goNext = useCallback(() => {
    const nextIndex = (currentTrackIndex + 1) % tracks.length;
    playTrack(tracks[nextIndex]!);
  }, [currentTrackIndex, playTrack, tracks]);

  const goPrevious = useCallback(() => {
    const nextIndex =
      (currentTrackIndex - 1 + tracks.length) % tracks.length;
    playTrack(tracks[nextIndex]!);
  }, [currentTrackIndex, playTrack, tracks]);

  const restartTrack = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    setProgress(0);
    if (!currentTrack.playable) {
      showNotice("This track is not available for playback right now.");
    }
  }, [currentTrack.playable, showNotice]);

  const selectIntent = useCallback(
    (intent: ListeningIntent) => {
      setSelectedIntent(intent);
      setFeedback(null);
      setPending(true);
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = window.setTimeout(() => {
        setPending(false);
        setFeaturedTrackIndex(nextFeaturedTrackIndex);
        scrollToId("recommendations");
      }, 650);
    },
    [],
  );

  const changeEnvironment = useCallback(
    (mode: EnvironmentMode) => {
      setEnvironmentMode(mode);
      if (selectedIntent) {
        setPending(true);
        if (pendingTimerRef.current)
          window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = window.setTimeout(
          () => setPending(false),
          520,
        );
      }
    },
    [selectedIntent],
  );

  const selectDiscoverCard = useCallback(
    (card: DiscoverCard) => {
      const track = tracks.find((candidate) => candidate.id === card.trackId);
      if (!track) return;
      selectIntent(card.presetIntent);
      playTrack(track);
    },
    [playTrack, selectIntent, tracks],
  );

  const refresh = useCallback(() => {
    setFeedback(null);
    setPending(true);
    if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = window.setTimeout(() => {
      setPending(false);
      setFeaturedTrackIndex(nextFeaturedTrackIndex);
      showNotice("A new set has been shaped around your current preferences.");
    }, 650);
  }, [showNotice]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) window.clearTimeout(pendingTimerRef.current);
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
    recommendationItems[featuredTrackIndex]?.track ??
    recommendationItems[0]!.track;

  return (
    <div
      className={`app-shell ${showPlayerDock ? "app-shell--with-player" : ""}`}
      id="top"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(
            audio.duration > 0 ? audio.currentTime / audio.duration : 0,
          );
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          goNext();
        }}
      />

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
                <span>14:30</span>
                <span>28°C</span>
                <span>75% humidity</span>
                <span>Cloudy</span>
              </div>
            </div>
            <SettingsButton onClick={() => setSettingsOpen(true)} />
          </header>

          <figure className="now-cover">
            <img
              src={featuredTrack.coverUrl}
              alt={`${featuredTrack.title} album cover`}
            />
          </figure>

          <div className="now-rationale">
            <h2>AI&apos;s reason for this moment</h2>
            <p>
              {currentIntent
                ? `You chose ${currentIntent.label}. ${currentIntent.description}, while staying close to your long-term taste for textured, melodic music.`
                : "Afternoons often find you choosing rhythmic, detail-rich music. It feels warm and humid today, so the selection keeps your melodic edge while lowering the overall intensity."}
            </p>
          </div>

          <div className="now-divider" />

          <div className="recommendation-toolbar">
            <h2>Recommended for you</h2>
            <p>{recommendationItems.length} selected tracks</p>
            <button className="text-button" type="button" onClick={refresh}>
              <Icon name="refresh" size={17} />
              Refresh
            </button>
          </div>

          <div
            className={`track-list ${pending ? "track-list--pending" : ""}`}
            aria-busy={pending}
          >
            {recommendationItems.map((item) => (
              <TrackCard
                key={item.track.id}
                item={item}
                onPlay={() => playTrack(item.track)}
              />
            ))}
          </div>

          <div className="recommendation-feedback">
            <p>Do these recommendations match your mood?</p>
            <div>
              <button
                className={feedback === "fit" ? "selected" : ""}
                type="button"
                onClick={() => setFeedback("fit")}
                aria-label="These recommendations fit"
              >
                <Icon name="thumb-up" size={18} />
              </button>
              <button
                className={feedback === "miss" ? "selected" : ""}
                type="button"
                onClick={() => setFeedback("miss")}
                aria-label="These recommendations do not fit"
              >
                <Icon name="thumb-down" size={18} />
              </button>
            </div>
          </div>
        </section>

        <section className="mood-section" id="mood">
          <MoodSelector
            selectedIntent={selectedIntent}
            environmentMode={environmentMode}
            pending={pending}
            onSelectIntent={selectIntent}
            onEnvironmentChange={changeEnvironment}
          />
        </section>

        <section className="experience-card discover-section" id="discover">
          <div className="discover-heading">
            <h2>Discover</h2>
          </div>
          <DiscoverGrid
            edition={discoverEdition}
            playableTrackIds={playableTrackIds}
            onSelect={selectDiscoverCard}
          />
        </section>
      </main>

      {showPlayerDock ? (
        <PlayerDock
          track={currentTrack}
          isPlaying={isPlaying}
          progress={progress}
          onTogglePlayback={togglePlayback}
          onNext={goNext}
          onOpen={() => setPlayerOpen(true)}
        />
      ) : null}

      <ExpandedPlayer
        currentTrack={currentTrack}
        tracks={recommendationItems}
        open={playerOpen}
        isPlaying={isPlaying}
        progress={progress}
        onClose={() => setPlayerOpen(false)}
        onTogglePlayback={togglePlayback}
        onSelect={playTrack}
        onNext={goNext}
        onPrevious={goPrevious}
        onRestart={restartTrack}
      />

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

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
