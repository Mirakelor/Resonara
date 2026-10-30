// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Track } from "@resonara/contracts";
import type { AudioEngine } from "./AudioEngine";
import { getActiveLyricIndex, parseLrc } from "./lyrics";
import { usePlayerController } from "./usePlayerController";

const tracks: Track[] = ["a", "b"].map((id) => ({
  id,
  provider: "netease",
  title: `Track ${id}`,
  artist: `Artist ${id}`,
  artistIds: [`artist-${id}`],
  album: "Album",
  coverUrl: `https://cover.example.test/${id}.jpg`,
  genre: "Electronic",
  energyLabel: "Mid-tempo",
  energy: 0.5,
  durationMs: 180_000,
  playable: true,
}));

class FakeAudioEngine implements AudioEngine {
  currentTime = 0;
  duration = 180;
  paused = true;
  volume = 1;
  loadedUrl: string | null = null;
  play = vi.fn(async () => {
    this.paused = false;
    this.onPlayStateChange?.(false);
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.onPlayStateChange?.(true);
  });
  seek = vi.fn((seconds: number) => {
    this.currentTime = seconds;
    this.onTimeUpdate?.(seconds, this.duration);
  });
  restart = vi.fn(() => {
    this.currentTime = 0;
    this.onTimeUpdate?.(0, this.duration);
  });
  setVolume = vi.fn((volume: number) => {
    this.volume = volume;
  });
  load = vi.fn((url: string) => {
    this.loadedUrl = url;
  });
  dispose = vi.fn();
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onPlayStateChange?: (paused: boolean) => void;
  onError?: (message: string) => void;

  emitTime(currentTime: number, duration = this.duration) {
    this.currentTime = currentTime;
    this.duration = duration;
    this.onTimeUpdate?.(currentTime, duration);
  }
}

describe("player controller", () => {
  it("resolves a fresh URL whenever playback starts", async () => {
    const engine = new FakeAudioEngine();
    const resolvePlaybackUrl = vi
      .fn()
      .mockResolvedValueOnce("https://audio.example.test/a-1.mp3")
      .mockResolvedValueOnce("https://audio.example.test/b-next.mp3")
      .mockResolvedValueOnce("https://audio.example.test/a-2.mp3");
    const { result } = renderHook(() =>
      usePlayerController({
        queue: tracks,
        engine,
        resolvePlaybackUrl,
        loadLyrics: vi.fn().mockResolvedValue(null),
      }),
    );

    await act(() => result.current.playTrack(tracks[0]!));
    await waitFor(() => expect(engine.loadedUrl).toContain("a-1.mp3"));

    await act(() => result.current.playTrack(tracks[0]!));
    await waitFor(() => expect(engine.loadedUrl).toContain("a-2.mp3"));
    expect(
      resolvePlaybackUrl.mock.calls.filter(([trackId]) => trackId === "a"),
    ).toHaveLength(2);
  });

  it("restart returns to zero and preserves playing state", async () => {
    const engine = new FakeAudioEngine();
    const { result } = renderHook(() =>
      usePlayerController({
        queue: tracks,
        engine,
        resolvePlaybackUrl: vi
          .fn()
          .mockResolvedValue("https://audio.example.test/a.mp3"),
        loadLyrics: vi.fn().mockResolvedValue(null),
      }),
    );

    await act(() => result.current.playTrack(tracks[0]!));
    engine.emitTime(42);
    act(() => result.current.restart());

    expect(engine.currentTime).toBe(0);
    expect(engine.paused).toBe(false);
  });

  it("supports next, previous, seek, and queue completion", async () => {
    const engine = new FakeAudioEngine();
    const resolvePlaybackUrl = vi
      .fn()
      .mockResolvedValue("https://audio.example.test/track.mp3");
    const { result } = renderHook(() =>
      usePlayerController({
        queue: tracks,
        engine,
        resolvePlaybackUrl,
        loadLyrics: vi.fn().mockResolvedValue(null),
      }),
    );

    await act(() => result.current.playTrack(tracks[0]!));
    await act(() => result.current.next());
    expect(result.current.currentTrack?.id).toBe("b");

    await act(() => result.current.previous());
    expect(result.current.currentTrack?.id).toBe("a");

    act(() => result.current.seek(30));
    expect(engine.currentTime).toBe(30);

    await act(() => result.current.playTrack(tracks[1]!));
    await act(() => result.current.next());
    expect(result.current.currentTrack?.id).toBe("b");
    expect(engine.pause).toHaveBeenCalled();
  });

  it("selects lyric lines with binary search and applies offset", () => {
    const lines = parseLrc(
      "[00:01.00]First\n[00:05.00]Second\n[00:10.00]Third\n",
    );

    expect(getActiveLyricIndex(lines, 4_000, 1_500)).toBe(0);
    expect(getActiveLyricIndex(lines, 4_000, 0)).toBe(0);
    expect(getActiveLyricIndex(lines, 5_000, 0)).toBe(1);
    expect(getActiveLyricIndex(lines, 12_000, 0)).toBe(2);
  });

  it("hides lyrics for instrumental tracks", async () => {
    const { result } = renderHook(() =>
      usePlayerController({
        queue: [tracks[0]!],
        engine: new FakeAudioEngine(),
        resolvePlaybackUrl: vi
          .fn()
          .mockResolvedValue("https://audio.example.test/a.mp3"),
        loadLyrics: vi.fn().mockResolvedValue({
          originalLrc: null,
          translationLrc: null,
          richLyrics: null,
          offsetMs: 0,
          hasLyrics: false,
          credits: { lyricists: [], composers: [], arrangers: [] },
        }),
      }),
    );

    await act(() => result.current.playTrack(tracks[0]!));

    await waitFor(() => expect(result.current.hasLyrics).toBe(false));
    expect(result.current.lyrics).toBeNull();
  });

  it("notifies and advances to the next track when playback fails", async () => {
    const engine = new FakeAudioEngine();
    const onNotice = vi.fn();
    const { result } = renderHook(() =>
      usePlayerController({
        queue: tracks,
        engine,
        onNotice,
        resolvePlaybackUrl: vi
          .fn()
          .mockImplementation((trackId: string) =>
            Promise.resolve(
              trackId === "a"
                ? null
                : "https://audio.example.test/b.mp3",
            ),
          ),
        loadLyrics: vi.fn().mockResolvedValue(null),
      }),
    );

    await act(() => result.current.playTrack(tracks[0]!));

    await waitFor(() => expect(result.current.currentTrack?.id).toBe("b"));
    expect(onNotice).toHaveBeenCalled();
    expect(engine.loadedUrl).toContain("b.mp3");
  });
});
