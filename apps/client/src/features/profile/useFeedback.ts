import { useCallback, useMemo } from "react";
import type {
  ListeningContext,
  RecommendationFeedback,
  Track,
  TrackEnrichment,
} from "@resonara/contracts";
import { recordFeedback } from "../../db/repositories/feedback";
import {
  getProfile,
  saveProfile,
} from "../../db/repositories/profile";
import {
  applyProfileUpdate,
  createDefaultProfile,
} from "../../recommendation/profileUpdater";

export function useFeedback(context: ListeningContext) {
  const record = useCallback(
    async (input: {
      event: RecommendationFeedback["event"];
      track?: Track;
      enrichment?: TrackEnrichment;
      positionMs?: number;
    }) => {
      if (input.track) {
        await recordFeedback({
          trackId: input.track.id,
          event: input.event,
          positionMs: input.positionMs,
        });
      }
      const profile =
        (await getProfile()) ?? createDefaultProfile();
      const updated = applyProfileUpdate(profile, {
        event: input.event,
        track: input.track,
        enrichment: input.enrichment,
        context,
        positionMs: input.positionMs,
      });
      await saveProfile(updated);
      return updated;
    },
    [context],
  );

  return useMemo(() => ({ record }), [record]);
}
