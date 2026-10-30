import {
  discoverEditionSchema,
  type AppSettings,
  type DiscoverEdition,
  type ListeningContext,
  type ListeningIntent,
} from "@resonara/contracts";
import { z } from "zod";
import { saveDiscoverEdition } from "../../db/repositories/discover";
import type { VerifiedCandidate } from "../../recommendation/verifyPlayable";
import {
  isAIConfigured,
  requestAIJson,
  type AIJsonRequester,
} from "../../services/ai/client";

const TITLE_TEMPLATES = [
  "Soft Light in Motion",
  "A Window Left Open",
  "Colors After the Clouds",
  "Slow Signals, Warm Rooms",
  "A Different Evening",
  "Quiet Noise, Open Sky",
  "Small Hours, Wide Sound",
  "Unhurried City Lines",
];

const INTENTS: ListeningIntent[] = [
  "relax",
  "focus",
  "comfort",
  "energize",
];

function deterministicIndex(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function copySchema(trackIds: string[]) {
  return z
    .object({
      cards: z.array(
        z.object({
          trackId: z.string(),
          title: z.string().min(1).max(80),
          subtitle: z.string().min(1).max(100),
          contextLabel: z.string().min(1).max(100),
        }),
      ),
    })
    .superRefine((value, context) => {
      value.cards.forEach((card, index) => {
        if (!trackIds.includes(card.trackId)) {
          context.addIssue({
            code: "custom",
            path: ["cards", index, "trackId"],
            message: "Discover copy referenced a track outside the verified pool.",
          });
        }
      });
    });
}

type DiscoverCopy = z.infer<ReturnType<typeof copySchema>>;

function fallbackCopy(
  selected: VerifiedCandidate[],
  context: ListeningContext,
): DiscoverCopy {
  return {
    cards: selected.map((candidate, index) => ({
      trackId: candidate.track.id,
      title: TITLE_TEMPLATES[index]!,
      subtitle: `${candidate.track.genre !== "Unknown" ? candidate.track.genre : (candidate.track.album ?? "Song")} · verified anonymous playback`,
      contextLabel:
        context.weather?.condition.replaceAll("_", " ") ??
        "local listening moment",
    })),
  };
}

type GenerateOptions = {
  persist?: (edition: DiscoverEdition) => Promise<void>;
  requester?: AIJsonRequester;
};

export async function generateDailyEdition(
  input: {
    candidates: VerifiedCandidate[];
    settings: AppSettings;
    context: ListeningContext;
    editionDate: string;
    now?: Date;
  },
  options: GenerateOptions = {},
): Promise<DiscoverEdition> {
  const playable = input.candidates.filter(
    ({ track, playbackUrl }) => track.playable && Boolean(playbackUrl.trim()),
  );
  const selected = [...playable]
    .sort(
      (left, right) =>
        deterministicIndex(`${input.editionDate}:${left.track.id}`) -
        deterministicIndex(`${input.editionDate}:${right.track.id}`),
    )
    .slice(0, 4);
  if (selected.length < 4) {
    throw new Error("At least four anonymous playable tracks are required for Discover.");
  }

  let copy = fallbackCopy(selected, input.context);
  if (isAIConfigured(input.settings)) {
    try {
      copy = await (options.requester ?? requestAIJson)(
        input.settings,
        {
          purpose: "discover",
          schema: copySchema(selected.map(({ track }) => track.id)),
          systemPrompt:
            "Write concise English Discover card copy. Return JSON only. Use only supplied verified track IDs and metadata. Never invent songs, artists, places, weather, or URLs.",
          userPrompt: JSON.stringify({
            context: input.context,
            tracks: selected.map(({ track }) => ({
              trackId: track.id,
              title: track.title,
              artist: track.artist,
              genre:
                track.genre !== "Unknown"
                  ? track.genre
                  : (track.album ?? "Song"),
              energyLabel: track.energyLabel,
            })),
            requiredOutput: {
              cards: [
                {
                  trackId: "one of the supplied IDs",
                  title: "short English listening-world title",
                  subtitle: "short English detail",
                  contextLabel: "short English context label",
                },
              ],
            },
          }),
        },
      );
    } catch {
      copy = fallbackCopy(selected, input.context);
    }
  }

  const now = input.now ?? new Date();
  const expiry = new Date(`${input.editionDate}T00:00:00`);
  expiry.setDate(expiry.getDate() + 1);
  const copyById = new Map(copy.cards.map((card) => [card.trackId, card]));
  const edition = discoverEditionSchema.parse({
    editionDate: input.editionDate,
    timeZone: input.context.timeZone,
    generatedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    cards: selected.map((candidate, index) => {
      const generated = copyById.get(candidate.track.id);
      return {
        id: crypto.randomUUID(),
        trackId: candidate.track.id,
        coverUrl: candidate.track.coverUrl,
        title: generated?.title ?? TITLE_TEMPLATES[index]!,
        subtitle:
          generated?.subtitle ??
          `${candidate.track.genre} · verified anonymous playback`,
        presetIntent: INTENTS[index]!,
        contextLabel:
          generated?.contextLabel ??
          input.context.weather?.condition.replaceAll("_", " ") ??
          "Local listening moment",
      };
    }),
  });

  await (options.persist ?? saveDiscoverEdition)(edition);
  return edition;
}
