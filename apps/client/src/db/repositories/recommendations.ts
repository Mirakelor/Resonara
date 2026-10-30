import type { RecommendationBatch } from "@resonara/contracts";
import { resonaraDb } from "../database";

export async function saveRecommendationBatch(
  batch: RecommendationBatch,
): Promise<void> {
  await resonaraDb.recommendationBatches.put({
    id: batch.id,
    value: batch,
    generatedAt: batch.generatedAt,
  });
}

export async function getRecommendationBatch(
  id: string,
): Promise<RecommendationBatch | null> {
  const row = await resonaraDb.recommendationBatches.get(id);
  return row?.value ?? null;
}

export async function getLatestRecommendationBatch(): Promise<RecommendationBatch | null> {
  const row = await resonaraDb.recommendationBatches
    .orderBy("generatedAt")
    .last();
  return row?.value ?? null;
}
