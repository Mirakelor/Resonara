import type {
  AppSettings,
  PlaybackResolution,
  TrackEnrichment,
} from "@resonara/contracts";
import { z } from "zod";
import { requestJson } from "../http";
import { ProviderRequestError } from "../providers/providerErrors";
import { mapSong, type NeteaseSongShape, type RawTrack } from "./mappers";
import { mapWikiSummary, wikiSummarySchema } from "./wiki";
import {
  parseLyrics,
  type ParsedNeteaseLyrics,
} from "./lyricParser";

const songSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
  })
  .passthrough();

const searchSchema = z.object({
  result: z.object({
    songs: z.array(songSchema).default([]),
  }),
});

const songsSchema = z.object({
  songs: z.array(songSchema).default([]),
});

const detailsSchema = z.object({
  songs: z.array(songSchema).default([]),
});

const recommendationsSchema = z.object({
  data: z.object({
    dailySongs: z.array(songSchema).default([]),
  }),
});

const newSongsSchema = z.object({
  result: z.array(
    z.object({
      song: songSchema,
    }),
  ).default([]),
});

const lyricsSchema = z
  .object({
    lrc: z.object({ lyric: z.string().nullish() }).nullish(),
    tlyric: z.object({ lyric: z.string().nullish() }).nullish(),
    yrc: z.object({ lyric: z.string().nullish() }).nullish(),
    ytlrc: z.object({ lyric: z.string().nullish() }).nullish(),
    offset: z.number().optional(),
  })
  .passthrough();

const playbackSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.union([z.string(), z.number()]),
        url: z.string().nullable().optional(),
        expi: z.number().optional(),
        type: z.string().nullable().optional(),
      })
      .passthrough(),
  ),
});

export type TrackDetails = RawTrack;

export interface NeteaseProvider {
  searchTracks(query: string, limit: number): Promise<RawTrack[]>;
  getTrackDetails(ids: string[]): Promise<TrackDetails[]>;
  getWikiSummary(trackId: string): Promise<TrackEnrichment>;
  getLyrics(trackId: string): Promise<ParsedNeteaseLyrics>;
  getSimilarSongs(trackId: string, limit: number): Promise<RawTrack[]>;
  getArtistSongs(artistId: string, limit: number): Promise<RawTrack[]>;
  getPublicRecommendations(): Promise<RawTrack[]>;
  getNewSongs(limit: number): Promise<RawTrack[]>;
  resolvePlaybackUrls(
    ids: string[],
  ): Promise<Map<string, PlaybackResolution>>;
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function createNeteaseProvider(
  settings: AppSettings,
): NeteaseProvider {
  const baseUrl = settings.musicApiBaseUrl.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    throw new ProviderRequestError(
      "configuration",
      "Enter a Music API Base URL first.",
      null,
    );
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (settings.musicApiToken.trim()) {
    headers.Authorization = `Bearer ${settings.musicApiToken.trim()}`;
  }

  let requestSequence = 0;
  const request = <T>(path: string, schema: z.ZodType<T>) => {
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set(
      "_resonara_ts",
      `${Date.now()}-${++requestSequence}`,
    );
    return requestJson(url.toString(), { headers }, schema);
  };

  return {
    async searchTracks(query, limit) {
      const params = new URLSearchParams({
        keywords: query,
        limit: String(limit),
      });
      const response = await request(`/search?${params}`, searchSchema);
      return response.result.songs.map((song) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async getTrackDetails(ids) {
      if (ids.length === 0) return [];
      const params = new URLSearchParams({ ids: ids.join(",") });
      const response = await request(`/song/detail?${params}`, detailsSchema);
      return response.songs.map((song) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async getWikiSummary(trackId) {
      const params = new URLSearchParams({ id: trackId });
      const response = await request(
        `/song/wiki/summary?${params}`,
        wikiSummarySchema,
      );
      return mapWikiSummary(response);
    },

    async getLyrics(trackId) {
      const params = new URLSearchParams({ id: trackId });
      const response = await request(`/lyric/new?${params}`, lyricsSchema);
      return parseLyrics(response);
    },

    async getSimilarSongs(trackId, limit) {
      const params = new URLSearchParams({
        id: trackId,
        limit: String(limit),
      });
      const response = await request(`/simi/song?${params}`, songsSchema);
      return response.songs.map((song) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async getArtistSongs(artistId, limit) {
      const params = new URLSearchParams({
        id: artistId,
        limit: String(limit),
      });
      const response = await request(`/artist/songs?${params}`, songsSchema);
      return response.songs.map((song) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async getPublicRecommendations() {
      const response = await request("/recommend/songs", recommendationsSchema);
      return response.data.dailySongs.map((song) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async getNewSongs(limit) {
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await request(
        `/personalized/newsong?${params}`,
        newSongsSchema,
      );
      return response.result.map(({ song }) =>
        mapSong(song as NeteaseSongShape),
      );
    },

    async resolvePlaybackUrls(ids) {
      const result = new Map<string, PlaybackResolution>();

      for (const batch of chunk(ids, 20)) {
        const params = new URLSearchParams({
          id: batch.join(","),
          level: "standard",
        });
        const response = await request(`/song/url/v1?${params}`, playbackSchema);

        for (const item of response.data) {
          const trackId = String(item.id);
          const url =
            typeof item.url === "string" && item.url.trim()
              ? item.url.trim()
              : null;
          const expiresAt =
            url && item.expi
              ? new Date(Date.now() + item.expi * 1000).toISOString()
              : null;
          result.set(trackId, {
            trackId,
            url,
            expiresAt,
            level: "standard",
            playable: Boolean(url),
            unavailableReason: url
              ? null
              : "No anonymous standard-quality URL was returned.",
            mediaType: item.type ?? null,
          });
        }
      }

      return result;
    },
  };
}
