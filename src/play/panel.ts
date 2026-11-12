import {
  DEFAULT_TUNING,
  LIMIT,
  classify,
  defaultSettings,
  initialMood,
  react,
  recentGood,
  scoreAt,
  setTuning,
  tuning,
  type MeterMode,
  type Tuning,
} from "../mood";
import { themes } from "../themes";
import { BACKGROUNDS, READY, type Background, type PlayState } from "./protocol";

const REACTIONS = ["💖", "👍", "🎉", "👏", "😂", "😮", "👎"];
const HEARTBEAT_MS = 20_000;
const SAVED_KEY = "dopameet-play";

interface Knob {
  key: keyof Tuning;
  label: string;
  min: number;
  max: number;
  step: number;
  seconds?: boolean;
}

const KNOBS: Knob[] = [
  { key: "halfLifeMs", label: "半減期", min: 3, max: 90, step: 1, seconds: true },
  { key: "goodStep", label: "👍 1 回の加点", min: 1, max: 40, step: 1 },
  { key: "badStep", label: "👎 1 回の減点", min: 1, max: 50, step: 1 },
  { key: "rainbowCount", label: "フィーバーに必要な回数", min: 2, max: 12, step: 1 },
  { key: "rainbowWindowMs", label: "回数を数える時間", min: 2, max: 30, step: 1, seconds: true },
  { key: "rainbowMs", label: "フィーバーの長さ", min: 2, max: 30, step: 1, seconds: true },
];

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
const knobList = byId("tuning", HTMLDivElement);
const recovery = byId("recovery", HTMLParagraphElement);
const needle = byId("needle", HTMLDivElement);
const status = byId("status", HTMLParagraphElement);

interface Saved {
  theme: string;
  meter: MeterMode;
  background: Background;
  inCall: boolean;
  tuning: Partial<Tuning>;
}

const load = (): Partial<Saved> => {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? "{}") as Partial<Saved>;
  } catch {
    return {};
  }
};

const saved = load();
setTuning({ ...DEFAULT_TUNING, ...saved.tuning });

const state: PlayState = {
  settings: {
    ...defaultSettings(),
    meter: saved.meter ?? "always",
    theme: saved.theme ?? defaultSettings().theme,
  },
  call: { at: 0 },
  mood: initialMood(),
  tuning: { ...tuning },
  background: saved.background ?? "slide",
};

const save = () => {
  const value: Saved = {
    theme: state.settings.theme,
    meter: state.settings.meter,
    background: state.background,
    inCall: inCall.checked,
    tuning: state.tuning,
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
  state.mood = { ...state.mood, rainbowUntil: Date.now() + tuning.rainbowMs };
  send();
};

const jump = (score: number) => {
  state.mood = { ...state.mood, score, at: Date.now() };
  send();
};

const reset = () => {
  state.mood = initialMood();
  send();
};

const describeRecovery = () => {
  const seconds = (tuning.halfLifeMs / 1000) * Math.log2(10);
  recovery.textContent = `±${LIMIT} から ±${LIMIT / 10} まで約 ${Math.round(seconds)} 秒`;
};

const knobInputs = KNOBS.map((knob) => {
  const label = document.createElement("label");
  const name = document.createElement("span");
  name.textContent = knob.label;
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(knob.min);
  input.max = String(knob.max);
  input.step = String(knob.step);
  const output = document.createElement("output");
  label.append(name, input, output);
  knobList.append(label);

  const scale = knob.seconds ? 1000 : 1;
  const show = () => {
    input.value = String(tuning[knob.key] / scale);
    output.textContent = `${input.value}${knob.seconds ? " 秒" : ""}`;
  };
  input.addEventListener("input", () => {
    setTuning({ ...tuning, [knob.key]: Number(input.value) * scale });
    state.tuning = { ...tuning };
    show();
    describeRecovery();
    send();
  });
  show();
  return show;
});

describeRecovery();

byId("tuning-reset", HTMLButtonElement).addEventListener("click", () => {
  setTuning({ ...DEFAULT_TUNING });
  state.tuning = { ...tuning };
  for (const show of knobInputs) show();
  describeRecovery();
  send();
});

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
  button.type = "button";
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
  repeat("👍", tuning.rainbowCount, 150),
);
byId("burst-bad", HTMLButtonElement).addEventListener("click", () => repeat("👎", 3, 300));
byId("max", HTMLButtonElement).addEventListener("click", () => jump(LIMIT));
byId("min", HTMLButtonElement).addEventListener("click", () => jump(-LIMIT));
byId("fever", HTMLButtonElement).addEventListener("click", fever);
byId("reset", HTMLButtonElement).addEventListener("click", reset);

addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.target instanceof HTMLSelectElement) return;
  if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
  const emoji = REACTIONS[Number(event.key) - 1];
  if (emoji) fire(emoji);
  else if (event.key === "f") fever();
  else if (event.key === "r") reset();
  else if (event.key === "ArrowUp") jump(LIMIT);
  else if (event.key === "ArrowDown") jump(-LIMIT);
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
    left > 0
      ? `フィーバー残り ${(left / 1000).toFixed(1)}s`
      : `コンボ ${combo}/${tuning.rainbowCount}`,
  ].join("　");
  requestAnimationFrame(render);
};

render();

new EventSource("/esbuild").addEventListener("change", () => location.reload());
