import type {
  AIPlannerResult,
  ListeningContext,
  RecommendationReason,
} from "@resonara/contracts";
import type { VerifiedCandidate } from "./verifyPlayable";

function personalSource(candidate: VerifiedCandidate): string {
  if (candidate.sources.includes("favorite_similarity")) {
    return `It follows the sound of music you saved from ${candidate.track.artist}.`;
  }
  if (
    candidate.sources.some((source) =>
      ["same_artist", "same_lyricist", "same_composer"].includes(source),
    )
  ) {
    return `It shares verified creator signals with ${candidate.track.artist}.`;
  }
  if (
    candidate.sources.some((source) =>
      ["same_language", "same_genre"].includes(source),
    )
  ) {
    return "It stays close to a verified language or genre dimension in your taste.";
  }
  return "It adds a new direction while staying inside the verified candidate pool.";
}

export function writeRecommendationExplanations(input: {
  plan: AIPlannerResult;
  candidates: VerifiedCandidate[];
  context: ListeningContext;
}): RecommendationReason[] {
  const contextLabel =
    input.context.weather?.condition.replaceAll("_", " ") ??
    "your local time";

  return input.candidates.map((candidate) => ({
    summary: `${candidate.track.title} by ${candidate.track.artist} brings ${candidate.track.energyLabel.toLowerCase()} energy into this ${input.plan.targetIntent.replaceAll("_", " ")} set.`,
    personalFactor: personalSource(candidate),
    contextFactor: `The ${contextLabel} context and ${input.plan.targetIntent.replaceAll("_", " ")} intent shaped its position.`,
  }));
}
