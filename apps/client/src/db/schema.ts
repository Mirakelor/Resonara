import type {
  AppSettings,
  DiscoverEdition,
  FavoriteRecord,
  RecommendationBatch,
  RecommendationFeedback,
  TasteProfile,
  Track,
} from "@resonara/contracts";

export interface SettingsRow {
  key: "default";
  value: AppSettings;
  updatedAt: string;
}

export interface ProfileRow {
  id: "default";
  value: TasteProfile;
  updatedAt: string;
}

export interface FeedbackEventRow extends RecommendationFeedback {
  id?: number;
}

export interface RecommendationBatchRow {
  id: string;
  value: RecommendationBatch;
  generatedAt: string;
}

export interface DiscoverEditionRow {
  editionDate: string;
  value: DiscoverEdition;
  expiresAt: string;
}

export interface TrackCacheRow {
  trackId: string;
  value: Track;
  fetchedAt: string;
}

export interface ExpiringCacheRow<T> {
  key: string;
  value: T;
  expiresAt: string;
  createdAt: string;
}

export interface AIDecisionRow {
  id?: number;
  kind: "planner" | "reranker" | "explanation";
  payload: unknown;
  createdAt: string;
}

export type FavoriteRow = FavoriteRecord;
export type LyricsCacheRow = ExpiringCacheRow<unknown>;
export type PlaybackCacheRow = ExpiringCacheRow<unknown>;
export type ProviderCacheRow = ExpiringCacheRow<unknown>;
