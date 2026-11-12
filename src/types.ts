import type { Engine } from "./engine";

export type ReactionKind = "good" | "bad";

export interface ReactionEvent {
  id: number;
  emoji: string;
  kind: ReactionKind;
  at: number;
}

export interface View {
  engine: Engine;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  dt: number;
  target: number;
  level: number;
  up: number;
  down: number;
  fever: boolean;
  rainbow: number;
  rainbowLeft: number;
  comboCount: number;
  reduced: boolean;
}

export interface MeterCopy {
  faces: string[];
  fever: string;
  feverName: string;
  feverOn: string;
  idle: string;
  low: string;
}

export interface ThemeInstance {
  filter?(view: View): string;
  frame?(view: View): void;
  onReaction?(view: View, event: ReactionEvent): void;
  onRainbowStart?(view: View): void;
}

export interface Theme {
  id: string;
  label: string;
  description: string;
  meter: MeterCopy;
  create(engine: Engine): ThemeInstance;
}

export type ParticleKind = "emoji" | "confetti" | "spark" | "text" | "custom";

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ax: number;
  ay: number;
  drag: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  alpha: number;
  fadeIn: number;
  fadeOut: number;
  sway: number;
  wobble?: number;
  pop?: boolean;
  sx?: number;
  sy?: number;
  emoji?: string;
  color?: string;
  w?: number;
  h?: number;
  spin?: number;
  text?: string;
  stroke?: string;
  tick?: (p: Particle, dt: number, view: View) => void;
  draw?: (ctx: CanvasRenderingContext2D, p: Particle, alpha: number, view: View) => void;
}

export type ParticleInit = Partial<Omit<Particle, "age">> & { kind: ParticleKind };
