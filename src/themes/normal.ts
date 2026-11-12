import { banner, clamp01, edgePoint, rand, smooth, vignette } from "../fx";
import type { Engine } from "../engine";
import type { Particle, Theme, View } from "../types";

type Rgb = readonly [number, number, number];

interface Stage {
  id: string;
  at: number;
  color: Rgb;
}

const STAGES: readonly Stage[] = [
  { id: "blue", at: 0.04, color: [40, 90, 255] },
  { id: "aqua", at: 0.2, color: [60, 210, 255] },
  { id: "green", at: 0.4, color: [50, 235, 90] },
  { id: "red", at: 0.6, color: [255, 40, 30] },
];

const WHITE: Rgb = [255, 255, 255];
const SHADOW: Rgb = [8, 0, 12];
const TAU = Math.PI * 2;
const SPRITE = 128;
const VARIANTS = 4;

const stageOf = (target: number) => STAGES.findLastIndex((stage) => target >= stage.at);

const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k,
];

const hex = (rgb: Rgb) =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;

const hue = (deg: number): Rgb => {
  const f = (n: number) => {
    const k = (((n + deg / 30) % 12) + 12) % 12;
    return (0.55 - 0.45 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
};

const around = (a: number, w: number, h: number, scale: number) => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    x: w / 2 + Math.sign(c) * Math.abs(c) ** 0.5 * w * scale,
    y: h / 2 + Math.sign(s) * Math.abs(s) ** 0.5 * h * scale,
  };
};

const canvas2d = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return { canvas, ctx };
};

const noise = () => {
  const n = 16;
  const lattice = Array.from({ length: n * n }, () => Math.random());
  const at = (x: number, y: number) => lattice[(((y % n) + n) % n) * n + (((x % n) + n) % n)]!;
  const fade = (t: number) => t * t * (3 - 2 * t);
  const value = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };
  return (x: number, y: number) => {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
      sum += value(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / 0.9375;
  };
};

const puff = () => {
  const { canvas, ctx } = canvas2d(SPRITE);
  const image = ctx.createImageData(SPRITE, SPRITE);
  const fbm = noise();
  const scale = 4 / SPRITE;
  for (let y = 0; y < SPRITE; y++) {
    for (let x = 0; x < SPRITE; x++) {
      const dx = x / SPRITE - 0.5;
      const dy = y / SPRITE - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const falloff = clamp01(1 - d) ** 1.4;
      if (falloff <= 0) continue;
      const u = x * scale;
      const v = y * scale;
      const warp = fbm(u + 5.2, v + 1.3) * 2.2;
      const density = fbm(u + warp, v + fbm(u + 9.1, v + 4.7) * 2.2);
      const alpha = clamp01((density - 0.32) * 2.4) * falloff;
      const i = (y * SPRITE + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = alpha * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

export const normal: Theme = {
  id: "normal",
  tone: (view) => STAGES[stageOf(view.target)]?.id ?? "",
  create(engine) {
    let stage = -1;
    let color: Rgb = STAGES[0]!.color;
    let heat = 0;
    let smokeClock = 0;
    let shadeClock = 0;

    const puffs = Array.from({ length: VARIANTS }, puff);
    const tints = new Map<string, HTMLCanvasElement>();

    const tinted = (rgb: Rgb, variant: number, glow: number) => {
      const q = rgb.map((c) => Math.round(c / 12) * 12) as unknown as Rgb;
      const key = `${q.join(",")}|${variant}|${glow}`;
      const cached = tints.get(key);
      if (cached) return cached;
      const { canvas, ctx } = canvas2d(SPRITE);
      const source = puffs[variant]!;
      ctx.drawImage(source, 0, 0);
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = hex(q);
      ctx.fillRect(0, 0, SPRITE, SPRITE);
      if (glow > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = glow;
        ctx.drawImage(source, 0, 0);
      }
      if (tints.size > 240) tints.clear();
      tints.set(key, canvas);
      return canvas;
    };

    const drawPuff = (
      ctx: CanvasRenderingContext2D,
      image: HTMLCanvasElement,
      x: number,
      y: number,
      size: number,
      rot: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
      ctx.restore();
    };

    const smoke = (v: View, options: { speed?: number; life?: number; tone?: Rgb } = {}) => {
      const a = rand(0, TAU);
      const { x, y } = around(a, v.w, v.h, rand(0.53, 0.6));
      const inward = rand(20, 70) * (options.speed ?? 1);
      const swirl = rand(50, 110) * (options.speed ?? 1);
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      const variant = Math.floor(rand(0, VARIANTS));
      const shift = rand(0, 360);
      engine.spawn({
        kind: "custom",
        x,
        y,
        vx: -nx * inward - ny * swirl,
        vy: -ny * inward + nx * swirl,
        drag: 0.35,
        size: Math.min(v.w, v.h) * rand(0.26, 0.44),
        rot: rand(0, TAU),
        vr: rand(-0.5, 0.5),
        life: options.life ?? rand(2.2, 3.4),
        fadeIn: 0.6,
        fadeOut: 1.2,
        draw: (ctx: CanvasRenderingContext2D, p: Particle, alpha: number, view: View) => {
          const tone = options.tone ?? mix(color, hue(shift + view.t * 120), view.rainbow);
          const strength = options.tone ? 1 : Math.max(heat, 0.25);
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = clamp01(alpha * 0.6 * strength);
          drawPuff(ctx, tinted(tone, variant, 0.35), p.x, p.y, p.size * (1 + p.age * 0.35), p.rot);
          ctx.restore();
        },
      });
    };

    const sparks = (v: View, rgb: Rgb, count: number) => {
      for (let i = 0; i < engine.amount(count); i++) {
        const p = edgePoint(v.w, v.h);
        engine.spawn({
          kind: "spark",
          color: hex(mix(rgb, WHITE, rand(0, 0.5))),
          x: p.x,
          y: p.y,
          vx: p.nx * rand(200, 600) + rand(-120, 120),
          vy: p.ny * rand(200, 600) + rand(-120, 120),
          drag: 2.5,
          size: rand(18, 40),
          life: rand(0.6, 1.2),
          fadeOut: 0.5,
        });
      }
    };

    const gust = (v: View, count: number, tone?: Rgb) => {
      for (let i = 0; i < engine.amount(count); i++) {
        smoke(v, { speed: 2.4, life: rand(1.4, 2.2), tone });
      }
    };

    const endText = (v: View, end: number) => {
      const { ctx, w, h, t } = v;
      const size = Math.min(w, h) * 0.24 * (1.12 - 0.12 * end);
      ctx.save();
      ctx.letterSpacing = `${Math.round(size * 0.12)}px`;
      ctx.shadowColor = `rgba(255, 30, 40, ${0.8 * end})`;
      ctx.shadowBlur = size * (0.25 + 0.08 * Math.sin(t * 3));
      banner(ctx, "END", {
        x: w / 2,
        y: h / 2,
        size,
        alpha: end,
        stroke: "#2a0006",
        fill: (g) => {
          const gradient = g.createLinearGradient(0, -size / 2, 0, size / 2);
          gradient.addColorStop(0, "#ffffff");
          gradient.addColorStop(0.5, "#c9c9d2");
          gradient.addColorStop(0.52, "#8a8a96");
          gradient.addColorStop(1, "#e6e6ee");
          return gradient;
        },
      });
      ctx.restore();
    };

    const edges = (v: View, depth: number, alpha: number) => {
      const { ctx, w, h } = v;
      const bands: [number, number, number, number, number, number, number, number][] = [
        [0, 0, 0, depth, 0, 0, w, depth],
        [0, h, 0, h - depth, 0, h - depth, w, depth],
        [0, 0, depth, 0, 0, 0, depth, h],
        [w, 0, w - depth, 0, w - depth, 0, depth, h],
      ];
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of bands) {
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        gradient.addColorStop(0.45, `rgba(0, 0, 0, ${alpha * 0.35})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(rx, ry, rw, rh);
      }
    };

    const shade = (v: View, depth: number) => {
      const p = edgePoint(v.w, v.h);
      const inset = rand(-0.1, 0.5) * depth;
      const drift = rand(15, 45) * (Math.random() < 0.5 ? -1 : 1);
      const variant = Math.floor(rand(0, VARIANTS));
      engine.spawn({
        kind: "custom",
        x: p.x + p.nx * inset,
        y: p.y + p.ny * inset,
        vx: p.nx * rand(8, 30) - p.ny * drift,
        vy: p.ny * rand(8, 30) + p.nx * drift,
        drag: 0.2,
        size: Math.min(v.w, v.h) * rand(0.3, 0.6),
        rot: rand(0, TAU),
        vr: rand(-0.25, 0.25),
        life: rand(3.5, 5.5),
        fadeIn: 1.4,
        fadeOut: 1.8,
        draw: (ctx: CanvasRenderingContext2D, q: Particle, alpha: number, view: View) => {
          ctx.save();
          ctx.globalAlpha = clamp01(alpha * 0.5 * view.down ** 0.7);
          drawPuff(ctx, tinted(SHADOW, variant, 0), q.x, q.y, q.size * (1 + q.age * 0.15), q.rot);
          ctx.restore();
        },
      });
    };

    const darkness = (v: View) => {
      const { ctx, w, h, down } = v;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.3 * down ** 2})`;
      ctx.fillRect(0, 0, w, h);

      const depth = Math.min(w, h) * (0.06 + 0.6 * down ** 1.3);
      edges(v, depth, clamp01(0.85 * down ** 0.9));

      shadeClock += v.dt * smooth(0, 0.15, down) * (v.reduced ? 4 : 10);
      while (shadeClock > 1) {
        shadeClock -= 1;
        shade(v, depth);
      }

      const blackout = smooth(0.8, 0.95, down);
      if (blackout > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${blackout})`;
        ctx.fillRect(0, 0, w, h);
      }

      const end = smooth(0.86, 0.97, down);
      if (end > 0) endText(v, end);
    };

    return {
      filter: (v) =>
        `saturate(${(1 + v.up * 0.3 + v.rainbow * 0.25 - v.down ** 1.5 * 0.85).toFixed(2)}) brightness(${(1 + v.up * 0.05 - v.down ** 1.5 * 0.15).toFixed(2)})`,

      frame(v) {
        const next = stageOf(v.target);
        if (next > stage) {
          const reached = STAGES[next]!.color;
          engine.flash(hex(reached), 0.7, { edge: true, decay: 2.2 });
          engine.flash("#ffffff", 0.15, { decay: 6 });
          sparks(v, reached, 30);
          gust(v, 14);
        }
        if (next >= 0) color = STAGES[next]!.color;
        stage = next;

        heat = Math.max(smooth(0, 0.08, v.up) * (0.55 + 0.45 * v.up), v.rainbow);
        if (heat > 0.002) {
          vignette(v.ctx, v.w, v.h, [
            [0.7, "rgba(0, 0, 0, 0)"],
            [1.15, `rgba(${mix(color, hue(v.t * 90), v.rainbow).map(Math.round).join(", ")}, ${0.3 * heat})`],
          ]);
          smokeClock += v.dt * heat * (v.reduced ? 6 : 22);
          while (smokeClock > 1) {
            smokeClock -= 1;
            smoke(v);
          }
        }
        if (v.down > 0.002) darkness(v);
      },

      onReaction(v, event) {
        if (event.kind === "good") {
          engine.flash(hex(color), 0.3, { edge: true, decay: 3 });
          return;
        }
        engine.flash("#1a0010", 0.6, { edge: true, decay: 2.5 });
      },

      onRainbowStart(v) {
        engine.flash("#ffffff", 0.4, { decay: 4 });
        for (let i = 0; i < 6; i++) gust(v, 5, hue(i * 60));
        sparks(v, WHITE, 50);
      },
    };
  },
};
