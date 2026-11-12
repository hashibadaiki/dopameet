const DopameetFx = (() => {
  const EMOJI_FONT =
    '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const RAINBOW = [
    "#ff3b3b",
    "#ff9f1a",
    "#ffe600",
    "#3ddc5a",
    "#1ad1ff",
    "#5b6cff",
    "#c850ff",
    "#ff3b3b",
  ];

  const clamp01 = (value) => Math.max(0, Math.min(1, value));
  const lerp = (from, to, t) => from + (to - from) * t;
  const smooth = (edge0, edge1, value) => {
    const t = clamp01((value - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  };
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  const rgba = (hex, alpha) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${clamp01(alpha)})`;
  };

  const vignette = (ctx, w, h, stops) => {
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

  const conic = (ctx, w, h, colors, angle) => {
    const gradient = ctx.createConicGradient(angle, w / 2, h / 2);
    colors.forEach((color, i) =>
      gradient.addColorStop(i / (colors.length - 1), color),
    );
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  };

  const ring = (engine, paint, inner, alpha) => {
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

  const banner = (ctx, text, { x, y, size, fill, stroke, alpha = 1, rotate = 0 }) => {
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
    if (typeof fill === "function") {
      const width = ctx.measureText(text).width;
      ctx.fillStyle = fill(ctx, width);
    } else {
      ctx.fillStyle = fill;
    }
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };

  const edgePoint = (w, h) => {
    const side = Math.floor(Math.random() * 4);
    if (side === 0) return { x: rand(0, w), y: 0, nx: 0, ny: 1 };
    if (side === 1) return { x: w, y: rand(0, h), nx: -1, ny: 0 };
    if (side === 2) return { x: rand(0, w), y: h, nx: 0, ny: -1 };
    return { x: 0, y: rand(0, h), nx: 1, ny: 0 };
  };

  const confetti = (
    engine,
    { x, y, count, colors, speed = [500, 1100], angle = [-Math.PI, 0], gravity = 700 },
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

  const rise = (engine, emoji, options = {}) =>
    engine.spawn({
      kind: "emoji",
      emoji,
      x: options.x ?? rand(0.12, 0.88) * engine.w,
      y: options.y ?? engine.h + 40,
      vx: rand(-30, 30),
      vy: rand(-300, -230),
      drag: 0.5,
      life: options.life ?? 2.4,
      size: options.size ?? 64,
      pop: true,
      wobble: rand(0.8, 1.4),
      sway: 60,
      fadeOut: 0.9,
    });

  return {
    EMOJI_FONT,
    RAINBOW,
    clamp01,
    lerp,
    smooth,
    rand,
    pick,
    rgba,
    vignette,
    conic,
    ring,
    banner,
    edgePoint,
    confetti,
    rise,
  };
})();

class DopameetMeter {
  constructor(root) {
    const make = (tag, className, parent) => {
      const element = document.createElement(tag);
      if (className) element.className = className;
      parent.append(element);
      return element;
    };
    this.el = make("div", "meter", root);
    this.face = make("div", "face", this.el);
    const body = make("div", "body", this.el);
    const track = make("div", "track", body);
    this.up = make("div", "up", track);
    this.down = make("div", "down", track);
    make("div", "zero", track);
    this.timer = make("div", "timer", body);
    const row = make("div", "row", body);
    this.caption = make("div", "caption", row);
    const pips = make("div", "pips", row);
    this.pips = Array.from({ length: Dopameet.RAINBOW_COUNT }, () =>
      make("i", "", pips),
    );
    this.visible = false;
    this.cache = {};
  }

  setTheme(theme) {
    this.theme = theme;
    this.el.dataset.theme = theme.id;
    this.cache = {};
  }

  setVisible(visible) {
    this.visible = visible;
    this.el.classList.toggle("shown", visible);
  }

  write(key, value, apply) {
    if (this.cache[key] === value) return false;
    this.cache[key] = value;
    apply(value);
    return true;
  }

  faceFor(view) {
    const { faces, fever } = this.theme.meter;
    if (view.fever) return fever;
    const index = Math.min(
      faces.length - 1,
      Math.floor(((view.level + 1) / 2) * faces.length),
    );
    return faces[index];
  }

  captionFor(view) {
    const meter = this.theme.meter;
    if (view.fever) return meter.feverOn;
    if (view.comboCount > 0) {
      return `あと ${Dopameet.RAINBOW_COUNT - view.comboCount} 回で${meter.feverName}`;
    }
    if (view.level < -0.4) return meter.low;
    return meter.idle;
  }

  update(view) {
    if (!this.theme) return;
    this.write("up", view.up.toFixed(3), (v) => (this.up.style.transform = `scaleX(${v})`));
    this.write("down", view.down.toFixed(3), (v) => (this.down.style.transform = `scaleX(${v})`));
    this.write("timer", view.rainbowLeft.toFixed(3), (v) => (this.timer.style.transform = `scaleX(${v})`));
    this.write("fever", view.fever, (v) => this.el.classList.toggle("fever", v));
    this.write("caption", this.captionFor(view), (v) => (this.caption.textContent = v));
    this.write("pips", view.comboCount, (count) =>
      this.pips.forEach((pip, i) => pip.classList.toggle("on", i < count)),
    );
    const changed = this.write("face", this.faceFor(view), (v) => (this.face.textContent = v));
    if (changed && this.visible) this.pop(this.face, 1.5);
  }

  pop(element, scale) {
    element.animate(
      [
        { transform: "scale(1)" },
        { transform: `scale(${scale})`, offset: 0.35 },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "cubic-bezier(.2,.9,.3,1.3)" },
    );
  }

  bump(event) {
    if (!this.visible) return;
    this.el.animate(
      [
        { translate: "0 0" },
        { translate: event.kind === "good" ? "0 -0.35em" : "0.25em 0", offset: 0.3 },
        { translate: event.kind === "good" ? "0 0" : "-0.2em 0", offset: 0.6 },
        { translate: "0 0" },
      ],
      { duration: 360, easing: "ease-out" },
    );
    this.pop(this.face, 1.35);
  }

  origin() {
    if (!this.visible) return null;
    const rect = this.face.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  }
}

class DopameetEngine {
  static MAX_PARTICLES = 700;

  constructor(root) {
    this.filterLayer = document.createElement("div");
    this.filterLayer.className = "filter";
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
    this.scratch = document.createElement("canvas");
    this.sctx = this.scratch.getContext("2d");
    root.append(this.filterLayer, this.canvas);
    this.meter = new DopameetMeter(root);

    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.mood = Dopameet.initialMood();
    this.theme = null;
    this.state = null;
    this.particles = [];
    this.flashes = [];
    this.sprites = new Map();
    this.level = { x: 0, v: 0 };
    this.rainbow = { x: 0, v: 0 };
    this.running = false;
    this.onSleep = () => {};
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.time = 0;
    this.last = 0;
    this.filter = "";
    this.tick = this.tick.bind(this);
    addEventListener("resize", () => this.resize());
  }

  resize() {
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

  setTheme(theme) {
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

  setMood(mood) {
    this.mood = mood;
    if (this.theme && !this.running) this.meter.update(this.step(0));
  }

  amount(count) {
    return Math.max(1, Math.round(count * (this.reduced ? 0.3 : 1)));
  }

  spawn(particle) {
    if (this.particles.length >= DopameetEngine.MAX_PARTICLES) this.particles.shift();
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
      ...particle,
      age: 0,
    });
    this.wake();
  }

  flash(color, alpha, { edge = false, decay = 4 } = {}) {
    this.flashes.push({ color, alpha, edge, decay });
    this.wake();
  }

  step(dt) {
    const now = Date.now();
    const target = Dopameet.scoreAt(this.mood, now) / Dopameet.LIMIT;
    const fever = now < this.mood.rainbowUntil;
    const spring = (s, to, stiffness, damping) => {
      s.v += (stiffness * (to - s.x) - damping * s.v) * dt;
      s.x += s.v * dt;
    };
    spring(this.level, target, 120, 14);
    spring(this.rainbow, fever ? 1 : 0, 40, 12.6);
    const level = Math.max(-1, Math.min(1, this.level.x));
    const comboCount = Math.min(
      Dopameet.RAINBOW_COUNT - 1,
      Dopameet.recentGood(this.mood, now).length,
    );
    this.view = {
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
      rainbow: DopameetFx.clamp01(this.rainbow.x),
      rainbowLeft: fever
        ? DopameetFx.clamp01((this.mood.rainbowUntil - now) / Dopameet.RAINBOW_MS)
        : 0,
      comboCount,
      reduced: this.reduced,
    };
    return this.view;
  }

  wake() {
    if (this.running || !this.theme) return;
    this.running = true;
    this.resize();
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  tick(now) {
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
  }

  isIdle(view) {
    const still = (value) => Math.abs(value) < 0.003;
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

  sleep() {
    this.running = false;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.applyFilter("");
    this.onSleep();
  }

  stop() {
    this.particles = [];
    this.flashes = [];
    if (this.running) this.sleep();
  }

  applyFilter(value) {
    if (value === this.filter) return;
    this.filter = value;
    this.filterLayer.style.backdropFilter = value || "none";
  }

  reaction(event) {
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
        vx: DopameetFx.rand(-50, 50),
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

  sprite(emoji, size) {
    const bucket = Math.max(8, Math.round(size / 8) * 8);
    const key = `${emoji}|${bucket}`;
    let canvas = this.sprites.get(key);
    if (canvas) return canvas;
    const px = Math.ceil(bucket * 1.3 * this.dpr);
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = px;
    const g = canvas.getContext("2d");
    g.font = `${Math.round(px * 0.76)}px ${DopameetFx.EMOJI_FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, px / 2, px / 2 + px * 0.05);
    if (this.sprites.size > 160) this.sprites.clear();
    this.sprites.set(key, canvas);
    return canvas;
  }

  glow(color) {
    const key = `glow|${color}`;
    let canvas = this.sprites.get(key);
    if (canvas) return canvas;
    canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d");
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.2, DopameetFx.rgba(color, 1));
    gradient.addColorStop(1, DopameetFx.rgba(color, 0));
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);
    this.sprites.set(key, canvas);
    return canvas;
  }

  drawParticles(view) {
    const { ctx, dt } = view;
    const alive = [];
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
        p.alpha *
        Math.min(1, p.age / p.fadeIn) *
        Math.min(1, (p.life - p.age) / p.fadeOut);
      if (alpha > 0.003) this.drawParticle(ctx, p, alpha, view);
      alive.push(p);
    }
    this.particles = alive;
  }

  drawParticle(ctx, p, alpha, view) {
    if (p.kind === "custom") {
      p.draw(ctx, p, alpha, view);
      return;
    }
    const pop = p.pop && p.age < 0.4 ? easeOutBack(p.age / 0.4) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === "emoji") {
      const size = p.size;
      ctx.scale(pop * (p.sx ?? 1), pop * (p.sy ?? 1));
      ctx.drawImage(this.sprite(p.emoji, size), -size * 0.65, -size * 0.65, size * 1.3, size * 1.3);
    } else if (p.kind === "confetti") {
      ctx.scale(1, Math.cos(p.age * p.spin));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    } else if (p.kind === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.glow(p.color), -p.size / 2, -p.size / 2, p.size, p.size);
    } else if (p.kind === "text") {
      ctx.scale(pop, pop);
      DopameetFx.banner(ctx, p.text, {
        x: 0,
        y: 0,
        size: p.size,
        fill: p.color,
        stroke: p.stroke,
      });
    }
    ctx.restore();
  }

  drawFlashes(view) {
    const { ctx, w, h, dt } = view;
    this.flashes = this.flashes.filter((flash) => {
      if (flash.edge) {
        DopameetFx.vignette(ctx, w, h, [
          [0.45, DopameetFx.rgba(flash.color, 0)],
          [1, DopameetFx.rgba(flash.color, flash.alpha)],
        ]);
      } else {
        ctx.fillStyle = DopameetFx.rgba(flash.color, flash.alpha);
        ctx.fillRect(0, 0, w, h);
      }
      flash.alpha *= Math.exp(-flash.decay * dt);
      return flash.alpha > 0.01;
    });
  }
}

const easeOutBack = (t) => {
  const c = 2.2;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
};

DopameetEngine.css = `
  .filter, canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .meter {
    --fever: linear-gradient(90deg, #ff3b3b, #ff9f1a, #ffe600, #3ddc5a, #1ad1ff, #5b6cff, #c850ff, #ff3b3b);
    position: absolute;
    right: 2.4vmin;
    bottom: 2.4vmin;
    box-sizing: border-box;
    width: 18em;
    display: flex;
    align-items: center;
    gap: 0.7em;
    padding: 0.7em 0.95em 0.7em 0.75em;
    border: var(--border);
    border-radius: 1.2em;
    background: var(--bg);
    color: var(--fg);
    font: 700 clamp(12px, 1.7vmin, 22px) / 1.25 var(--font, system-ui, sans-serif);
    box-shadow: 0 0.6em 1.8em rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(12px);
    opacity: 0;
    transform: translateY(1.2em) scale(0.96);
    transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.25);
  }

  .meter.shown {
    opacity: 1;
    transform: none;
  }

  .face {
    width: 1.25em;
    font: 2.1em / 1 ${DopameetFx.EMOJI_FONT};
    text-align: center;
  }

  .body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 0.4em;
  }

  .track {
    position: relative;
    height: 0.75em;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
  }

  .up, .down {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 50%;
    transform: scaleX(0);
    transition: opacity 0.3s;
  }

  .up {
    left: 50%;
    transform-origin: left center;
    background: var(--pos);
  }

  .down {
    right: 50%;
    transform-origin: right center;
    background: var(--neg);
  }

  .zero {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    margin-left: -1px;
    background: var(--fg);
    opacity: 0.45;
  }

  .fever .track {
    background: var(--fever);
    background-size: 200% 100%;
    animation: flow 1.1s linear infinite;
  }

  .fever .up, .fever .down, .fever .zero {
    opacity: 0;
  }

  .timer {
    height: 0.2em;
    margin-top: -0.2em;
    border-radius: 999px;
    background: var(--fg);
    transform-origin: left center;
    transform: scaleX(0);
    opacity: 0;
  }

  .fever .timer {
    opacity: 0.85;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
  }

  .caption {
    min-width: 0;
    overflow: hidden;
    font-size: 0.78em;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pips {
    display: flex;
    flex: none;
    gap: 0.28em;
  }

  .pips i {
    width: 0.45em;
    height: 0.45em;
    border-radius: 50%;
    background: var(--fg);
    opacity: 0.25;
    transition: opacity 0.2s, transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.6), background 0.2s;
  }

  .pips i.on {
    opacity: 1;
    background: var(--accent);
    transform: scale(1.3);
  }

  .fever .pips i {
    opacity: 0;
  }

  @keyframes flow {
    to { background-position: -200% 0; }
  }

  .meter[data-theme="simple"] {
    --bg: rgba(18, 18, 22, 0.72);
    --fg: #fff;
    --track: rgba(255, 255, 255, 0.14);
    --pos: linear-gradient(90deg, #ffd36b, #ff8a3d);
    --neg: linear-gradient(270deg, #8494b8, #2a3142);
    --accent: #ffd36b;
    --border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .meter[data-theme="party"] {
    --bg: linear-gradient(135deg, #ff2d95, #7b2dff);
    --fg: #fff;
    --track: rgba(0, 0, 0, 0.28);
    --pos: linear-gradient(90deg, #ffe600, #3ddc5a, #1ad1ff);
    --neg: linear-gradient(270deg, #555, #000);
    --accent: #ffe600;
    --border: 3px solid #fff;
    rotate: -2deg;
  }

  .meter[data-theme="party"].fever {
    animation: shake 0.22s linear infinite;
  }

  @keyframes shake {
    0%, 100% { translate: 0 0; }
    25% { translate: 0.12em -0.1em; }
    50% { translate: -0.1em 0.12em; }
    75% { translate: 0.1em 0.08em; }
  }

  .meter[data-theme="halloween"] {
    --fever: linear-gradient(90deg, #ff7a00, #9b3dd6, #7cff6b, #ff7a00);
    --bg: linear-gradient(160deg, rgba(44, 16, 64, 0.92), rgba(14, 6, 22, 0.94));
    --fg: #ffb347;
    --track: rgba(255, 140, 0, 0.16);
    --pos: linear-gradient(90deg, #ff7a00, #ffc46b);
    --neg: linear-gradient(270deg, #7b3aa6, #120818);
    --accent: #7cff6b;
    --border: 1px solid rgba(255, 122, 0, 0.55);
    --font: "Chalkduster", system-ui, sans-serif;
  }

  @media (prefers-reduced-motion: reduce) {
    .meter, .meter.fever, .fever .track {
      animation: none;
      transition: opacity 0.4s ease;
    }
  }
`;
