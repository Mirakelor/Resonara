import Dexie, { type Table } from "dexie";
import { appSettingsSchema } from "@resonara/contracts";
import type {
  AIDecisionRow,
  DiscoverEditionRow,
  FavoriteRow,
  FeedbackEventRow,
  LyricsCacheRow,
  PlaybackCacheRow,
  ProfileRow,
  ProviderCacheRow,
  RecommendationBatchRow,
  SettingsRow,
  TrackCacheRow,
} from "./schema";

export const DEFAULT_MUSIC_API_BASE_URL =
  "https://netease-cloud-music-api-enhanced-shiro.sonder.eu.org";

export const DEFAULT_SETTINGS = appSettingsSchema.parse({
  musicApiBaseUrl: DEFAULT_MUSIC_API_BASE_URL,
  musicApiToken: "",
  aiBaseUrl: "",
  aiApiKey: "",
  aiModel: "",
});

export class ResonaraDatabase extends Dexie {
  settings!: Table<SettingsRow, string>;
  profile!: Table<ProfileRow, string>;
  favorites!: Table<FavoriteRow, string>;
  feedbackEvents!: Table<FeedbackEventRow, number>;
  recommendationBatches!: Table<RecommendationBatchRow, string>;
  discoverEditions!: Table<DiscoverEditionRow, string>;
  trackCache!: Table<TrackCacheRow, string>;
  lyricsCache!: Table<LyricsCacheRow, string>;
  playbackCache!: Table<PlaybackCacheRow, string>;
  providerCache!: Table<ProviderCacheRow, string>;
  aiDecisions!: Table<AIDecisionRow, number>;

  constructor() {
    super("resonara");

    this.version(1).stores({
      settings: "key",
      profile: "id",
      favorites:
        "trackId, track.artist, *enrichment.genreTags, enrichment.language, *enrichment.credits.composers, *enrichment.credits.lyricists, createdAt",
      feedbackEvents: "++id, batchId, trackId, event, occurredAt",
      recommendationBatches: "id, generatedAt",
      discoverEditions: "editionDate, expiresAt",
      trackCache: "trackId, fetchedAt",
      lyricsCache: "key, expiresAt",
      playbackCache: "key, expiresAt",
      providerCache: "key, expiresAt",
      aiDecisions: "++id, kind, createdAt",
    });
  }
}

export const resonaraDb = new ResonaraDatabase();

export async function clearAllData(): Promise<void> {
  resonaraDb.close();
  await resonaraDb.delete();
  await resonaraDb.open();
}
