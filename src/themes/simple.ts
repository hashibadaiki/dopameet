import { RAINBOW, confetti, conic, edgePoint, pick, rand, rgba, ring, rise, smooth, vignette } from "../fx";
import type { Theme, View } from "../types";

export const simple: Theme = {
  id: "simple",
  label: "シンプル",
  description: "画面の縁で上品に盛り上げる。スライドは読めるまま",
  meter: {
    faces: ["🌑", "😰", "😐", "😊", "🤩"],
    fever: "🌈",
    feverName: "レインボー",
    feverOn: "🌈 レインボー中！",
    idle: "リアクションで画面が変わります",
    low: "👍 で助けて…",
  },
  create(engine) {
    let sparkClock = 0;

    const spotlight = (v: View) => {
      const r = 1.3 * (1 - v.down ** 1.6);
      vignette(v.ctx, v.w, v.h, [
        [r - 0.45, "rgba(0, 0, 0, 0)"],
        [r, "rgba(0, 0, 0, 0.94)"],
      ]);
      const blackout = smooth(0.85, 1, v.down);
      if (blackout > 0) {
        v.ctx.fillStyle = `rgba(0, 0, 0, ${blackout})`;
        v.ctx.fillRect(0, 0, v.w, v.h);
      }
    };

    return {
      filter: (v) =>
        `saturate(${(1 + v.up * 0.35 + v.rainbow * 0.25 - v.down * 0.85).toFixed(2)}) brightness(${(1 + v.up * 0.05).toFixed(2)})`,

      frame(v) {
        const { ctx, w, h, t } = v;
        if (v.up > 0.002) {
          const breathe = 0.82 + 0.18 * Math.sin(t * 2.2);
          vignette(ctx, w, h, [
            [0.65, rgba("#ffb23c", 0)],
            [1.05, rgba("#ffb23c", 0.5 * v.up * breathe)],
          ]);
          sparkClock += v.dt * smooth(0.3, 1, v.up) * 12;
          while (sparkClock > 1) {
            sparkClock -= 1;
            const p = edgePoint(w, h);
            engine.spawn({
              kind: "spark",
              color: pick(["#ffd36b", "#fff1c4", "#ff9f40"]),
              x: p.x,
              y: p.y,
              vx: p.nx * rand(20, 70),
              vy: p.ny * rand(20, 70) - 20,
              size: rand(10, 26),
              life: rand(0.9, 1.6),
              fadeIn: 0.3,
              fadeOut: 0.6,
            });
          }
        }
        if (v.rainbow > 0.002) {
          ring(engine, (s, sw, sh) => conic(s, sw, sh, RAINBOW, t * 1.4), 0.68, 0.7 * v.rainbow);
          ctx.fillStyle = `hsla(${(t * 90) % 360}, 100%, 60%, ${0.06 * v.rainbow})`;
          ctx.fillRect(0, 0, w, h);
        }
        if (v.down > 0.002) spotlight(v);
      },

      onReaction(v, event) {
        if (event.kind === "good") {
          rise(engine, event.emoji);
          engine.flash("#ffc94a", 0.35, { edge: true, decay: 3 });
          return;
        }
        engine.spawn({
          kind: "emoji",
          emoji: event.emoji,
          x: rand(0.15, 0.85) * v.w,
          y: -40,
          vy: 130,
          size: 64,
          life: 2.4,
          pop: true,
          alpha: 0.85,
          fadeOut: 1,
        });
        engine.flash("#3a0d1c", 0.55, { edge: true, decay: 2.5 });
      },

      onRainbowStart(v) {
        const colors = RAINBOW.slice(0, -1);
        confetti(engine, { x: 0, y: v.h, count: 70, colors, angle: [-1.4, -0.6], speed: [800, 1500] });
        confetti(engine, { x: v.w, y: v.h, count: 70, colors, angle: [-2.54, -1.74], speed: [800, 1500] });
        engine.flash("#ffffff", 0.3, { decay: 5 });
      },
    };
  },
};
