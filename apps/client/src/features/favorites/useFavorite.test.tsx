// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { resonaraDb } from "../../db/database";
import * as favoritesRepository from "../../db/repositories/favorites";
import { useFavoritesStore } from "./useFavorite";

vi.mock("../recommendations/useRecommendationBatch", async () => {
  const { recommendationItems } = await import("../../data/mockData");
  const batch = {
    id: "75eb915a-a0db-40ab-810c-4386b7608eb5",
    generatedAt: "2026-10-30T15:00:00+08:00",
    intent: null,
    environmentMode: "use_current" as const,
    context: {
      localTime: "2026-10-30T15:00:00+08:00",
      timeZone: "Asia/Shanghai",
      city: null,
      weather: null,
      weatherSource: "unavailable" as const,
    },
    items: recommendationItems,
    featuredTrackId: recommendationItems[0]!.track.id,
  };
  return {
    useRecommendationBatch: () => ({
      batch,
      loading: false,
      error: null,
      generate: vi.fn(),
      refresh: vi.fn(),
    }),
  };
});

vi.mock("../discover/useDailyDiscover", async () => {
  const { discoverEdition } = await import("../../data/mockData");
  return {
    useDailyDiscover: () => ({
      edition: discoverEdition,
      loading: false,
      error: null,
      generate: vi.fn(),
    }),
  };
});

vi.mock("../player/usePlayerController", async () => {
  const { recommendationItems } = await import("../../data/mockData");
  return {
    usePlayerController: () => ({
      currentTrack: recommendationItems[0]!.track,
      isPlaying: false,
      progress: 0,
      currentTime: 0,
      duration: 180,
      lyrics: null,
      lyricTranslations: null,
      activeLyricIndex: -1,
      hasLyrics: false,
      lyricsOpen: false,
      muted: false,
      volume: 1,
      playTrack: vi.fn(),
      toggle: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      restart: vi.fn(),
      seek: vi.fn(),
      selectTrack: vi.fn(),
      toggleMute: vi.fn(),
      setVolume: vi.fn(),
      toggleLyrics: vi.fn(),
    }),
  };
});

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
  useFavoritesStore.setState({
    records: {},
    hydratedTrackIds: {},
  });
}

function favoriteButtons() {
  return screen.getAllByLabelText(/Undefined.*favorites/);
}

describe("favorite controls", () => {
  beforeEach(async () => {
    await resetDatabase();
    render(<App />);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    resonaraDb.close();
  });

  it("updates the recommendation row and player surface together", async () => {
    const user = userEvent.setup();
    expect(favoriteButtons()).toHaveLength(1);

    await user.click(favoriteButtons()[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(1);
    });

    await user.click(screen.getByRole("button", { name: "Play Undefined" }));
    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(2);
    });
  });

  it("persists the favorite and its liked feedback event", async () => {
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);

    await waitFor(async () => {
      expect(await resonaraDb.favorites.count()).toBe(1);
      expect(await resonaraDb.feedbackEvents.count()).toBe(1);
    });
    const event = await resonaraDb.feedbackEvents.toCollection().first();
    expect(event).toMatchObject({
      trackId: "3451951517",
      event: "liked",
      positionMs: 0,
    });

    cleanup();
    useFavoritesStore.setState({
      records: {},
      hydratedTrackIds: {},
      revisions: {},
      errors: {},
    });
    render(<App />);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(1);
    });
  });

  it("removes the favorite and records unliked without a dislike", async () => {
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);
    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Remove Undefined from favorites"),
      ).toHaveLength(1);
    });

    await user.click(
      screen.getAllByLabelText("Remove Undefined from favorites")[0]!,
    );

    await waitFor(async () => {
      expect(await resonaraDb.favorites.count()).toBe(0);
      expect(await resonaraDb.feedbackEvents.count()).toBe(2);
    });
    const events = await resonaraDb.feedbackEvents.orderBy("id").toArray();
    expect(events.map(({ event }) => event)).toEqual(["liked", "unliked"]);
  });

  it("rolls back the optimistic state when IndexedDB fails", async () => {
    vi.spyOn(favoritesRepository, "addFavorite").mockRejectedValueOnce(
      new Error("IndexedDB write failed"),
    );
    const user = userEvent.setup();
    await user.click(favoriteButtons()[0]!);

    await waitFor(() => {
      expect(
        screen.getAllByLabelText("Save Undefined to favorites"),
      ).toHaveLength(1);
    });
  });
});
