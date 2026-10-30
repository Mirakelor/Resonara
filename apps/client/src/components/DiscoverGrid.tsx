import type { DiscoverEdition, DiscoverCard } from "@resonara/contracts";
import { Icon } from "./Icon";

type DiscoverGridProps = {
  edition: DiscoverEdition;
  playableTrackIds: ReadonlySet<string>;
  onSelect: (card: DiscoverCard) => void;
};

export function DiscoverGrid({
  edition,
  playableTrackIds,
  onSelect,
}: DiscoverGridProps) {
  const cards = edition.cards.filter((card) =>
    playableTrackIds.has(card.trackId),
  );

  return (
    <div className="discover-grid">
      {cards.map((card) => (
        <button
          className="discover-card"
          type="button"
          key={card.id}
          onClick={() => onSelect(card)}
        >
          <img src={card.coverUrl} alt="" />
          <span className="discover-card__veil" />
          <span className="discover-card__top">
            <Icon name="arrow-up-right" size={20} />
          </span>
          <span className="discover-card__bottom">
            <span className="discover-card__title">{card.title}</span>
            <span className="discover-card__subtitle">{card.subtitle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
