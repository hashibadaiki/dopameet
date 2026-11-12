import {
  DEFAULT_TUNING,
  LIMIT,
  classify,
  defaultSettings,
  initialMood,
  isRainbow,
  react,
  restart,
  scoreAt,
  setTuning,
  tuning,
  type MeterMode,
  type Tuning,
} from "../mood";
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
  { key: "sinkPerSec", label: "通話中に 1 秒で下がる量", min: 0, max: 5, step: 0.1 },
  { key: "halfLifeMs", label: "通話外で 0 に戻る半減期", min: 3, max: 90, step: 1, seconds: true },
  { key: "goodStep", label: "👍 1 回の加点", min: 1, max: 40, step: 1 },
  { key: "badStep", label: "👎 1 回の減点", min: 1, max: 50, step: 1 },
  { key: "rainbowAt", label: "レインボーになるテンション", min: 60, max: 100, step: 1 },
];

const byId = <T extends HTMLElement>(id: string, type: new () => T) => {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} is missing`);
  return element;
};

const frame = byId("slide", HTMLIFrameElement);
const enabled = byId("enabled", HTMLInputElement);
const inCall = byId("in-call", HTMLInputElement);
const meter = byId("meter", HTMLSelectElement);
const background = byId("background", HTMLSelectElement);
const reactions = byId("reactions", HTMLDivElement);
const knobList = byId("tuning", HTMLDivElement);
const recovery = byId("recovery", HTMLParagraphElement);
const needle = byId("needle", HTMLDivElement);
const status = byId("status", HTMLParagraphElement);

interface Saved {
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
  },
  call: { at: 0 },
  mood: initialMood(),
  tuning: { ...tuning },
  background: saved.background ?? "slide",
};

const save = () => {
  const value: Saved = {
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

const jump = (score: number) => {
  state.mood = { ...state.mood, score, at: Date.now() };
  send();
};

const reset = () => {
  state.mood = restart(state.mood, inCall.checked, Date.now());
  send();
};

const describeRecovery = () => {
  recovery.textContent =
    tuning.sinkPerSec > 0
      ? `通話中は何もしないと 0 から最低まで約 ${Math.round(LIMIT / tuning.sinkPerSec)} 秒`
      : "通話中も下がらない";
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
state.mood = restart(state.mood, inCall.checked, Date.now());

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

inCall.addEventListener("change", () => {
  state.mood = restart(state.mood, inCall.checked, Date.now());
  beat();
});
beat();
setInterval(() => {
  if (inCall.checked) beat();
}, HEARTBEAT_MS);

byId("burst-good", HTMLButtonElement).addEventListener("click", () =>
  repeat("👍", 6, 150),
);
byId("burst-bad", HTMLButtonElement).addEventListener("click", () => repeat("👎", 3, 300));
byId("max", HTMLButtonElement).addEventListener("click", () => jump(LIMIT));
byId("min", HTMLButtonElement).addEventListener("click", () => jump(-LIMIT));
byId("reset", HTMLButtonElement).addEventListener("click", reset);

addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
  if (event.target instanceof HTMLSelectElement) return;
  if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
  const emoji = REACTIONS[Number(event.key) - 1];
  if (emoji) fire(emoji);
  else if (event.key === "r") reset();
  else if (event.key === "ArrowUp") jump(LIMIT);
  else if (event.key === "ArrowDown") jump(-LIMIT);
  else return;
  event.preventDefault();
});

const render = () => {
  const now = Date.now();
  const score = scoreAt(state.mood, now);
  needle.style.left = `${50 + (score / LIMIT) * 50}%`;
  status.textContent = [
    `テンション ${score.toFixed(1)}`,
    isRainbow(score) ? "レインボー" : `レインボーまで ${(tuning.rainbowAt - score).toFixed(1)}`,
  ].join("　");
  requestAnimationFrame(render);
};

render();

new EventSource("/esbuild").addEventListener("change", () => location.reload());
