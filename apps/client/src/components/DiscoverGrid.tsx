import type { DiscoverEdition, DiscoverCard } from "@resonara/contracts";
import { Icon } from "./Icon";

type DiscoverGridProps = {
  edition: DiscoverEdition;
  onSelect: (card: DiscoverCard) => void;
  disabled?: boolean;
};

export function DiscoverGrid({
  edition,
  onSelect,
  disabled = false,
}: DiscoverGridProps) {
  return (
    <div className="discover-grid">
      {edition.cards.map((card) => (
        <button
          className="discover-card"
          type="button"
          key={card.id}
          onClick={() => onSelect(card)}
          disabled={disabled}
        >
          <img
            src={card.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
          />
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
