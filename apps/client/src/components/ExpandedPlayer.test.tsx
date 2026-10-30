// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecommendationItem, Track } from "@resonara/contracts";
import { ExpandedPlayer } from "./ExpandedPlayer";

vi.mock("../features/favorites/useFavorite", () => ({
  useFavorite: () => ({
    isFavorite: false,
    favoriteError: null,
    toggleFavorite: vi.fn(),
  }),
}));

const track: Track = {
  id: "track-1",
  provider: "netease",
  title: "Tremolo",
  artist: "Chilli Beans.",
  artistIds: ["artist-1"],
  album: "Chilli Beans.",
  coverUrl: "https://cover.example.test/track.jpg",
  genre: "Japanese Pop",
  energyLabel: "Mid-tempo",
  energy: 0.5,
  durationMs: 180_000,
  playable: true,
};

const item: RecommendationItem = {
  rank: 1,
  track,
  confidence: 0.9,
  reason: {
    summary: "A verified recommendation.",
    personalFactor: "A saved artist.",
    contextFactor: "Cloudy weather.",
  },
};

function renderPlayer(overrides: { hasLyrics?: boolean } = {}) {
  const hasLyrics = overrides.hasLyrics ?? true;
  return render(
    <ExpandedPlayer
      currentTrack={track}
      tracks={[item]}
      open
      isPlaying={false}
      progress={0.3}
      currentTime={54}
      duration={180}
      lyrics={
        hasLyrics
          ? [
              { timeMs: 0, text: "First line" },
              { timeMs: 5_000, text: "Second line" },
            ]
          : null
      }
      lyricTranslations={new Map()}
      activeLyricIndex={0}
      hasLyrics={hasLyrics}
      lyricsOpen={false}
      muted={false}
      volume={0.8}
      onClose={vi.fn()}
      onTogglePlayback={vi.fn()}
      onSelect={vi.fn()}
      onNext={vi.fn()}
      onPrevious={vi.fn()}
      onRestart={vi.fn()}
      onSeek={vi.fn()}
      onToggleLyrics={vi.fn()}
      onVolumeChange={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("ExpandedPlayer controls", () => {
  it("shows a disabled lyrics button when lyrics are unavailable", () => {
    renderPlayer({ hasLyrics: false });

    expect(
      (screen.getByRole("button", { name: "No lyrics" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("reveals the volume slider only after clicking the volume button", async () => {
    const user = userEvent.setup();
    renderPlayer();

    const button = screen.getByRole("button", { name: "Show volume" });
    const slider = screen.getByLabelText("Volume");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(slider.getAttribute("aria-hidden")).toBe("true");

    await user.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(slider.getAttribute("aria-hidden")).toBe("false");
  });
});
