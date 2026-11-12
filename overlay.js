(() => {
  if (window.top !== window) return;

  const SYNC_MS = 15_000;
  const FRESH_MS = 4_000;

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
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(DopameetEngine.css);
  root.adoptedStyleSheets = [sheet];
  const engine = new DopameetEngine(root);

  let settings = Dopameet.defaultSettings();
  let call = { at: 0 };
  let seen = null;
  let rainbowUntil = null;

  const isOpen = () => host.isConnected && host.matches(":popover-open");

  const show = () => {
    if (!host.isConnected) document.documentElement.append(host);
    if (!isOpen()) host.showPopover();
  };

  const hide = () => {
    if (isOpen()) host.hidePopover();
  };

  const meterWanted = () =>
    settings.meter === "always" ||
    (settings.meter === "call" && Date.now() - call.at < Dopameet.CALL_TTL_MS);

  const sync = () => {
    if (!settings.enabled) {
      engine.stop();
      engine.meter.setVisible(false);
      hide();
      return;
    }
    const meter = meterWanted();
    engine.meter.setVisible(meter);
    if (meter || engine.running) show();
    else hide();
  };

  engine.onSleep = sync;

  Dopameet.settings.subscribe((next) => {
    settings = next;
    const theme =
      Dopameet.themes.get(next.theme) ?? Dopameet.themes.get("simple");
    engine.setTheme(theme);
    sync();
  });

  Dopameet.call.subscribe((next) => {
    call = next;
    sync();
  });

  Dopameet.mood.subscribe((next) => {
    const now = Date.now();
    const fresh =
      seen === null
        ? []
        : next.events.filter((event) => event.id > seen && now - event.at < FRESH_MS);
    const feverStarted =
      rainbowUntil !== null &&
      next.rainbowUntil !== rainbowUntil &&
      next.rainbowUntil > now;
    seen = next.seq;
    rainbowUntil = next.rainbowUntil;
    engine.setMood(next);
    if (!settings.enabled) return;
    engine.wake();
    sync();
    for (const event of fresh) engine.reaction(event);
    if (feverStarted) engine.rainbowStart();
  });

  document.addEventListener("fullscreenchange", () => {
    hide();
    sync();
  });

  setInterval(sync, SYNC_MS);
})();
