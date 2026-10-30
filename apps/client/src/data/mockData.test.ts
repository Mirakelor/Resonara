import { describe, expect, it } from "vitest";
import {
  discoverEdition,
  recommendationItems,
  tracks,
} from "./mockData";

describe("recommendation visual baseline data", () => {
  it("keeps the NOW batch aligned with the designer's 3-card layout", () => {
    expect(recommendationItems).toHaveLength(3);
    expect(new Set(recommendationItems.map((item) => item.track.id)).size).toBe(3);
    expect(recommendationItems.every((item) => item.track.playable)).toBe(true);
  });

  it("builds one daily discover edition from exactly four song covers", () => {
    expect(discoverEdition.cards).toHaveLength(4);

    for (const card of discoverEdition.cards) {
      expect(tracks[Object.keys(tracks).find(
        (key) => tracks[key]?.id === card.trackId,
      ) ?? ""]?.coverUrl).toBe(card.coverUrl);
      expect(card.title.length).toBeGreaterThan(0);
    }
  });
});
