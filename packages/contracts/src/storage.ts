import { z } from "zod";
import { trackSchema } from "./core";

export const trackCreditsSchema = z.object({
  lyricists: z.array(z.string().min(1)),
  composers: z.array(z.string().min(1)),
  arrangers: z.array(z.string().min(1)),
});

export const trackEnrichmentSchema = z.object({
  credits: trackCreditsSchema,
  genreTags: z.array(z.string().min(1)),
  recommendationTags: z.array(z.string().min(1)),
  language: z.string().min(1).nullable(),
  instrumental: z.boolean(),
  bpm: z.number().positive().nullable(),
});

export const favoriteRecordSchema = z.object({
  trackId: z.string().min(1),
  track: trackSchema,
  enrichment: trackEnrichmentSchema.optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  lastVerifiedAt: z.iso.datetime({ offset: true }),
});

export const appSettingsSchema = z.object({
  musicApiBaseUrl: z
    .url()
    .refine((value) => ["http:", "https:"].includes(new URL(value).protocol), {
      message: "Music API Base URL must use http or https",
    }),
  musicApiToken: z.string(),
  aiBaseUrl: z.string(),
  aiApiKey: z.string(),
  aiModel: z.string(),
});

export type TrackCredits = z.infer<typeof trackCreditsSchema>;
export type TrackEnrichment = z.infer<typeof trackEnrichmentSchema>;
export type FavoriteRecord = z.infer<typeof favoriteRecordSchema>;
export type AppSettings = z.infer<typeof appSettingsSchema>;
