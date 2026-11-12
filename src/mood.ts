import type { ReactionEvent, ReactionKind } from "./types";

export const LIMIT = 100;
export const CALL_TTL_MS = 150_000;
const MAX_EVENTS = 12;
const GOOD = new Set(["💖", "❤", "👍", "🎉", "👏", "😂", "😮"]);
const BAD = new Set(["👎"]);

export interface Tuning {
  halfLifeMs: number;
  sinkPerSec: number;
  goodStep: number;
  badStep: number;
  rainbowAt: number;
}

export const DEFAULT_TUNING: Readonly<Tuning> = {
  halfLifeMs: 25_000,
  sinkPerSec: 1,
  goodStep: 8,
  badStep: 12,
  rainbowAt: 85,
};

export const tuning: Tuning = { ...DEFAULT_TUNING };

export const setTuning = (next: Tuning) => {
  Object.assign(tuning, next);
};

export interface Mood {
  score: number;
  at: number;
  sinking: boolean;
  paused: boolean;
  events: ReactionEvent[];
  seq: number;
}

export type MeterMode = "call" | "always" | "off";

export interface Settings {
  enabled: boolean;
  meter: MeterMode;
}

export interface Call {
  at: number;
}

export const normalize = (text: string) =>
  text.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, "").trim();

export const classify = (text: string): ReactionKind | null => {
  const emoji = normalize(text);
  if (GOOD.has(emoji)) return "good";
  if (BAD.has(emoji)) return "bad";
  return null;
};

const clamp = (value: number) => Math.max(-LIMIT, Math.min(LIMIT, value));

export const scoreAt = (mood: Mood, now: number) => {
  if (mood.paused) return mood.score;
  const elapsed = Math.max(0, now - mood.at);
  if (mood.sinking) return clamp(mood.score - (tuning.sinkPerSec * elapsed) / 1000);
  return mood.score * 0.5 ** (elapsed / tuning.halfLifeMs);
};

export const isRainbow = (score: number) => score >= tuning.rainbowAt;

export const initialMood = (): Mood => ({
  score: 0,
  at: 0,
  sinking: false,
  paused: false,
  events: [],
  seq: 0,
});

export const restart = (mood: Mood, sinking: boolean, now: number): Mood =>
  mood.paused
    ? { ...mood, sinking }
    : { ...initialMood(), seq: mood.seq, at: now, sinking };

export const pause = (mood: Mood, now: number): Mood =>
  mood.paused ? mood : { ...mood, score: scoreAt(mood, now), at: now, paused: true };

export const resume = (mood: Mood, now: number): Mood =>
  mood.paused ? { ...mood, at: now, paused: false } : mood;

export const setSinking = (mood: Mood, sinking: boolean, now: number): Mood => ({
  ...mood,
  score: scoreAt(mood, now),
  at: now,
  sinking,
});

export const react = (
  mood: Mood,
  emoji: string,
  kind: ReactionKind,
  now: number,
): Mood => {
  if (mood.paused) return mood;
  const seq = mood.seq + 1;
  const events = [...mood.events, { id: seq, emoji, kind, at: now }].slice(
    -MAX_EVENTS,
  );
  const current = scoreAt(mood, now);
  if (kind === "bad") {
    return { ...mood, score: clamp(current - tuning.badStep), at: now, seq, events };
  }
  return { ...mood, score: clamp(current + tuning.goodStep), at: now, seq, events };
};

export const defaultSettings = (): Settings => ({
  enabled: true,
  meter: "call",
});

export interface Store<T> {
  read(): Promise<T>;
  update(change: (current: T) => T): Promise<void>;
  subscribe(listener: (value: T) => void): void;
}

const store = <T extends object>(key: string, initial: () => T): Store<T> => {
  const merge = (stored: unknown): T => ({
    ...initial(),
    ...(stored as Partial<T> | undefined),
  });

  const read = async () => merge((await chrome.storage.local.get(key))[key]);

  let queue: Promise<void> = Promise.resolve();
  const update = (change: (current: T) => T) => {
    queue = queue
      .then(async () => chrome.storage.local.set({ [key]: change(await read()) }))
      .catch((error: unknown) => console.warn("[dopameet]", error));
    return queue;
  };

  const subscribe = (listener: (value: T) => void) => {
    chrome.storage.onChanged.addListener((changes, area) => {
      const change = changes[key];
      if (area === "local" && change) listener(merge(change.newValue));
    });
    void read().then(listener);
  };

  return { read, update, subscribe };
};

export const moodStore = store("mood", initialMood);
export const settingsStore = store("settings", defaultSettings);
export const callStore = store<Call>("call", () => ({ at: 0 }));
