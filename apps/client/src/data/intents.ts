import type { ListeningIntent } from "@resonara/contracts";

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
