import { lazy, Suspense, useState } from "react";
import type { RecommendationItem, Track } from "@resonara/contracts";
import { useFavorite } from "../features/favorites/useFavorite";
import type {
  LyricLine,
  TranslationMap,
} from "../features/player/lyrics";
import { Icon } from "./Icon";

const LyricsPanel = lazy(() =>
  import("../features/player/LyricsPanel").then((module) => ({
    default: module.LyricsPanel,
  })),
);

type ExpandedPlayerProps = {
  currentTrack: Track;
  tracks: RecommendationItem[];
  open: boolean;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[] | null;
  lyricTranslations: TranslationMap | null;
  activeLyricIndex: number;
  hasLyrics: boolean;
  lyricsOpen: boolean;
  muted: boolean;
  volume: number;
  onClose: () => void;
  onTogglePlayback: () => void;
  onSelect: (track: Track) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onToggleLyrics: () => void;
  onVolumeChange: (volume: number) => void;
};

export function ExpandedPlayer({
  currentTrack,
  tracks,
  open,
  isPlaying,
  progress,
  currentTime,
  duration,
  lyrics,
  lyricTranslations,
  activeLyricIndex,
  hasLyrics,
  lyricsOpen,
  muted,
  volume,
  onClose,
  onTogglePlayback,
  onSelect,
  onNext,
  onPrevious,
  onRestart,
  onSeek,
  onToggleLyrics,
  onVolumeChange,
}: ExpandedPlayerProps) {
  const { isFavorite, toggleFavorite } = useFavorite(currentTrack);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const usesHover = () =>
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(hover: hover)").matches);

  return (
    <div
      className={`player-sheet-backdrop ${open ? "player-sheet-backdrop--open" : ""}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className={`expanded-player ${open ? "expanded-player--open" : ""} ${hasLyrics && lyricsOpen ? "expanded-player--lyrics" : ""}`}
        aria-label="Music player"
        aria-modal="true"
        role="dialog"
      >
        <header className="expanded-player__header">
          <p className="eyebrow">Now Playing</p>
          <div className="expanded-player__header-actions">
            <button
              type="button"
              className="expanded-player__lyrics-toggle"
              onClick={onToggleLyrics}
              aria-pressed={hasLyrics ? lyricsOpen : false}
              aria-label={hasLyrics ? undefined : "No lyrics"}
              disabled={!hasLyrics}
            >
              {hasLyrics
                ? lyricsOpen
                  ? "Hide lyrics"
                  : "Show lyrics"
                : "No lyrics"}
            </button>
            <button
              type="button"
              className="expanded-player__close"
              onClick={onClose}
              aria-label="Close player"
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </header>

        <figure
          className={`expanded-player__cover ${hasLyrics && lyricsOpen ? "expanded-player__cover--lyrics" : ""}`}
        >
          {hasLyrics && lyricsOpen && lyrics && lyricTranslations ? (
            <Suspense fallback={null}>
              <LyricsPanel
                lines={lyrics}
                translations={lyricTranslations}
                activeIndex={activeLyricIndex}
              />
            </Suspense>
          ) : (
            <img
              src={currentTrack.coverUrl}
              alt={`${currentTrack.title} album cover`}
            />
          )}
        </figure>

        <div className="expanded-player__song">
          <div>
            <div className="expanded-player__title-row">
              <h2>{currentTrack.title}</h2>
              <button
                className={`favorite-button expanded-player__favorite ${isFavorite ? "favorite-button--active" : ""}`}
                type="button"
                onClick={() => void toggleFavorite()}
                aria-label={
                  isFavorite
                    ? `Remove ${currentTrack.title} from favorites`
                    : `Save ${currentTrack.title} to favorites`
                }
              >
                <Icon
                  name="heart"
                  size={18}
                  fill={isFavorite ? "currentColor" : "none"}
                />
              </button>
            </div>
            <p>{currentTrack.artist}</p>
          </div>
          <span>
            {currentTrack.genre !== "Unknown"
              ? currentTrack.genre
              : (currentTrack.album ?? "Song")}
          </span>
        </div>

        <input
          className="player-progress"
          type="range"
          min="0"
          max={Math.max(duration, 0.01)}
          step="0.1"
          value={Math.min(currentTime, Math.max(duration, 0.01))}
          aria-label="Seek in track"
          onChange={(event) => onSeek(Number(event.target.value))}
          style={{
            background: `linear-gradient(90deg, var(--color-accent) 0 ${progress * 100}%, rgba(23, 24, 21, 0.12) ${progress * 100}% 100%)`,
          }}
        />

        <div className="expanded-controls">
          <button type="button" onClick={onRestart} aria-label="Restart track">
            <Icon name="restart" size={19} />
          </button>
          <button type="button" onClick={onPrevious} aria-label="Previous track">
            <Icon name="previous" size={19} />
          </button>
          <button
            className="expanded-controls__main"
            type="button"
            onClick={onTogglePlayback}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <Icon name={isPlaying ? "pause" : "play"} size={22} />
          </button>
          <button type="button" onClick={onNext} aria-label="Next track">
            <Icon name="next" size={19} />
          </button>
          <div
            className={`expanded-volume ${volumeOpen ? "expanded-volume--open" : ""}`}
            onPointerEnter={() => {
              if (usesHover()) setVolumeOpen(true);
            }}
            onPointerLeave={() => {
              if (usesHover()) setVolumeOpen(false);
            }}
          >
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              aria-label="Volume"
              aria-hidden={!volumeOpen}
              tabIndex={volumeOpen ? 0 : -1}
              onChange={(event) =>
                onVolumeChange(Number(event.target.value))
              }
            />
            <button
              type="button"
              aria-label="Show volume"
              aria-expanded={volumeOpen}
              title={muted ? "Volume muted" : "Volume"}
              onClick={() => {
                if (!usesHover()) setVolumeOpen((open) => !open);
              }}
              onFocus={() => {
                if (usesHover()) setVolumeOpen(true);
              }}
              onBlur={() => {
                if (usesHover()) setVolumeOpen(false);
              }}
            >
              <Icon name="volume" size={19} />
            </button>
          </div>
        </div>

        <section className="player-queue" aria-labelledby="queue-title">
          <div className="player-queue__header">
            <h3 id="queue-title">Up next</h3>
            <span>{tracks.length} tracks</span>
          </div>
          <ol>
            {tracks.map(({ track, rank }) => {
              const active = track.id === currentTrack.id;
              return (
                <li key={track.id}>
                  <button
                    className={
                      active ? "queue-item queue-item--active" : "queue-item"
                    }
                    type="button"
                    onClick={() => onSelect(track)}
                  >
                    <span className="queue-item__index">
                      {active ? (
                        <Icon name="play" size={13} />
                      ) : (
                        String(rank).padStart(2, "0")
                      )}
                    </span>
                    <img
                      src={track.coverUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <span className="queue-item__copy">
                      <strong>{track.title}</strong>
                      <small>{track.artist}</small>
                    </span>
                    <span className="queue-item__meta">
                      {track.energyLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      </aside>
    </div>
  );
}
