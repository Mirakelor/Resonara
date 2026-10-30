import { z } from "zod";
import {
  candidateSourceSchema,
  listeningIntentSchema,
  trackSchema,
} from "./core";

export const candidateSchema = z.object({
  track: trackSchema,
  sources: z.array(candidateSourceSchema).min(1),
  seedTrackIds: z.array(z.string().min(1)),
  matchedDimensions: z.array(
    z.enum(["artist", "lyricist", "composer", "language", "genre"]),
  ),
  rawScore: z.number().finite().nullable(),
});

export const providerErrorSchema = z.object({
  code: z.enum([
    "network",
    "cors",
    "timeout",
    "http",
    "content_type",
    "schema",
    "configuration",
  ]),
  message: z.string().min(1),
  status: z.number().int().nullable(),
});

export type ProviderError = z.infer<typeof providerErrorSchema>;
export type ProviderResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ProviderError };

export const lyricsResponseSchema = z.object({
  originalLrc: z.string().nullable(),
  translationLrc: z.string().nullable(),
  richLyrics: z.unknown().nullable(),
  offsetMs: z.number().int(),
  hasLyrics: z.boolean(),
});

export const aiPlannerResultSchema = z.object({
  searchQueries: z.array(z.string().min(1)).min(1).max(12),
  artistDirections: z.array(z.string().min(1)).max(12),
  songDirections: z.array(z.string().min(1)).max(12),
  targetEnergy: z.number().min(0).max(1),
  targetIntent: listeningIntentSchema,
  rationale: z.string().min(1).max(500),
});

const aiRerankerItemSchema = z.object({
  trackId: z.string().min(1),
  score: z.number().min(0).max(1),
  reason: z.string().min(1).max(280),
});

export function createAIRerankerResultSchema(candidateTrackIds: string[]) {
  const allowedTrackIds = new Set(candidateTrackIds);

  return z
    .object({
      items: z.array(aiRerankerItemSchema).max(20),
    })
    .superRefine((result, context) => {
      result.items.forEach((item, index) => {
        if (!allowedTrackIds.has(item.trackId)) {
          context.addIssue({
            code: "custom",
            path: ["items", index, "trackId"],
            message: "AI returned a track ID outside the verified candidate pool",
          });
        }
      });
    });
}

export type Candidate = z.infer<typeof candidateSchema>;
export type LyricsResponse = z.infer<typeof lyricsResponseSchema>;
export type AIPlannerResult = z.infer<typeof aiPlannerResultSchema>;
