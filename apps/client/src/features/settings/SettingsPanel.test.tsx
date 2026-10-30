// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import {
  DEFAULT_MUSIC_API_BASE_URL,
  resonaraDb,
} from "../../db/database";
import { addFavorite } from "../../db/repositories/favorites";

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
      playTrack: vi.fn(),
      toggle: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      restart: vi.fn(),
      seek: vi.fn(),
      selectTrack: vi.fn(),
      toggleMute: vi.fn(),
      toggleLyrics: vi.fn(),
    }),
  };
});

const timestamp = "2026-10-30T14:30:00+08:00";
const track = {
  id: "track-1",
  provider: "netease" as const,
  title: "Tremolo",
  artist: "Chilli Beans.",
  artistIds: ["49392892"],
  album: "Chilli Beans.",
  coverUrl:
    "https://p4.music.126.net/L8f07BDPoT_tAHqmTUgP5A==/109951167596576841.jpg",
  genre: "Alternative",
  energyLabel: "Melodic",
  energy: 0.64,
  durationMs: 213000,
  playable: true,
};

async function resetDatabase() {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
}

async function openSettings() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open settings" }));
  return {
    user,
    dialog: await screen.findByRole("dialog", { name: "Settings" }),
  };
}

describe("Settings", () => {
  beforeEach(async () => {
    await resetDatabase();
    render(<App />);
  });
  afterEach(() => {
    cleanup();
    resonaraDb.close();
  });

  it("opens and closes with a mouse, and Escape closes it too", async () => {
    const { user, dialog } = await openSettings();
    expect(dialog).toBeDefined();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    });

    const settingsButton = screen.getByRole("button", { name: "Open settings" });
    settingsButton.focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("dialog", { name: "Settings" });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Settings" })).toBeNull();
    });
  });

  it("shows the default Music API URL and only the approved fields", async () => {
    await openSettings();

    expect(
      (screen.getByLabelText("Music API Base URL") as HTMLInputElement).value,
    ).toBe(DEFAULT_MUSIC_API_BASE_URL);
    expect(screen.getByLabelText("Music API Access Token")).toBeDefined();
    expect(screen.getByLabelText("AI API Base URL")).toBeDefined();
    expect(screen.getByLabelText("AI API Key")).toBeDefined();
    expect(screen.getByLabelText("AI Model")).toBeDefined();
    expect(screen.queryByLabelText("Playback quality")).toBeNull();
    expect(screen.queryByLabelText("City")).toBeNull();
    expect(screen.queryByLabelText("Use precise location")).toBeNull();
    expect(screen.queryByText("Clear local music data")).toBeNull();
  });

  it("masks the token and AI key by default", async () => {
    await openSettings();

    expect(
      (screen.getByLabelText("Music API Access Token") as HTMLInputElement)
        .type,
    ).toBe("password");
    expect(
      (screen.getByLabelText("AI API Key") as HTMLInputElement).type,
    ).toBe("password");
  });

  it("persists saved settings after reopening the panel", async () => {
    const { user } = await openSettings();
    const musicUrl = screen.getByLabelText("Music API Base URL");

    await user.clear(musicUrl);
    await user.type(musicUrl, "https://music.example.test/");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Settings saved.");
    await user.click(screen.getByRole("button", { name: "Close settings" }));

    await openSettings();
    expect(
      (screen.getByLabelText("Music API Base URL") as HTMLInputElement).value,
    ).toBe("https://music.example.test");
  });

  it("does not persist edits when cancelled", async () => {
    const { user } = await openSettings();
    const musicUrl = screen.getByLabelText("Music API Base URL");

    await user.clear(musicUrl);
    await user.type(musicUrl, "https://discarded.example.test");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Open settings" }));

    expect(
      (screen.getByLabelText("Music API Base URL") as HTMLInputElement).value,
    ).toBe(DEFAULT_MUSIC_API_BASE_URL);
  });

  it("clears favorites and resets every setting after confirmation", async () => {
    await addFavorite({
      trackId: track.id,
      track,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastVerifiedAt: timestamp,
    });
    const { user } = await openSettings();

    await user.click(screen.getByRole("button", { name: "Clear all data" }));
    await user.click(
      screen.getByRole("button", { name: "Delete all local data" }),
    );

    await waitFor(async () => {
      expect(await resonaraDb.favorites.count()).toBe(0);
    });
    expect(
      (screen.getByLabelText("Music API Base URL") as HTMLInputElement).value,
    ).toBe(DEFAULT_MUSIC_API_BASE_URL);
    expect(
      (screen.getByLabelText("AI API Base URL") as HTMLInputElement).value,
    ).toBe("");
    expect((screen.getByLabelText("AI API Key") as HTMLInputElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("AI Model") as HTMLInputElement).value).toBe(
      "",
    );
  });
});
