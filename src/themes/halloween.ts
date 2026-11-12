import { banner, conic, pick, rand, rgba, ring, rise, smooth, vignette } from "../fx";
import type { Theme, View } from "../types";

const PARTY = ["#ff7a00", "#9b3dd6", "#7cff6b", "#ff7a00"];
const CANDY = ["🍬", "🍭", "🍫", "🎃"];

interface GhostOptions {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  size?: number;
  life?: number;
}

export const halloween: Theme = {
  id: "halloween",
  label: "ハロウィン",
  description: "かぼちゃとコウモリ。滑ると霧とおばけが出る",
  meter: {
    faces: ["💀", "👻", "🕯️", "🎃", "🧛"],
    fever: "🍭",
    feverName: "パーティー",
    feverOn: "🎃 HAPPY HALLOWEEN 🎃",
    idle: "🎃 リアクションで画面が化ける",
    low: "👻 👍 で追い払って！",
  },
  create(engine) {
    const fog = Array.from({ length: 7 }, () => ({
      x: Math.random(),
      y: rand(0.55, 1.05),
      r: rand(0.25, 0.45),
      speed: rand(0.01, 0.04) * pick([-1, 1]),
    }));
    const eyes = { x: rand(0.3, 0.7), y: rand(0.35, 0.6) };
    let batClock = 0;
    let ghostClock = 0;
    let candyClock = 0;

    const bat = (v: View, size = rand(36, 64)) => {
      const fromLeft = Math.random() < 0.5;
      const y0 = rand(0.08, 0.6) * v.h;
      const speed = rand(260, 420) * (fromLeft ? 1 : -1);
      engine.spawn({
        kind: "emoji",
        emoji: "🦇",
        x: fromLeft ? -60 : v.w + 60,
        y: y0,
        vx: speed,
        size,
        life: (v.w + 160) / Math.abs(speed),
        fadeIn: 0.05,
        fadeOut: 0.1,
        tick: (p) => {
          p.y = y0 + Math.sin(p.age * 4) * 40;
          p.sy = 0.6 + 0.4 * Math.abs(Math.sin(p.age * 16));
        },
      });
    };

    const ghost = (v: View, options: GhostOptions = {}) => {
      engine.spawn({
        kind: "emoji",
        emoji: "👻",
        x: options.x ?? rand(0.1, 0.9) * v.w,
        y: options.y ?? v.h + 60,
        vx: options.vx ?? 0,
        vy: options.vy ?? rand(-90, -50),
        size: options.size ?? rand(50, 90),
        life: options.life ?? 4.5,
        alpha: 0.75,
        fadeIn: 0.8,
        fadeOut: 1.2,
        wobble: 0.5,
        sway: 70,
        tick: (p) => {
          p.sx = 1 + Math.sin(p.age * 3) * 0.06;
          p.rot = Math.sin(p.age * 2) * 0.15;
        },
      });
    };

    const drawFog = (v: View) => {
      const { ctx, w, h } = v;
      const scale = Math.max(w, h);
      for (const blob of fog) {
        blob.x = ((blob.x + blob.speed * v.dt + 1.4) % 1.4) - 0.2;
        const x = blob.x * w;
        const y = blob.y * h;
        const r = blob.r * scale;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, `rgba(190, 185, 215, ${0.38 * v.down})`);
        gradient.addColorStop(1, "rgba(190, 185, 215, 0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };

    const drawEyes = (v: View, alpha: number) => {
      const { ctx, w, h, t } = v;
      const open = t % 3.7 > 0.18;
      const size = Math.min(w, h) * 0.035;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#ffe14d";
      ctx.shadowColor = "#ffb300";
      ctx.shadowBlur = size;
      for (const dx of [-1.6, 1.6]) {
        ctx.beginPath();
        ctx.ellipse(eyes.x * w + dx * size, eyes.y * h, size, open ? size * 0.55 : size * 0.06, dx * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    return {
      filter: (v) =>
        `sepia(${(v.up * 0.3).toFixed(2)}) saturate(${(1 + v.up * 0.35 - v.down * 0.8).toFixed(2)}) hue-rotate(${Math.round(-v.down * 20)}deg)`,

      frame(v) {
        const { ctx, w, h, t } = v;
        if (v.up > 0.002) {
          const flicker = 0.8 + 0.12 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 13.1 + 1.3);
          vignette(ctx, w, h, [
            [0.6, rgba("#ff7a00", 0)],
            [0.92, rgba("#ff7a00", 0.35 * v.up * flicker)],
            [1.2, rgba("#6d2c91", 0.4 * v.up)],
          ]);
          batClock += v.dt * smooth(0.25, 1, v.up) * 0.9;
          while (batClock > 1) {
            batClock -= 1;
            bat(v);
          }
        }
        if (v.rainbow > 0.002) {
          ring(engine, (s, sw, sh) => conic(s, sw, sh, PARTY, t * 1.8), 0.45, 0.85 * v.rainbow);
          candyClock += v.dt * 10 * v.rainbow;
          while (candyClock > 1) {
            candyClock -= 1;
            engine.spawn({
              kind: "emoji",
              emoji: pick(CANDY),
              x: rand(0, w),
              y: -40,
              vy: rand(160, 280),
              vr: rand(-2, 2),
              size: rand(30, 50),
              life: h / 160,
              fadeOut: 0.5,
            });
          }
          banner(ctx, "HAPPY HALLOWEEN", {
            x: w / 2,
            y: h * 0.14,
            size: Math.min(w, h) * 0.08,
            alpha: v.rainbow,
            rotate: Math.sin(t * 2) * 0.03,
            fill: "#ff8c1a",
            stroke: "#2b0a3d",
          });
        }
        if (v.down > 0.002) {
          drawFog(v);
          const r = 1.3 * (1 - v.down ** 1.6);
          vignette(ctx, w, h, [
            [r - 0.45, "rgba(6, 0, 16, 0)"],
            [r, "rgba(6, 0, 16, 0.95)"],
          ]);
          const blackout = smooth(0.85, 1, v.down);
          if (blackout > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${blackout})`;
            ctx.fillRect(0, 0, w, h);
            drawEyes(v, smooth(0.85, 1, v.down));
          }
          ghostClock += v.dt * smooth(0.2, 0.8, v.down) * 0.6;
          while (ghostClock > 1) {
            ghostClock -= 1;
            ghost(v);
          }
        }
      },

      onReaction(v, event) {
        if (event.kind === "good") {
          rise(engine, event.emoji);
          bat(v, 44);
          engine.flash("#ff7a00", 0.35, { edge: true, decay: 3 });
          return;
        }
        const fromLeft = Math.random() < 0.5;
        ghost(v, {
          x: fromLeft ? -80 : v.w + 80,
          y: rand(0.3, 0.7) * v.h,
          vx: (fromLeft ? 1 : -1) * rand(500, 700),
          vy: rand(-40, 40),
          size: 120,
          life: 2.2,
        });
        engine.flash("#2b0a3d", 0.6, { edge: true, decay: 2.5 });
      },

      onRainbowStart(v) {
        for (let i = 0; i < engine.amount(60); i++) {
          const angle = rand(-Math.PI * 0.85, -Math.PI * 0.15);
          const speed = rand(600, 1300);
          engine.spawn({
            kind: "emoji",
            emoji: pick(CANDY),
            x: v.w / 2,
            y: v.h + 20,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            ay: 900,
            drag: 0.8,
            vr: rand(-6, 6),
            size: rand(30, 56),
            life: 3,
            fadeOut: 0.6,
          });
        }
        for (let i = 0; i < engine.amount(6); i++) bat(v);
        engine.flash("#ff7a00", 0.4, { decay: 4 });
      },
    };
  },
};
