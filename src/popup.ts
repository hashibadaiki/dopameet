import {
  CALL_TTL_MS,
  LIMIT,
  callStore,
  classify,
  initialMood,
  moodStore,
  react,
  scoreAt,
  settingsStore,
  tuning,
  type Call,
  type MeterMode,
  type Mood,
} from "./mood";
import { themes } from "./themes";

const REACTIONS = ["💖", "👍", "🎉", "👏", "😂", "😮", "👎"];

const byId = <T extends HTMLElement>(id: string, type: new () => T) => {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} is missing`);
  return element;
};

const enabled = byId("enabled", HTMLInputElement);
const themeList = byId("themes", HTMLDivElement);
const meter = byId("meter", HTMLSelectElement);
const callNote = byId("call", HTMLParagraphElement);
const needle = byId("needle", HTMLDivElement);
const status = byId("status", HTMLParagraphElement);
const reactions = byId("reactions", HTMLDivElement);

let mood: Mood = initialMood();
let call: Call = { at: 0 };

for (const theme of themes) {
  const label = document.createElement("label");
  label.className = "theme";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "theme";
  input.value = theme.id;
  const name = document.createElement("strong");
  name.textContent = theme.label;
  const description = document.createElement("small");
  description.textContent = theme.description;
  label.append(input, name, description);
  themeList.append(label);
  input.addEventListener("change", () =>
    settingsStore.update((current) => ({ ...current, theme: theme.id })),
  );
}

for (const emoji of REACTIONS) {
  const kind = classify(emoji);
  if (!kind) continue;
  const button = document.createElement("button");
  button.textContent = emoji;
  button.addEventListener("click", () =>
    moodStore.update((current) => react(current, emoji, kind, Date.now())),
  );
  reactions.append(button);
}

const render = () => {
  const now = Date.now();
  const score = scoreAt(mood, now);
  const fever = now < mood.rainbowUntil;
  needle.style.left = `${50 + (score / LIMIT) * 50}%`;
  status.textContent = `テンション ${Math.round(score)}${fever ? "　フィーバー中" : ""}`;
  callNote.textContent =
    now - call.at < CALL_TTL_MS
      ? "Meet の通話を検出しています"
      : "Meet の通話は検出されていません";
};

settingsStore.subscribe((settings) => {
  enabled.checked = settings.enabled;
  meter.value = settings.meter;
  for (const input of themeList.querySelectorAll("input")) {
    input.checked = input.value === settings.theme;
  }
});

moodStore.subscribe((next) => {
  mood = next;
  render();
});

callStore.subscribe((next) => {
  call = next;
  render();
});

setInterval(render, 250);

enabled.addEventListener("change", () =>
  settingsStore.update((current) => ({ ...current, enabled: enabled.checked })),
);

meter.addEventListener("change", () =>
  settingsStore.update((current) => ({ ...current, meter: meter.value as MeterMode })),
);

byId("rainbow", HTMLButtonElement).addEventListener("click", () =>
  moodStore.update((current) => ({ ...current, rainbowUntil: Date.now() + tuning.rainbowMs })),
);

byId("reset", HTMLButtonElement).addEventListener("click", () =>
  moodStore.update(() => initialMood()),
);
