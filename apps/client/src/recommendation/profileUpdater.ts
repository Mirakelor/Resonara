import type {
  Affinity,
  ListeningContext,
  TasteProfile,
  Track,
  TrackEnrichment,
} from "@resonara/contracts";

type ProfileEvent =
  | "liked"
  | "unliked"
  | "play_started"
  | "play_completed"
  | "skipped_early"
  | "disliked"
  | "batch_fit"
  | "batch_miss"
  | "refresh_requested";

type ProfileUpdate = {
  event: ProfileEvent;
  track?: Track;
  enrichment?: TrackEnrichment;
  context?: ListeningContext;
  positionMs?: number;
};

export function createDefaultProfile(
  now = new Date(),
): TasteProfile {
  return {
    version: 1,
    updatedAt: now.toISOString(),
    topGenres: [],
    topArtists: [],
    energyPreference: 0.5,
    familiarityPreference: 0.5,
    contextAffinities: [],
    trackAffinities: [],
    artistAffinities: [],
    creditAffinities: [],
    languageAffinities: [],
    genreAffinities: [],
  };
}

function decayAffinities(
  affinities: Affinity[],
  now: Date,
): Affinity[] {
  return affinities
    .map((affinity) => {
      const ageDays =
        (now.getTime() - new Date(affinity.updatedAt).getTime()) /
        86_400_000;
      const decayed = affinity.weight * Math.exp(-Math.max(0, ageDays) / 45);
      return {
        ...affinity,
        weight: Math.max(-1, Math.min(1, decayed)),
      };
    })
    .filter(({ weight }) => Math.abs(weight) >= 0.001);
}

function addWeights(
  existing: Affinity[],
  weights: Array<[string, number]>,
  now: Date,
): Affinity[] {
  const byKey = new Map(
    decayAffinities(existing, now).map((affinity) => [
      affinity.key,
      affinity,
    ]),
  );

  for (const [key, delta] of weights) {
    if (!key) continue;
    const current = byKey.get(key);
    byKey.set(key, {
      key,
      updatedAt: now.toISOString(),
      weight: Math.max(-1, Math.min(1, (current?.weight ?? 0) + delta)),
    });
  }

  return [...byKey.values()].sort(
    (left, right) => right.weight - left.weight,
  );
}

function timeBucket(localTime: string) {
  const hour = new Date(localTime).getHours();
  if (hour < 6) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function addContextAffinity(
  profile: TasteProfile,
  context: ListeningContext,
  delta: number,
  now: Date,
): TasteProfile["contextAffinities"] {
  const dimensions: Array<{
    dimension: TasteProfile["contextAffinities"][number]["dimension"];
    value: string;
  }> = [
    { dimension: "time", value: timeBucket(context.localTime) },
    {
      dimension: "temperature",
      value:
        context.weather &&
        context.weather.apparentTemperatureC >= 26
          ? "warm"
          : context.weather &&
              context.weather.apparentTemperatureC <= 10
            ? "cold"
            : "mild",
    },
    {
      dimension: "humidity",
      value: String(
        Math.round(context.weather?.relativeHumidity ?? 50),
      ),
    },
    {
      dimension: "weather",
      value: context.weather?.condition ?? "unknown",
    },
  ];

  const byKey = new Map(
    profile.contextAffinities.map((affinity) => [
      `${affinity.dimension}:${affinity.value}`,
      affinity,
    ]),
  );
  for (const entry of dimensions) {
    const key = `${entry.dimension}:${entry.value}`;
    const existing = byKey.get(key);
    byKey.set(key, {
      ...entry,
      weight: Math.max(
        -1,
        Math.min(1, (existing?.weight ?? 0) + delta),
      ),
      confidence: Math.min(1, (existing?.confidence ?? 0) + 0.08),
    });
  }

  return [...byKey.values()].slice(-100);
}

export function applyProfileUpdate(
  current: TasteProfile,
  update: ProfileUpdate,
  now = new Date(),
): TasteProfile {
  const profile: TasteProfile = {
    ...createDefaultProfile(now),
    ...current,
    trackAffinities: current.trackAffinities ?? [],
    artistAffinities: current.artistAffinities ?? [],
    creditAffinities: current.creditAffinities ?? [],
    languageAffinities: current.languageAffinities ?? [],
    genreAffinities: current.genreAffinities ?? [],
  };
  const track = update.track;
  const enrichment = update.enrichment;
  const genres = [
    ...(track ? [track.genre] : []),
    ...(enrichment?.genreTags ?? []),
  ];
  const credits = [
    ...(enrichment?.credits.lyricists.map(
      (name) => `lyricist:${name}`,
    ) ?? []),
    ...(enrichment?.credits.composers.map(
      (name) => `composer:${name}`,
    ) ?? []),
  ];

  const strengths: Record<
    Exclude<ProfileEvent, "batch_fit" | "batch_miss" | "refresh_requested">,
    number
  > = {
    liked: 0.8,
    unliked: -0.3,
    play_started: 0.12,
    play_completed: 0.35,
    skipped_early: -0.15,
    disliked: -0.7,
  };
  const strength =
    update.event in strengths
      ? strengths[
          update.event as keyof typeof strengths
        ]
      : 0;
  let contextAffinities = profile.contextAffinities;

  if (update.event === "batch_fit" && update.context) {
    contextAffinities = addContextAffinity(
      profile,
      update.context,
      0.18,
      now,
    );
  } else if (update.event === "batch_miss" && update.context) {
    contextAffinities = addContextAffinity(
      profile,
      update.context,
      -0.12,
      now,
    );
  } else if (update.event === "refresh_requested" && update.context) {
    contextAffinities = addContextAffinity(
      profile,
      update.context,
      -0.04,
      now,
    );
  }

  const hasTrackSignal = Boolean(track && strength !== 0);
  const trackAffinities = hasTrackSignal && track
    ? addWeights(
        profile.trackAffinities ?? [],
        [[track.id, strength]],
        now,
      )
    : decayAffinities(profile.trackAffinities ?? [], now);
  const artistAffinities = hasTrackSignal && track
    ? addWeights(
        profile.artistAffinities ?? [],
        [[track.artist, strength * 0.82]],
        now,
      )
    : decayAffinities(profile.artistAffinities ?? [], now);
  const creditAffinities = hasTrackSignal && track
    ? addWeights(
        profile.creditAffinities ?? [],
        credits.map((key) => [key, strength * 0.62] as [string, number]),
        now,
      )
    : decayAffinities(profile.creditAffinities ?? [], now);
  const languageAffinities = hasTrackSignal && track
    ? addWeights(
        profile.languageAffinities ?? [],
        enrichment?.language
          ? [[enrichment.language, strength * 0.64]]
          : [],
        now,
      )
    : decayAffinities(profile.languageAffinities ?? [], now);
  const genreAffinities = hasTrackSignal && track
    ? addWeights(
        profile.genreAffinities ?? [],
        genres.map((key) => [key, strength * 0.7] as [string, number]),
        now,
      )
    : decayAffinities(profile.genreAffinities ?? [], now);
  const topGenres = genreAffinities
    .filter(({ weight }) => weight > 0)
    .slice(0, 20)
    .map(({ key }) => key);
  const topArtists = artistAffinities
    .filter(({ weight }) => weight > 0)
    .slice(0, 30)
    .map(({ key }) => key);

  return {
    ...profile,
    version: (profile.version ?? 1) + 1,
    updatedAt: now.toISOString(),
    topGenres,
    topArtists,
    contextAffinities,
    trackAffinities,
    artistAffinities,
    creditAffinities,
    languageAffinities,
    genreAffinities,
  };
}
