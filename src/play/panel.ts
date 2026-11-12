import {
  LIMIT,
  RAINBOW_COUNT,
  RAINBOW_MS,
  classify,
  defaultSettings,
  initialMood,
  react,
  recentGood,
  scoreAt,
  type MeterMode,
} from "../mood";
import { themes } from "../themes";
import { BACKGROUNDS, READY, type Background, type PlayState } from "./protocol";

const REACTIONS = ["💖", "👍", "🎉", "👏", "😂", "😮", "👎"];
const HEARTBEAT_MS = 20_000;
const SAVED_KEY = "dopameet-play";

const byId = <T extends HTMLElement>(id: string, type: new () => T) => {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} is missing`);
  return element;
};

const frame = byId("slide", HTMLIFrameElement);
const enabled = byId("enabled", HTMLInputElement);
const inCall = byId("in-call", HTMLInputElement);
const themeList = byId("themes", HTMLFieldSetElement);
const meter = byId("meter", HTMLSelectElement);
const background = byId("background", HTMLSelectElement);
const reactions = byId("reactions", HTMLDivElement);
const needle = byId("needle", HTMLDivElement);
const status = byId("status", HTMLParagraphElement);

interface Saved {
  theme: string;
  meter: MeterMode;
  background: Background;
  inCall: boolean;
}

const load = (): Partial<Saved> => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Partial<Saved>;
  } catch {
    return {};
  }
};

const saved = load();

const state: PlayState = {
  settings: {
    ...defaultSettings(),
    meter: saved.meter ?? "always",
    theme: saved.theme ?? defaultSettings().theme,
  },
  call: { at: 0 },
  mood: initialMood(),
  background: saved.background ?? "slide",
};

const save = () => {
  const value: Saved = {
    theme: state.settings.theme,
    meter: state.settings.meter,
    background: state.background,
    inCall: inCall.checked,
  };
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(value));
  } catch {}
};

let ready = false;

const send = () => {
  save();
  if (ready) frame.contentWindow?.postMessage(state, location.origin);
};

addEventListener("message", (event) => {
  if (event.origin !== location.origin || event.data !== READY) return;
  ready = true;
  send();
});

const fire = (emoji: string) => {
  const kind = classify(emoji);
  if (!kind) return;
  state.mood = react(state.mood, emoji, kind, Date.now());
  send();
};

const repeat = (emoji: string, times: number, gapMs: number) => {
  for (let i = 0; i < times; i++) setTimeout(() => fire(emoji), i * gapMs);
};

const fever = () => {
  state.mood = { ...state.mood, rainbowUntil: Date.now() + RAINBOW_MS };
  send();
};

const reset = () => {
  state.mood = initialMood();
  send();
};

for (const theme of themes) {
  const label = document.createElement("label");
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "theme";
  input.value = theme.id;
  input.checked = theme.id === state.settings.theme;
  label.append(input, theme.label);
  themeList.append(label);
  input.addEventListener("change", () => {
    state.settings = { ...state.settings, theme: theme.id };
    send();
  });
}

REACTIONS.forEach((emoji, index) => {
  const button = document.createElement("button");
  button.textContent = emoji;
  button.title = `キー ${index + 1}`;
  button.addEventListener("click", () => fire(emoji));
  reactions.append(button);
});

for (const [value, label] of Object.entries(BACKGROUNDS)) {
  background.append(new Option(label, value));
}

meter.value = state.settings.meter;
background.value = state.background;
inCall.checked = saved.inCall ?? true;

enabled.addEventListener("change", () => {
  state.settings = { ...state.settings, enabled: enabled.checked };
  send();
});

meter.addEventListener("change", () => {
  state.settings = { ...state.settings, meter: meter.value as MeterMode };
  send();
});

background.addEventListener("change", () => {
  state.background = background.value as Background;
  send();
});

const beat = () => {
  state.call = { at: inCall.checked ? Date.now() : 0 };
  send();
};

inCall.addEventListener("change", beat);
beat();
setInterval(() => {
  if (inCall.checked) beat();
}, HEARTBEAT_MS);

byId("burst-good", HTMLButtonElement).addEventListener("click", () =>
  repeat("👍", RAINBOW_COUNT, 150),
);
byId("burst-bad", HTMLButtonElement).addEventListener("click", () => repeat("👎", 3, 300));
byId("fever", HTMLButtonElement).addEventListener("click", fever);
byId("reset", HTMLButtonElement).addEventListener("click", reset);

addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.target instanceof HTMLSelectElement) return;
  const emoji = REACTIONS[Number(event.key) - 1];
  if (emoji) fire(emoji);
  else if (event.key === "f") fever();
  else if (event.key === "r") reset();
  else return;
  event.preventDefault();
});

const render = () => {
  const now = Date.now();
  const score = scoreAt(state.mood, now);
  const left = Math.max(0, state.mood.rainbowUntil - now);
  const combo = recentGood(state.mood, now).length;
  needle.style.left = `${50 + (score / LIMIT) * 50}%`;
  status.textContent = [
    `テンション ${score.toFixed(1)}`,
    left > 0 ? `フィーバー残り ${(left / 1000).toFixed(1)}s` : `コンボ ${combo}/${RAINBOW_COUNT}`,
  ].join("　");
  requestAnimationFrame(render);
};

render();

new EventSource("/esbuild").addEventListener("change", () => location.reload());
