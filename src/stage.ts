import { Engine } from "./engine";
import { CALL_TTL_MS, defaultSettings, type Call, type Mood, type Settings } from "./mood";
import css from "./overlay.css";
import { normal } from "./themes/normal";

const SYNC_MS = 15_000;
const FRESH_MS = 4_000;

export interface Stage {
  setSettings(settings: Settings): void;
  setCall(call: Call): void;
  setMood(mood: Mood): void;
}

export const createStage = (): Stage => {
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
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [sheet];
  const engine = new Engine(root);
  engine.setTheme(normal);

  let settings: Settings = defaultSettings();
  let call: Call = { at: 0 };
  let seen: number | null = null;

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
    (settings.meter === "call" && Date.now() - call.at < CALL_TTL_MS);

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

  document.addEventListener("fullscreenchange", () => {
    hide();
    sync();
  });

  setInterval(sync, SYNC_MS);

  return {
    setSettings(next) {
      settings = next;
      sync();
    },

    setCall(next) {
      call = next;
      sync();
    },

    setMood(next) {
      const now = Date.now();
      const last = seen;
      const fresh =
        last === null
          ? []
          : next.events.filter((event) => event.id > last && now - event.at < FRESH_MS);
      seen = next.seq;
      engine.setMood(next);
      if (!settings.enabled) return;
      engine.wake();
      sync();
      for (const event of fresh) engine.reaction(event);
    },
  };
};
