import type { RecommendationItem, Track } from "@resonara/contracts";
import { Icon } from "./Icon";

type ExpandedPlayerProps = {
  currentTrack: Track;
  tracks: RecommendationItem[];
  open: boolean;
  isPlaying: boolean;
  progress: number;
  onClose: () => void;
  onTogglePlayback: () => void;
  onSelect: (track: Track) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRestart: () => void;
};

export function ExpandedPlayer({
  currentTrack,
  tracks,
  open,
  isPlaying,
  progress,
  onClose,
  onTogglePlayback,
  onSelect,
  onNext,
  onPrevious,
  onRestart,
}: ExpandedPlayerProps) {
  return (
    <div
      className={`player-sheet-backdrop ${open ? "player-sheet-backdrop--open" : ""}`}
      aria-hidden={!open}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className={`expanded-player ${open ? "expanded-player--open" : ""}`}
        aria-label="Music player"
        aria-modal="true"
        role="dialog"
      >
        <header className="expanded-player__header">
          <p className="eyebrow">Now Playing</p>
          <button
            type="button"
            className="expanded-player__close"
            onClick={onClose}
            aria-label="Close player"
          >
            <Icon name="close" size={20} />
          </button>
        </header>

        <figure className="expanded-player__cover">
          <img
            src={currentTrack.coverUrl}
            alt={`${currentTrack.title} album cover`}
          />
        </figure>

        <div className="expanded-player__song">
          <div>
            <h2>{currentTrack.title}</h2>
            <p>{currentTrack.artist}</p>
          </div>
          <span>{currentTrack.genre}</span>
        </div>

        <div className="player-progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>

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
          <button type="button" aria-label="Volume">
            <Icon name="volume" size={19} />
          </button>
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
                    <img src={track.coverUrl} alt="" />
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
