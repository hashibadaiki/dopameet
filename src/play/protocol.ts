import type { Call, Mood, Settings } from "../mood";

export const BACKGROUNDS = {
  slide: "スライド",
  white: "白",
  black: "黒",
  colorful: "カラフル",
} as const;

export type Background = keyof typeof BACKGROUNDS;

export interface PlayState {
  settings: Settings;
  call: Call;
  mood: Mood;
  background: Background;
}

export const READY = "dopameet:ready";
