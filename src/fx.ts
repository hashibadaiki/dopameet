import type { Engine } from "./engine";

export const RAINBOW = [
  "#ff3b3b",
  "#ff9f1a",
  "#ffe600",
  "#3ddc5a",
  "#1ad1ff",
  "#5b6cff",
  "#c850ff",
  "#ff3b3b",
];

type Ctx = CanvasRenderingContext2D;

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smooth = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const pick = <T>(list: readonly T[]): T =>
  list[Math.floor(Math.random() * list.length)] as T;

export const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(alpha)})`;
};

export const vignette = (
  ctx: Ctx,
  w: number,
  h: number,
  stops: [offset: number, color: string][],
) => {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w, h);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.5);
  let last = 0;
  for (const [offset, color] of stops) {
    last = Math.max(last, clamp01(offset));
    gradient.addColorStop(last, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
};

export const conic = (ctx: Ctx, w: number, h: number, colors: string[], angle: number) => {
  const gradient = ctx.createConicGradient(angle, w / 2, h / 2);
  colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
};

export const ring = (
  engine: Engine,
  paint: (ctx: Ctx, w: number, h: number) => void,
  inner: number,
  alpha: number,
) => {
  const { sctx, scratch, ctx, w, h, dpr } = engine;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.globalCompositeOperation = "source-over";
  sctx.clearRect(0, 0, w, h);
  paint(sctx, w, h);
  sctx.globalCompositeOperation = "destination-in";
  vignette(sctx, w, h, [
    [inner, "rgba(0, 0, 0, 0)"],
    [1, "rgba(0, 0, 0, 1)"],
  ]);
  sctx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = clamp01(alpha);
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
};

export interface BannerOptions {
  x: number;
  y: number;
  size: number;
  fill: string | ((ctx: Ctx, width: number) => CanvasGradient);
  stroke?: string;
  alpha?: number;
  rotate?: number;
}

export const banner = (
  ctx: Ctx,
  text: string,
  { x, y, size, fill, stroke, alpha = 1, rotate = 0 }: BannerOptions,
) => {
  ctx.save();
  ctx.globalAlpha = clamp01(alpha);
  ctx.translate(x, y);
  ctx.rotate(rotate);
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (stroke) {
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, 0, 0);
  }
  ctx.fillStyle = typeof fill === "function" ? fill(ctx, ctx.measureText(text).width) : fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
};

export const edgePoint = (w: number, h: number) => {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: rand(0, w), y: 0, nx: 0, ny: 1 };
  if (side === 1) return { x: w, y: rand(0, h), nx: -1, ny: 0 };
  if (side === 2) return { x: rand(0, w), y: h, nx: 0, ny: -1 };
  return { x: 0, y: rand(0, h), nx: 1, ny: 0 };
};

export interface ConfettiOptions {
  x: number;
  y: number;
  count: number;
  colors: readonly string[];
  speed?: [number, number];
  angle?: [number, number];
  gravity?: number;
}

export const confetti = (
  engine: Engine,
  { x, y, count, colors, speed = [500, 1100], angle = [-Math.PI, 0], gravity = 700 }: ConfettiOptions,
) => {
  for (let i = 0; i < engine.amount(count); i++) {
    const a = rand(angle[0], angle[1]);
    const v = rand(speed[0], speed[1]);
    engine.spawn({
      kind: "confetti",
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      ay: gravity,
      drag: 2.2,
      life: rand(2.2, 3.6),
      w: rand(7, 12),
      h: rand(12, 20),
      color: pick(colors),
      rot: rand(0, Math.PI * 2),
      vr: rand(-7, 7),
      spin: rand(6, 14),
      wobble: rand(0.6, 1.4),
      sway: 120,
      fadeOut: 0.7,
    });
  }
};
