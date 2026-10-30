import type {
  DiscoverEdition,
  ListeningIntent,
  RecommendationItem,
  Track,
} from "@resonara/contracts";

export const tracks: Record<string, Track> = {
  undefined: {
    id: "3451951517",
    provider: "netease",
    title: "Undefined",
    artist: "PerVade / 第五人格",
    artistIds: [],
    album: "Undefined",
    coverUrl:
      "https://p3.music.126.net/ccu6U_1qtxIIz5ReqhhQ0w==/109951174144800369.jpg?param=800y800",
    genre: "Electronic",
    energyLabel: "Mid-tempo",
    energy: 0.58,
    durationMs: 175915,
    playable: true,
  },
  tremolo: {
    id: "1959438783",
    provider: "netease",
    title: "Tremolo",
    artist: "Chilli Beans.",
    artistIds: ["49392892"],
    album: "Chilli Beans.",
    coverUrl:
      "https://p4.music.126.net/L8f07BDPoT_tAHqmTUgP5A==/109951167596576841.jpg?param=800y800",
    genre: "Alternative",
    energyLabel: "Melodic",
    energy: 0.64,
    durationMs: 213000,
    playable: false,
  },
  hypnagogia: {
    id: "3360273109",
    provider: "netease",
    title: "Hypnagogia",
    artist: "Polished Chrome",
    artistIds: [],
    album: "Music for Headphones",
    coverUrl:
      "https://p4.music.126.net/a5yJjjKgMIUUYlv1jhOT_w==/109951172902500934.jpg?param=800y800",
    genre: "Downtempo",
    energyLabel: "Soft focus",
    energy: 0.38,
    durationMs: 260000,
    playable: false,
  },
  madeleine: {
    id: "3451233414",
    provider: "netease",
    title: "madeleine",
    artist: "brakence",
    artistIds: [],
    album: "marroW",
    coverUrl:
      "https://p3.music.126.net/Y2lzBSno1hqVrQH34X9-Cg==/109951174137925091.jpg?param=800y800",
    genre: "Hyperpop",
    energyLabel: "Restless",
    energy: 0.72,
    durationMs: 201000,
    playable: false,
  },
};

export const recommendationItems: RecommendationItem[] = [
  {
    rank: 1,
    track: tracks.undefined!,
    confidence: 0.91,
    reason: {
      summary:
        "A layered electronic pulse that keeps the texture you enjoy without making a warm afternoon feel heavier.",
      personalFactor:
        "You often choose textured electronic music in the afternoon",
      contextFactor:
        "It feels warm and humid, so the energy stays comfortably in the middle",
    },
  },
  {
    rank: 2,
    track: tracks.tremolo!,
    confidence: 0.88,
    reason: {
      summary:
        "Clear melody and a little grit, with enough momentum to stay engaged and enough restraint to keep the room calm.",
      personalFactor:
        "Melodic music with a textured edge is a frequent choice for you",
      contextFactor:
        "The cloud cover keeps the afternoon visually even and unhurried",
    },
  },
  {
    rank: 3,
    track: tracks.hypnagogia!,
    confidence: 0.84,
    reason: {
      summary:
        "A softer close that lowers the temperature of the listening session without leaving your familiar electronic orbit.",
      personalFactor:
        "You often ease into softer textures as a listening session unfolds",
      contextFactor:
        "Low-end warmth and open space suit the humid afternoon",
    },
  },
];

export const discoverEdition: DiscoverEdition = {
  editionDate: "2026-10-30",
  generatedAt: "2026-10-30T00:00:00+08:00",
  expiresAt: "2026-10-31T00:00:00+08:00",
  cards: [
    {
      id: "3ee5fe53-252f-4baf-8399-6bfc20c74f98",
      trackId: tracks.tremolo!.id,
      coverUrl: tracks.tremolo!.coverUrl,
      title: "After the Rain, Softly",
      subtitle: "Rain · humid air · low light",
      presetIntent: "relax",
      contextLabel: "Rainy afternoon",
    },
    {
      id: "64244ff6-c434-4a8d-b1ae-228d64d53c74",
      trackId: tracks.madeleine!.id,
      coverUrl: tracks.madeleine!.coverUrl,
      title: "Heat That Moves",
      subtitle: "Heat · summer evening · open air",
      presetIntent: "energize",
      contextLabel: "Hot summer evening",
    },
    {
      id: "7faabeb7-401a-4d1d-a55e-4f3125e1ae8d",
      trackId: tracks.undefined!.id,
      coverUrl: tracks.undefined!.coverUrl,
      title: "Blue Hour, No Signal",
      subtitle: "Late night · city lights · alone",
      presetIntent: "comfort",
      contextLabel: "Midnight city",
    },
    {
      id: "a912fd68-f335-4058-a1e2-075d409dc9bd",
      trackId: tracks.hypnagogia!.id,
      coverUrl: tracks.hypnagogia!.coverUrl,
      title: "First Light, Unhurried",
      subtitle: "Early morning · soft light · slow start",
      presetIntent: "focus",
      contextLabel: "Quiet morning",
    },
  ],
};

export const intentMeta: Record<
  ListeningIntent,
  { label: string; description: string }
> = {
  feel_good: {
    label: "Feel Good",
    description: "Stay with the feeling",
  },
  energize: {
    label: "Energize",
    description: "Raise the pulse",
  },
  relax: {
    label: "Relax",
    description: "Slow the pressure",
  },
  focus: {
    label: "Focus",
    description: "Protect your attention",
  },
  comfort: {
    label: "Comfort",
    description: "Stay close",
  },
  surprise_me: {
    label: "Surprise Me",
    description: "Take a different turn",
  },
};
