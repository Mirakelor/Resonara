import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  EnvironmentMode,
  ListeningContext,
} from "@resonara/contracts";
import {
  createBaseContext,
  resolveDeviceContext,
} from "../../services/weather/openMeteo";

export function useListeningContext(environmentMode: EnvironmentMode) {
  const [context, setContext] = useState<ListeningContext>(() =>
    createBaseContext(),
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (environmentMode === "ignore_environment") {
      setContext(createBaseContext());
      return createBaseContext();
    }

    setLoading(true);
    try {
      const next = await resolveDeviceContext({
        geolocation:
          typeof navigator === "undefined" ? undefined : navigator.geolocation,
      });
      setContext(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [environmentMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const recommendationContext = useMemo(
    () =>
      environmentMode === "ignore_environment"
        ? { ...context, weather: null, weatherSource: "unavailable" as const }
        : context,
    [context, environmentMode],
  );

  return {
    context,
    recommendationContext,
    loading,
    refresh,
  };
}
