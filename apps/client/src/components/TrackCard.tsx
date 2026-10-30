import type { RecommendationItem } from "@resonara/contracts";
import { useFavorite } from "../features/favorites/useFavorite";
import { Icon } from "./Icon";

type TrackCardProps = {
  item: RecommendationItem;
  onPlay: () => void;
};

export function TrackCard({ item, onPlay }: TrackCardProps) {
  const { track } = item;
  const { isFavorite, toggleFavorite } = useFavorite(track);

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
        className={`favorite-button track-card__favorite ${isFavorite ? "favorite-button--active" : ""}`}
        type="button"
        onClick={() => void toggleFavorite()}
        aria-label={
          isFavorite
            ? `Remove ${track.title} from favorites`
            : `Save ${track.title} to favorites`
        }
      >
        <Icon
          name="heart"
          size={16}
          fill={isFavorite ? "currentColor" : "none"}
        />
      </button>
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
