import {
  recommendationFeedbackSchema,
  type RecommendationFeedback,
} from "@resonara/contracts";
import { resonaraDb } from "../database";

export const LOCAL_FAVORITES_BATCH_ID =
  "00000000-0000-4000-8000-000000000001";

export async function recordFeedback(
  input: Pick<RecommendationFeedback, "trackId" | "event"> & {
    batchId?: string;
    positionMs?: number;
    occurredAt?: string;
  },
): Promise<RecommendationFeedback> {
  const feedback = recommendationFeedbackSchema.parse({
    batchId: input.batchId ?? LOCAL_FAVORITES_BATCH_ID,
    trackId: input.trackId,
    event: input.event,
    positionMs: input.positionMs ?? 0,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  });

  await resonaraDb.feedbackEvents.add(feedback);
  return feedback;
}

export async function listRecentFeedback(
  limit = 50,
): Promise<RecommendationFeedback[]> {
  return resonaraDb.feedbackEvents
    .orderBy("occurredAt")
    .reverse()
    .limit(limit)
    .toArray();
}
