import type { Track } from "@resonara/contracts";
import { Icon } from "./Icon";

type PlayerDockProps = {
  track: Track;
  isPlaying: boolean;
  progress: number;
  onTogglePlayback: () => void;
  onNext: () => void;
  onOpen: () => void;
};

export function PlayerDock({
  track,
  isPlaying,
  progress,
  onTogglePlayback,
  onNext,
  onOpen,
}: PlayerDockProps) {
  if (!track.playable) return null;

  return (
    <aside className="player-dock" aria-label="Now playing">
      <button
        type="button"
        className="player-dock__track"
        onClick={onOpen}
        aria-label="Expand player"
      >
        <img
          src={track.coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <span>
          <strong>{track.title}</strong>
          <small>{track.artist}</small>
        </span>
      </button>

      <div className="player-dock__progress" aria-hidden="true">
        <span style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="player-dock__controls">
        <button
          type="button"
          className="icon-button icon-button--dark"
          onClick={onTogglePlayback}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          <Icon name={isPlaying ? "pause" : "play"} size={18} />
        </button>
        <button
          type="button"
          className="player-dock__next"
          onClick={onNext}
          aria-label="Next track"
        >
          <Icon name="next" size={18} />
        </button>
        <button
          type="button"
          className="player-dock__queue"
          onClick={onOpen}
          aria-label="Open play queue"
        >
          <Icon name="queue" size={20} />
        </button>
      </div>
    </aside>
  );
}
