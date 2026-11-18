export type Chapter = {
  id: "voice" | "screen" | "sound";
  eyebrow: string;
  headline: string;
  body: string;
  cta: { label: string; href: string };
};

export const CHAPTERS: Chapter[] = [
  {
    id: "voice",
    eyebrow: "ACCESSIBILITY",
    headline: "A computer that listens.",
    body: "Speak naturally and VoxLayer does the rest — Excel, email, browsers, code. No screen, no keyboard, no shortcuts to memorise.",
    cta: { label: "See how it works", href: "#how-it-works" },
  },
  {
    id: "screen",
    eyebrow: "TRAINED BY USERS",
    headline: "Built with the people who use it.",
    body: "VoxLayer learns from blind, low-vision and motor-impaired users every day — their speech, their corrections, their workflows. Opt-in and private by design.",
    cta: { label: "Our approach", href: "#audiences" },
  },
  {
    id: "sound",
    eyebrow: "SOUND",
    headline: "Every action has a sound.",
    body: "Distinct tones for success, error and navigation, plus a spoken readout of what changed. You always know what happened — without seeing it.",
    cta: { label: "Hear the sounds", href: "#how-it-works" },
  },
];
