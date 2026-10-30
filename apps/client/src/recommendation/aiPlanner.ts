import {
  aiPlannerResultSchema,
  type AIPlannerResult,
  type AppSettings,
  type FavoriteRecord,
  type ListeningContext,
  type ListeningIntent,
  type RecommendationFeedback,
  type TasteProfile,
} from "@resonara/contracts";
import { saveAIDecision } from "../db/repositories/aiDecisions";
import {
  isAIConfigured,
  requestAIJson,
  type AIJsonRequester,
} from "../services/ai/client";
import { buildLocalPlan } from "./localFallback";

type PlanInput = {
  profile: TasteProfile;
  favorites: FavoriteRecord[];
  context: ListeningContext;
  intent: ListeningIntent;
  recentEvents: RecommendationFeedback[];
};

type PlannerOptions = {
  requester?: AIJsonRequester;
  persistDecision?: (kind: "planner", payload: unknown) => Promise<void>;
};

export type RecommendationPlanOutcome = {
  plan: AIPlannerResult;
  aiUsed: boolean;
  fallbackReason: string | null;
};

export async function createRecommendationPlan(
  input: PlanInput,
  settings: AppSettings,
  options: PlannerOptions = {},
): Promise<RecommendationPlanOutcome> {
  const localPlan = buildLocalPlan(input);
  if (!isAIConfigured(settings)) {
    return {
      plan: localPlan,
      aiUsed: false,
      fallbackReason: "AI API key or endpoint is not configured.",
    };
  }

  const persist = options.persistDecision ?? saveAIDecision;
  try {
    const plan = await (options.requester ?? requestAIJson)(
      settings,
      {
        purpose: "planner",
        schema: aiPlannerResultSchema,
        systemPrompt:
          "You are a music discovery planner. Return JSON only. Use only the supplied favorites, profile, context, and feedback. Do not invent track IDs, credits, or URLs.",
        userPrompt: JSON.stringify({
          profile: input.profile,
          favorites: input.favorites.slice(0, 8).map((favorite) => ({
            trackId: favorite.trackId,
            title: favorite.track.title,
            artist: favorite.track.artist,
            genre: favorite.track.genre,
            enrichment: favorite.enrichment,
          })),
          context: input.context,
          intent: input.intent,
          recentEvents: input.recentEvents.slice(-20),
          requiredOutput: {
            searchQueries: "1-6 search phrases",
            artistDirections: "real artist names or empty",
            songDirections: "search phrases or empty",
            targetEnergy: "number from 0 to 1",
            targetIntent: input.intent,
            rationale: "short English explanation",
            contextSummary: "short English context summary",
            targetDimensions: {
              energy: "number from 0 to 1",
              familiarity: "number from 0 to 1",
              genres: "genres grounded in the input",
              languages: "languages grounded in the input",
            },
          },
        }),
      },
    );
    await persist("planner", {
      aiUsed: true,
      plan,
    });
    return { plan, aiUsed: true, fallbackReason: null };
  } catch (error) {
    const fallbackReason =
      error instanceof Error ? error.message : "AI planner failed.";
    await persist("planner", {
      aiUsed: false,
      fallbackReason,
      plan: localPlan,
    });
    return { plan: localPlan, aiUsed: false, fallbackReason };
  }
}
