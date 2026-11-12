Dopameet.defineTheme({
  id: "party",
  label: "ド派手",
  description: "全部盛り。ライト、紙吹雪、フィーバー",
  meter: {
    faces: ["💀", "😭", "😎", "🥳", "🤯"],
    fever: "🪩",
    feverName: "フィーバー",
    feverOn: "🪩 FEVER!! 🪩",
    idle: "押せ押せ！リアクションで画面が爆発する",
    low: "👍 をくれ…！",
  },
  create(engine) {
    const fx = DopameetFx;
    const COLORS = ["#ff2d95", "#ffe600", "#1ad1ff", "#3ddc5a", "#ff9f1a", "#c850ff", "#ffffff"];
    const SPRAY = ["✨", "⭐", "💥", "🎊"];
    let confettiClock = 0;
    let rainClock = 0;

    const beams = (ctx, w, h, t, strength) => {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const length = Math.hypot(w, h);
      for (let i = 0; i < 4; i++) {
        const ox = w * (0.15 + i * 0.233);
        const oy = h + 20;
        const angle = -Math.PI / 2 + Math.sin(t * (0.9 + i * 0.27) + i * 1.7) * 0.6;
        const hue = (t * 60 + i * 90) % 360;
        const gradient = ctx.createLinearGradient(
          ox,
          oy,
          ox + Math.cos(angle) * length,
          oy + Math.sin(angle) * length,
        );
        gradient.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.42 * strength})`);
        gradient.addColorStop(1, `hsla(${hue}, 100%, 65%, 0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox + Math.cos(angle - 0.13) * length, oy + Math.sin(angle - 0.13) * length);
        ctx.lineTo(ox + Math.cos(angle + 0.13) * length, oy + Math.sin(angle + 0.13) * length);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    };

    const fallConfetti = (v, rate) => {
      confettiClock += v.dt * rate;
      while (confettiClock > 1) {
        confettiClock -= 1;
        fx.confetti(engine, {
          x: fx.rand(0, v.w),
          y: -20,
          count: 1,
          colors: COLORS,
          speed: [40, 160],
          angle: [Math.PI * 0.3, Math.PI * 0.7],
          gravity: 420,
        });
      }
    };

    const rain = (v) => {
      rainClock += v.dt * v.down * 70;
      while (rainClock > 1) {
        rainClock -= 1;
        engine.spawn({
          kind: "custom",
          x: fx.rand(0, v.w * 1.2),
          y: -40,
          vx: -160,
          vy: fx.rand(900, 1300),
          life: 1.4,
          fadeIn: 0.05,
          fadeOut: 0.2,
          draw(ctx, p, alpha) {
            ctx.strokeStyle = `rgba(170, 195, 255, ${0.55 * alpha})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
          },
        });
      }
    };

    return {
      filter: (v) => {
        const hue = v.reduced ? 0 : Math.round(Math.sin(v.t * 2.5) * 160 * v.rainbow);
        return `saturate(${(1 + v.up * 1.1 + v.rainbow * 0.6 - v.down).toFixed(2)}) contrast(${(1 + v.up * 0.12).toFixed(2)}) hue-rotate(${hue}deg)`;
      },

      frame(v) {
        const { ctx, w, h, t } = v;
        const energy = Math.max(v.up, v.rainbow);
        if (energy > 0.01) beams(ctx, w, h, t, energy);
        if (v.up > 0.01) {
          const hue = (t * 120) % 360;
          fx.vignette(ctx, w, h, [
            [0.5, `hsla(${hue}, 100%, 60%, 0)`],
            [1, `hsla(${hue}, 100%, 60%, ${0.55 * v.up})`],
          ]);
          fallConfetti(v, fx.smooth(0.2, 1, v.up) * 22);
        }
        if (v.rainbow > 0.01) {
          ctx.fillStyle = `hsla(${(t * 200) % 360}, 100%, 60%, ${0.12 * v.rainbow})`;
          ctx.fillRect(0, 0, w, h);
          fx.ring(engine, (s, sw, sh) => fx.conic(s, sw, sh, fx.RAINBOW, t * 3), 0.35, 0.9 * v.rainbow);
          fallConfetti(v, 40 * v.rainbow);
          const size = Math.min(w, h) * 0.13 * (1 + 0.06 * Math.sin(t * 12));
          fx.banner(ctx, "FEVER!!", {
            x: w / 2,
            y: h * 0.16,
            size,
            alpha: v.rainbow,
            rotate: Math.sin(t * 3) * 0.06,
            stroke: "#ffffff",
            fill: (c, width) => {
              const gradient = c.createLinearGradient(-width / 2, 0, width / 2, 0);
              const shift = (t * 0.8) % 1;
              fx.RAINBOW.forEach((color, i) =>
                gradient.addColorStop((i / (fx.RAINBOW.length - 1) + shift) % 1, color),
              );
              return gradient;
            },
          });
        }
        if (v.down > 0.01) {
          rain(v);
          const dark = 0.9 * v.down ** 1.3 + 0.1 * fx.smooth(0.85, 1, v.down);
          ctx.fillStyle = `rgba(4, 6, 14, ${dark})`;
          ctx.fillRect(0, 0, w, h);
        }
      },

      onReaction(v, event) {
        if (event.kind === "good") {
          const x = fx.rand(0.15, 0.85) * v.w;
          const y = fx.rand(0.25, 0.7) * v.h;
          engine.spawn({
            kind: "emoji",
            emoji: event.emoji,
            x,
            y,
            vy: -40,
            size: fx.rand(120, 170),
            life: 1.5,
            pop: true,
            vr: fx.rand(-1, 1),
            fadeOut: 0.5,
          });
          const count = engine.amount(14);
          for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const speed = fx.rand(450, 750);
            engine.spawn({
              kind: i % 2 ? "spark" : "emoji",
              emoji: fx.pick(SPRAY),
              color: fx.pick(COLORS),
              x,
              y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              ay: 500,
              drag: 2.2,
              size: i % 2 ? 40 : 34,
              life: 1.3,
              fadeOut: 0.6,
            });
          }
          if (v.comboCount >= 2) {
            engine.spawn({
              kind: "text",
              text: `COMBO ×${v.comboCount}`,
              x,
              y: y + 110,
              vy: -60,
              size: 44,
              color: "#ffe600",
              stroke: "#ff2d95",
              life: 1.1,
              pop: true,
              fadeOut: 0.4,
            });
          }
          engine.flash("#ffffff", 0.2, { decay: 7 });
        } else {
          engine.spawn({
            kind: "emoji",
            emoji: event.emoji,
            x: fx.rand(0.2, 0.8) * v.w,
            y: -100,
            vy: 300,
            ay: 2600,
            size: 150,
            life: 1.1,
            vr: fx.rand(-0.6, 0.6),
            fadeOut: 0.3,
          });
          engine.flash("#000000", 0.5, { decay: 3 });
        }
      },

      onRainbowStart(v) {
        fx.confetti(engine, {
          x: v.w / 2,
          y: v.h / 2,
          count: 220,
          colors: COLORS,
          speed: [500, 1600],
          angle: [0, Math.PI * 2],
        });
        for (let i = 0; i < engine.amount(10); i++) {
          engine.spawn({
            kind: "emoji",
            emoji: fx.pick(["🎉", "🪩", "🔥", "💥"]),
            x: fx.rand(0.1, 0.9) * v.w,
            y: fx.rand(0.15, 0.85) * v.h,
            size: fx.rand(70, 130),
            life: 1.3,
            pop: true,
            fadeOut: 0.5,
          });
        }
        engine.flash("#ffffff", 0.65, { decay: 3 });
      },
    };
  },
});
