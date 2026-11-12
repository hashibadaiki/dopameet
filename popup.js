const REACTIONS = ["💖", "👍", "🎉", "👏", "😂", "😮", "👎"];

const enabled = document.getElementById("enabled");
const themeList = document.getElementById("themes");
const meter = document.getElementById("meter");
const callNote = document.getElementById("call");
const needle = document.getElementById("needle");
const status = document.getElementById("status");

let mood = Dopameet.initialMood();
let call = { at: 0 };

for (const theme of Dopameet.themes.values()) {
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
    Dopameet.settings.update((current) => ({ ...current, theme: theme.id })),
  );
}

for (const emoji of REACTIONS) {
  const button = document.createElement("button");
  button.textContent = emoji;
  button.addEventListener("click", () =>
    Dopameet.mood.update((current) =>
      Dopameet.react(current, emoji, Dopameet.classify(emoji), Date.now()),
    ),
  );
  document.getElementById("reactions").append(button);
}

const render = () => {
  const now = Date.now();
  const score = Dopameet.scoreAt(mood, now);
  const fever = now < mood.rainbowUntil;
  needle.style.left = `${50 + (score / Dopameet.LIMIT) * 50}%`;
  status.textContent = `テンション ${Math.round(score)}${fever ? "　フィーバー中" : ""}`;
  const inCall = now - call.at < Dopameet.CALL_TTL_MS;
  callNote.textContent = inCall
    ? "Meet の通話を検出しています"
    : "Meet の通話は検出されていません";
};

Dopameet.settings.subscribe((settings) => {
  enabled.checked = settings.enabled;
  meter.value = settings.meter;
  for (const input of themeList.querySelectorAll("input")) {
    input.checked = input.value === settings.theme;
  }
});

Dopameet.mood.subscribe((next) => {
  mood = next;
  render();
});

Dopameet.call.subscribe((next) => {
  call = next;
  render();
});

setInterval(render, 250);

enabled.addEventListener("change", () =>
  Dopameet.settings.update((current) => ({ ...current, enabled: enabled.checked })),
);

meter.addEventListener("change", () =>
  Dopameet.settings.update((current) => ({ ...current, meter: meter.value })),
);

document.getElementById("rainbow").addEventListener("click", () =>
  Dopameet.mood.update((current) => ({
    ...current,
    rainbowUntil: Date.now() + Dopameet.RAINBOW_MS,
  })),
);

document.getElementById("reset").addEventListener("click", () =>
  Dopameet.mood.update(() => Dopameet.initialMood()),
);
