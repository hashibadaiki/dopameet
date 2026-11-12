import {
  CALL_TTL_MS,
  LIMIT,
  callStore,
  classify,
  initialMood,
  isRainbow,
  moodStore,
  react,
  restart,
  scoreAt,
  settingsStore,
  type Call,
  type MeterMode,
  type Mood,
} from "./mood";

const REACTIONS = ["💖", "👍", "🎉", "👏", "😂", "😮", "👎"];

const byId = <T extends HTMLElement>(id: string, type: new () => T) => {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`#${id} is missing`);
  return element;
};

const enabled = byId("enabled", HTMLInputElement);
const meter = byId("meter", HTMLSelectElement);
const callNote = byId("call", HTMLParagraphElement);
const needle = byId("needle", HTMLDivElement);
const status = byId("status", HTMLParagraphElement);
const reactions = byId("reactions", HTMLDivElement);

let mood: Mood = initialMood();
let call: Call = { at: 0 };

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
  needle.style.left = `${50 + (score / LIMIT) * 50}%`;
  status.textContent = `テンション ${Math.round(score)}${isRainbow(score) ? "　レインボー" : ""}`;
  callNote.textContent =
    now - call.at < CALL_TTL_MS
      ? "Meet の通話を検出しています"
      : "Meet の通話は検出されていません";
};

settingsStore.subscribe((settings) => {
  enabled.checked = settings.enabled;
  meter.value = settings.meter;
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

byId("reset", HTMLButtonElement).addEventListener("click", () =>
  moodStore.update((current) => restart(current, current.sinking, Date.now())),
);
