import type { RecommendationItem } from "@resonara/contracts";
import { Icon } from "./Icon";

type TrackCardProps = {
  item: RecommendationItem;
  onPlay: () => void;
};

export function TrackCard({ item, onPlay }: TrackCardProps) {
  const { track } = item;

  return (
    <article className="track-card">
      <img className="track-card__cover" src={track.coverUrl} alt="" />
      <div className="track-card__body">
        <h3>{track.title}</h3>
        <p className="track-card__meta">
          {track.artist} · {track.genre} · {track.energyLabel}
        </p>
      </div>
      <button
        className="track-card__play"
        type="button"
        onClick={onPlay}
        aria-label={`Play ${track.title}`}
      >
        <Icon name="play" size={17} />
      </button>
    </article>
  );
}
