(() => {
  if (window.top !== window) return;

  const TICK_MS = 250;
  const IDLE_THRESHOLD = 0.01;

  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`
    div {
      position: absolute;
      inset: 0;
      transition: opacity 0.6s linear, backdrop-filter 0.6s linear, box-shadow 0.6s linear;
    }
    .dark { background: #000; opacity: 0; }
    .rainbow {
      opacity: 0;
      background: linear-gradient(
        120deg,
        #ff3b3b, #ff9f1a, #ffe600, #3ddc5a, #1ad1ff, #5b6cff, #c850ff, #ff3b3b
      );
      background-size: 300% 300%;
      animation: slide 3s linear infinite;
    }
    @keyframes slide {
      from { background-position: 0% 50%; }
      to { background-position: 150% 50%; }
    }
  `);

  const host = document.createElement("div");
  host.popover = "manual";
  host.style.cssText = [
    "position: fixed",
    "inset: 0",
    "width: 100vw",
    "height: 100vh",
    "max-width: none",
    "max-height: none",
    "margin: 0",
    "padding: 0",
    "border: 0",
    "background: transparent",
    "overflow: hidden",
    "pointer-events: none",
  ]
    .map((rule) => `${rule} !important`)
    .join("; ");

  const root = host.attachShadow({ mode: "closed" });
  root.adoptedStyleSheets = [sheet];
  const layer = (name) => {
    const element = document.createElement("div");
    element.className = name;
    root.append(element);
    return element;
  };
  const tint = layer("tint");
  const dark = layer("dark");
  const rainbow = layer("rainbow");

  let state = MeetMood.initialState();
  let timer = null;

  const show = () => {
    if (!host.isConnected) document.documentElement.append(host);
    if (!host.matches(":popover-open")) host.showPopover();
  };

  const hide = () => {
    if (host.isConnected && host.matches(":popover-open")) host.hidePopover();
  };

  const stop = () => {
    clearInterval(timer);
    timer = null;
  };

  const render = () => {
    const now = Date.now();
    const level = state.enabled
      ? MeetMood.scoreAt(state, now) / MeetMood.LIMIT
      : 0;
    const isRainbow = state.enabled && now < state.rainbowUntil;

    if (!isRainbow && Math.abs(level) < IDLE_THRESHOLD) {
      hide();
      stop();
      return;
    }

    const up = Math.max(0, level);
    const down = Math.max(0, -level);
    tint.style.backdropFilter = `saturate(${1 + up * 0.9 - down}) brightness(${1 + up * 0.15})`;
    tint.style.boxShadow = `inset 0 0 ${up * 240}px rgba(255, 196, 60, ${up * 0.7})`;
    dark.style.opacity = down;
    rainbow.style.opacity = isRainbow ? 0.4 : 0;
    show();
    if (!timer) timer = setInterval(render, TICK_MS);
  };

  document.addEventListener("fullscreenchange", () => {
    hide();
    render();
  });

  MeetMood.subscribe((next) => {
    state = next;
    render();
  });
})();
