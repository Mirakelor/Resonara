import { resonaraDb } from "../database";

export type AIDecisionKind = "planner" | "reranker" | "explanation";

export async function saveAIDecision(
  kind: AIDecisionKind,
  payload: unknown,
): Promise<void> {
  await resonaraDb.aiDecisions.add({
    kind,
    payload,
    createdAt: new Date().toISOString(),
  });
}
