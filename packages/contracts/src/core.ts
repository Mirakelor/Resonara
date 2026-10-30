import { z } from "zod";

export const candidateSourceSchema = z.enum([
  "favorite_similarity",
  "ai_context_search",
  "same_artist",
  "same_lyricist",
  "same_composer",
  "same_language",
  "same_genre",
  "ai_song_expansion",
  "ai_artist_expansion",
  "recommend_songs",
  "personalized_newsong",
]);

export const listeningIntentSchema = z.enum([
  "feel_good",
  "energize",
  "relax",
  "focus",
  "comfort",
  "surprise_me",
]);

export const environmentModeSchema = z
  .enum(["use_current", "ignore_environment"])
  .default("use_current");

export const weatherConditionSchema = z.enum([
  "clear",
  "partly_cloudy",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
  "unknown",
]);

export const weatherSnapshotSchema = z.object({
  temperatureC: z.number().finite(),
  apparentTemperatureC: z.number().finite(),
  relativeHumidity: z.number().min(0).max(100),
  condition: weatherConditionSchema,
  isDay: z.boolean(),
  observedAt: z.iso.datetime({ offset: true }),
});

export const listeningContextSchema = z.object({
  localTime: z.iso.datetime({ offset: true }),
  timeZone: z.string().min(1),
  city: z.string().min(1).max(120).nullable(),
  weather: weatherSnapshotSchema.nullable(),
  weatherSource: z.enum(["device", "manual_city", "unavailable"]),
});

export const trackSchema = z.object({
  id: z.string().min(1),
  provider: z.literal("netease"),
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().nullable(),
  coverUrl: z.url(),
  genre: z.string().min(1),
  energyLabel: z.string().min(1),
  energy: z.number().min(0).max(1),
  durationMs: z.number().int().positive(),
  playable: z.boolean(),
});

export const recommendationReasonSchema = z.object({
  summary: z.string().min(1).max(280),
  personalFactor: z.string().min(1).max(160),
  contextFactor: z.string().min(1).max(160),
});

export const recommendationItemSchema = z.object({
  rank: z.number().int().min(1).max(5),
  track: trackSchema,
  reason: recommendationReasonSchema,
  confidence: z.number().min(0).max(1),
  source: candidateSourceSchema.optional(),
  seedTrackId: z.string().min(1).optional(),
});

export const recommendationRequestSchema = z.object({
  sessionId: z.uuid(),
  intent: listeningIntentSchema.nullable(),
  environmentMode: environmentModeSchema,
  context: listeningContextSchema,
  excludedTrackIds: z.array(z.string().min(1)).max(50).default([]),
  limit: z.number().int().min(3).max(5).default(3),
  seedTrackId: z.string().min(1).optional(),
  source: candidateSourceSchema.optional(),
});

export const recommendationBatchSchema = z
  .object({
    id: z.uuid(),
    generatedAt: z.iso.datetime({ offset: true }),
    intent: listeningIntentSchema.nullable(),
    environmentMode: environmentModeSchema,
    context: listeningContextSchema,
    items: z.array(recommendationItemSchema).min(1).max(5),
    featuredTrackId: z.string().min(1),
  })
  .superRefine((batch, context) => {
    if (!batch.items.some((item) => item.track.id === batch.featuredTrackId)) {
      context.addIssue({
        code: "custom",
        path: ["featuredTrackId"],
        message: "featuredTrackId must match a recommendation item",
      });
    }
  });

export const discoverCardSchema = z.object({
  id: z.uuid(),
  trackId: z.string().min(1),
  coverUrl: z.url(),
  title: z.string().min(1).max(80),
  subtitle: z.string().min(1).max(100),
  presetIntent: listeningIntentSchema,
  contextLabel: z.string().min(1).max(100),
});

export const discoverEditionSchema = z.object({
  editionDate: z.iso.date(),
  generatedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  cards: z.array(discoverCardSchema).length(4),
});

export const feedbackEventSchema = z.enum([
  "batch_fit",
  "batch_miss",
  "refresh_requested",
  "play_started",
  "play_completed",
  "skipped_early",
  "liked",
  "unliked",
  "disliked",
]);

export const recommendationFeedbackSchema = z.object({
  batchId: z.uuid(),
  trackId: z.string().min(1).nullable(),
  event: feedbackEventSchema,
  positionMs: z.number().int().min(0),
  occurredAt: z.iso.datetime({ offset: true }),
});

export const contextAffinitySchema = z.object({
  dimension: z.enum(["time", "weather", "humidity", "temperature", "season"]),
  value: z.string().min(1),
  weight: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
});

export const tasteProfileSchema = z.object({
  updatedAt: z.iso.datetime({ offset: true }),
  topGenres: z.array(z.string().min(1)).max(20),
  topArtists: z.array(z.string().min(1)).max(30),
  energyPreference: z.number().min(0).max(1),
  familiarityPreference: z.number().min(0).max(1),
  contextAffinities: z.array(contextAffinitySchema).max(100),
});

export const playbackResolutionSchema = z.object({
  trackId: z.string().min(1),
  url: z.url().nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  level: z.enum(["standard", "higher", "exhigh", "lossless"]),
  playable: z.boolean(),
  unavailableReason: z.string().nullable(),
});

export type CandidateSource = z.infer<typeof candidateSourceSchema>;
export type ListeningIntent = z.infer<typeof listeningIntentSchema>;
export type EnvironmentMode = z.infer<typeof environmentModeSchema>;
export type WeatherCondition = z.infer<typeof weatherConditionSchema>;
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export type ListeningContext = z.infer<typeof listeningContextSchema>;
export type Track = z.infer<typeof trackSchema>;
export type RecommendationReason = z.infer<typeof recommendationReasonSchema>;
export type RecommendationItem = z.infer<typeof recommendationItemSchema>;
export type RecommendationRequest = z.infer<
  typeof recommendationRequestSchema
>;
export type RecommendationBatch = z.infer<typeof recommendationBatchSchema>;
export type DiscoverCard = z.infer<typeof discoverCardSchema>;
export type DiscoverEdition = z.infer<typeof discoverEditionSchema>;
export type RecommendationFeedback = z.infer<
  typeof recommendationFeedbackSchema
>;
export type TasteProfile = z.infer<typeof tasteProfileSchema>;
export type PlaybackResolution = z.infer<typeof playbackResolutionSchema>;
