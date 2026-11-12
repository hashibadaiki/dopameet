import { EMOJI_FONT, banner, clamp01, rand, rgba, vignette } from "./fx";
import { Meter } from "./meter";
import {
  LIMIT,
  initialMood,
  recentGood,
  scoreAt,
  tuning,
  type Mood,
} from "./mood";
import type {
  Particle,
  ParticleInit,
  ReactionEvent,
  Theme,
  ThemeInstance,
  View,
} from "./types";

const MAX_PARTICLES = 700;

interface Spring {
  x: number;
  v: number;
}

interface Flash {
  color: string;
  alpha: number;
  edge: boolean;
  decay: number;
}

const springTo = (s: Spring, to: number, dt: number, stiffness: number, damping: number) => {
  s.v += (stiffness * (to - s.x) - damping * s.v) * dt;
  s.x += s.v * dt;
};

const easeOutBack = (t: number) => {
  const c = 2.2;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

const context2d = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return ctx;
};

export class Engine {
  readonly canvas = document.createElement("canvas");
  readonly ctx = context2d(this.canvas);
  readonly scratch = document.createElement("canvas");
  readonly sctx = context2d(this.scratch);
  readonly meter: Meter;
  readonly reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  w = 0;
  h = 0;
  dpr = 1;
  running = false;
  onSleep: () => void = () => {};

  private readonly filterLayer = document.createElement("div");
  private mood: Mood = initialMood();
  private theme: Theme | null = null;
  private state: ThemeInstance = {};
  private particles: Particle[] = [];
  private flashes: Flash[] = [];
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly level: Spring = { x: 0, v: 0 };
  private readonly rainbow: Spring = { x: 0, v: 0 };
  private time = 0;
  private last = 0;
  private filter = "";

  constructor(root: ShadowRoot) {
    this.filterLayer.className = "filter";
    root.append(this.filterLayer, this.canvas);
    this.meter = new Meter(root);
    addEventListener("resize", () => this.resize());
  }

  setTheme(theme: Theme) {
    if (this.theme?.id === theme.id) return;
    this.theme = theme;
    this.particles = [];
    this.flashes = [];
    this.resize();
    this.state = theme.create(this);
    this.meter.setTheme(theme);
    this.meter.update(this.step(0));
    this.wake();
  }

  setMood(mood: Mood) {
    this.mood = mood;
    if (this.theme && !this.running) this.meter.update(this.step(0));
  }

  amount(count: number) {
    return Math.max(1, Math.round(count * (this.reduced ? 0.3 : 1)));
  }

  spawn(init: ParticleInit) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push({
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ax: 0,
      ay: 0,
      drag: 0,
      life: 1,
      size: 32,
      rot: 0,
      vr: 0,
      alpha: 1,
      fadeIn: 0.08,
      fadeOut: 0.4,
      sway: 40,
      ...init,
      age: 0,
    });
    this.wake();
  }

  flash(color: string, alpha: number, { edge = false, decay = 4 } = {}) {
    this.flashes.push({ color, alpha, edge, decay });
    this.wake();
  }

  wake() {
    if (this.running || !this.theme) return;
    this.running = true;
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.particles = [];
    this.flashes = [];
    if (this.running) this.sleep();
  }

  reaction(event: ReactionEvent) {
    if (!this.theme) return;
    this.wake();
    const view = this.step(0);
    this.meter.bump(event);
    const origin = this.meter.origin();
    if (origin) {
      this.spawn({
        kind: "emoji",
        emoji: event.emoji,
        x: origin.x,
        y: origin.y,
        vx: rand(-50, 50),
        vy: -220,
        drag: 1.4,
        size: 36,
        life: 1.2,
        pop: true,
        fadeOut: 0.5,
      });
    }
    this.state.onReaction?.(view, event);
  }

  rainbowStart() {
    if (!this.theme) return;
    this.wake();
    this.state.onRainbowStart?.(this.step(0));
  }

  private resize() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = innerWidth;
    const h = innerHeight;
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    for (const canvas of [this.canvas, this.scratch]) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    this.sprites.clear();
  }

  private step(dt: number): View {
    const now = Date.now();
    const target = scoreAt(this.mood, now) / LIMIT;
    const fever = now < this.mood.rainbowUntil;
    springTo(this.level, target, dt, 120, 14);
    springTo(this.rainbow, fever ? 1 : 0, dt, 40, 12.6);
    const level = Math.max(-1, Math.min(1, this.level.x));
    return {
      engine: this,
      ctx: this.ctx,
      w: this.w,
      h: this.h,
      t: this.time,
      dt,
      target,
      level,
      up: Math.max(0, level),
      down: Math.max(0, -level),
      fever,
      rainbow: clamp01(this.rainbow.x),
      rainbowLeft: fever ? clamp01((this.mood.rainbowUntil - now) / tuning.rainbowMs) : 0,
      comboCount: Math.min(tuning.rainbowCount - 1, recentGood(this.mood, now).length),
      reduced: this.reduced,
    };
  }

  private readonly tick = (now: number) => {
    if (!this.running) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    const view = this.step(dt);
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.state.frame?.(view);
    this.drawParticles(view);
    this.drawFlashes(view);
    this.applyFilter(this.state.filter?.(view) ?? "");
    this.meter.update(view);
    if (this.isIdle(view)) {
      this.sleep();
      return;
    }
    requestAnimationFrame(this.tick);
  };

  private isIdle(view: View) {
    const still = (value: number) => Math.abs(value) < 0.003;
    return (
      this.particles.length === 0 &&
      this.flashes.length === 0 &&
      still(this.level.x) &&
      still(this.level.v) &&
      still(view.target) &&
      still(this.rainbow.x) &&
      !view.fever
    );
  }

  private sleep() {
    this.running = false;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyFilter("");
    this.onSleep();
  }

  private applyFilter(value: string) {
    if (value === this.filter) return;
    this.filter = value;
    this.filterLayer.style.backdropFilter = value || "none";
  }

  private sprite(emoji: string, size: number) {
    const bucket = Math.max(8, Math.round(size / 8) * 8);
    const key = `${emoji}|${bucket}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const px = Math.ceil(bucket * 1.3 * this.dpr);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const g = context2d(canvas);
    g.font = `${Math.round(px * 0.76)}px ${EMOJI_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, px / 2, px / 2 + px * 0.05);
    if (this.sprites.size > 160) this.sprites.clear();
    this.sprites.set(key, canvas);
    return canvas;
  }

  private glow(color: string) {
    const key = `glow|${color}`;
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = context2d(canvas);
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, rgba(color, 1));
    gradient.addColorStop(1, rgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(key, canvas);
    return canvas;
  }

  private drawParticles(view: View) {
    const { ctx, dt } = view;
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.tick?.(p, dt, view);
      const damping = Math.exp(-p.drag * dt);
      p.vx = (p.vx + p.ax * dt) * damping;
      p.vy = (p.vy + p.ay * dt) * damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.wobble) p.x += Math.cos(p.age * p.wobble * Math.PI * 2) * p.sway * dt;
      const alpha =
        p.alpha * Math.min(1, p.age / p.fadeIn) * Math.min(1, (p.life - p.age) / p.fadeOut);
      if (alpha > 0.003) this.drawParticle(ctx, p, alpha, view);
      alive.push(p);
    }
    this.particles = alive;
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number, view: View) {
    if (p.kind === "custom") {
      p.draw?.(ctx, p, alpha, view);
      return;
    }
    const pop = p.pop && p.age < 0.4 ? easeOutBack(p.age / 0.4) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === "emoji" && p.emoji) {
      ctx.scale(pop * (p.sx ?? 1), pop * (p.sy ?? 1));
      const s = p.size * 1.3;
      ctx.drawImage(this.sprite(p.emoji, p.size), -s / 2, -s / 2, s, s);
    } else if (p.kind === "confetti") {
      const w = p.w ?? 8;
      const h = p.h ?? 14;
      ctx.scale(1, Math.cos(p.age * (p.spin ?? 10)));
      ctx.fillStyle = p.color ?? "#ffffff";
      ctx.fillRect(-w / 2, -h / 2, w, h);
    } else if (p.kind === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.glow(p.color ?? "#ffffff"), -p.size / 2, -p.size / 2, p.size, p.size);
    } else if (p.kind === "text" && p.text) {
      ctx.scale(pop, pop);
      banner(ctx, p.text, { x: 0, y: 0, size: p.size, fill: p.color ?? "#ffffff", stroke: p.stroke });
    }
    ctx.restore();
  }

  private drawFlashes(view: View) {
    const { ctx, w, h, dt } = view;
    this.flashes = this.flashes.filter((flash) => {
      if (flash.edge) {
        vignette(ctx, w, h, [
          [0.45, rgba(flash.color, 0)],
          [1, rgba(flash.color, flash.alpha)],
        ]);
      } else {
        ctx.fillStyle = rgba(flash.color, flash.alpha);
        ctx.fillRect(0, 0, w, h);
      }
      flash.alpha *= Math.exp(-flash.decay * dt);
      return flash.alpha > 0.01;
    });
  }
}
