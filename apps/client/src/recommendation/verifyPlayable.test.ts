import { describe, expect, it, vi } from "vitest";
import type { Candidate, PlaybackResolution } from "@resonara/contracts";
import type { NeteaseProvider } from "../services/netease/client";
import {
  revalidateVerifiedCandidates,
  resolveFreshPlaybackUrl,
  verifyPlayableCandidates,
  type VerifiedCandidate,
} from "./verifyPlayable";

const now = new Date("2026-10-30T15:00:00+08:00");

function candidate(id: string): Candidate {
  return {
    track: {
      id,
      provider: "netease",
      title: `Track ${id}`,
      artist: "Artist",
      artistIds: ["artist"],
      album: "Album",
      coverUrl: `https://cover.example.test/${id}.jpg`,
      genre: "Unknown",
      energyLabel: "Unrated",
      energy: 0.5,
      durationMs: 180_000,
      playable: false,
    },
    sources: ["favorite_similarity"],
    seedTrackIds: ["seed"],
    matchedDimensions: [],
    rawScore: null,
  };
}

function resolution(
  trackId: string,
  url: string | null,
  overrides: Partial<PlaybackResolution> = {},
): PlaybackResolution {
  return {
    trackId,
    url,
    expiresAt: "2026-10-30T16:00:00+08:00",
    level: "standard",
    playable: Boolean(url),
    unavailableReason: url ? null : "No URL",
    mediaType: url?.endsWith(".mp3") ? "mp3" : null,
    ...overrides,
  };
}

function providerWithPlayback(
  resolvePlaybackUrls: NeteaseProvider["resolvePlaybackUrls"],
): NeteaseProvider {
  return {
    searchTracks: vi.fn(),
    getTrackDetails: vi.fn(),
    getWikiSummary: vi.fn(),
    getLyrics: vi.fn(),
    getSimilarSongs: vi.fn(),
    getArtistSongs: vi.fn(),
    getPublicRecommendations: vi.fn(),
    getNewSongs: vi.fn(),
    resolvePlaybackUrls,
  };
}

describe("anonymous playability gate", () => {
  it("keeps only candidates with a non-empty supported URL", async () => {
    const candidates = ["1", "2", "3", "4"].map(candidate);
    const provider = providerWithPlayback(
      vi.fn().mockResolvedValue(
        new Map([
          ["1", resolution("1", "https://audio.example.test/one.mp3")],
          ["2", resolution("2", null)],
          ["3", resolution("3", "")],
          [
            "4",
            resolution("4", "https://audio.example.test/page.html", {
              mediaType: "text/html",
            }),
          ],
        ]),
      ),
    );

    const verified = await verifyPlayableCandidates(candidates, provider, {
      now: () => now,
    });

    expect(verified.map(({ track }) => track.id)).toEqual(["1"]);
    expect(verified[0]).toMatchObject({
      track: { playable: true },
      playbackUrl: "https://audio.example.test/one.mp3",
      verifiedAt: now.toISOString(),
    });
  });

  it("returns nothing when every anonymous URL is null or empty", async () => {
    const candidates = ["1", "2", "3"].map(candidate);
    const provider = providerWithPlayback(
      vi.fn().mockResolvedValue(
        new Map([
          ["1", resolution("1", null)],
          ["2", resolution("2", "")],
          ["3", resolution("3", "   ")],
        ]),
      ),
    );

    await expect(
      verifyPlayableCandidates(candidates, provider, { now: () => now }),
    ).resolves.toEqual([]);
  });

  it("revalidates expired URLs and removes expired fallbacks", async () => {
    const expired = "2026-10-30T14:00:00+08:00";
    const resolvePlaybackUrls = vi
      .fn()
      .mockResolvedValueOnce(
        new Map([
          ["1", resolution("1", "https://audio.example.test/one.mp3", {
            expiresAt: expired,
          })],
          ["2", resolution("2", "https://audio.example.test/two.mp3", {
            expiresAt: expired,
          })],
        ]),
      )
      .mockResolvedValueOnce(
        new Map([
          ["1", resolution("1", "https://audio.example.test/fresh-one.mp3")],
          ["2", resolution("2", "https://audio.example.test/two.mp3", {
            expiresAt: expired,
          })],
        ]),
      );

    const verified = await verifyPlayableCandidates(
      [candidate("1"), candidate("2")],
      providerWithPlayback(resolvePlaybackUrls),
      { now: () => now },
    );

    expect(verified.map(({ track }) => track.id)).toEqual(["1"]);
    expect(verified[0]?.playbackUrl).toBe(
      "https://audio.example.test/fresh-one.mp3",
    );
    expect(resolvePlaybackUrls).toHaveBeenCalledTimes(2);
  });

  it("caps filtered candidates at forty", async () => {
    const candidates = Array.from({ length: 50 }, (_, index) =>
      candidate(String(index + 1)),
    );
    const provider = providerWithPlayback(
      vi.fn().mockImplementation((ids: string[]) =>
        Promise.resolve(
          new Map(
            ids.map((id) => [
              id,
              resolution(id, `https://audio.example.test/${id}.mp3`),
            ]),
          ),
        ),
      ),
    );

    const verified = await verifyPlayableCandidates(candidates, provider, {
      now: () => now,
    });

    expect(verified).toHaveLength(40);
  });

  it("loads another lane batch when fewer than three tracks are playable", async () => {
    const resolvePlaybackUrls = vi
      .fn()
      .mockResolvedValueOnce(
        new Map([
          ["1", resolution("1", "https://audio.example.test/one.mp3")],
          ["2", resolution("2", null)],
        ]),
      )
      .mockResolvedValueOnce(
        new Map([
          ["3", resolution("3", "https://audio.example.test/three.mp3")],
          ["4", resolution("4", "https://audio.example.test/four.mp3")],
        ]),
      );
    const loadMore = vi
      .fn()
      .mockResolvedValue([candidate("3"), candidate("4")]);

    const verified = await verifyPlayableCandidates(
      [candidate("1"), candidate("2")],
      providerWithPlayback(resolvePlaybackUrls),
      { now: () => now, loadMore },
    );

    expect(verified).toHaveLength(3);
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it("revalidates the final candidates immediately before use", async () => {
    const original: VerifiedCandidate = {
      ...candidate("1"),
      track: { ...candidate("1").track, playable: true },
      playbackUrl: "https://audio.example.test/old.mp3",
      playbackExpiresAt: null,
      verifiedAt: "2026-10-30T14:00:00+08:00",
    };
    const provider = providerWithPlayback(
      vi.fn().mockResolvedValue(
        new Map([
          ["1", resolution("1", "https://audio.example.test/fresh.mp3")],
        ]),
      ),
    );

    const revalidated = await revalidateVerifiedCandidates(
      [original],
      provider,
      { now: () => now },
    );

    expect(revalidated[0]?.playbackUrl).toBe(
      "https://audio.example.test/fresh.mp3",
    );
  });

  it("resolves a fresh URL at playback start", async () => {
    const provider = providerWithPlayback(
      vi.fn().mockResolvedValue(
        new Map([
          ["1", resolution("1", "https://audio.example.test/play.mp3")],
        ]),
      ),
    );

    await expect(
      resolveFreshPlaybackUrl("1", provider, now),
    ).resolves.toMatchObject({
      url: "https://audio.example.test/play.mp3",
    });
  });

  it("blocks playback when the fresh URL is unavailable", async () => {
    const provider = providerWithPlayback(
      vi.fn().mockResolvedValue(new Map([["1", resolution("1", null)]])),
    );

    await expect(
      resolveFreshPlaybackUrl("1", provider, now),
    ).resolves.toBeNull();
  });
});
