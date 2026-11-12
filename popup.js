const enabled = document.getElementById("enabled");
const needle = document.getElementById("needle");
const status = document.getElementById("status");

let state = MeetMood.initialState();

const render = () => {
  const now = Date.now();
  const score = MeetMood.scoreAt(state, now);
  const isRainbow = now < state.rainbowUntil;
  enabled.checked = state.enabled;
  needle.style.left = `${50 + (score / MeetMood.LIMIT) * 50}%`;
  status.textContent = `テンション ${Math.round(score)}${isRainbow ? " 🌈" : ""}`;
};

MeetMood.subscribe((next) => {
  state = next;
  render();
});
setInterval(render, 250);

enabled.addEventListener("change", () => {
  MeetMood.update((current) => ({ ...current, enabled: enabled.checked }));
});

for (const button of document.querySelectorAll("[data-kind]")) {
  button.addEventListener("click", () => {
    MeetMood.update((current) =>
      MeetMood.react(current, button.dataset.kind, Date.now()),
    );
  });
}

document.getElementById("rainbow").addEventListener("click", () => {
  MeetMood.update((current) => ({
    ...current,
    rainbowUntil: Date.now() + MeetMood.RAINBOW_MS,
  }));
});

document.getElementById("reset").addEventListener("click", () => {
  MeetMood.update((current) => ({
    ...MeetMood.initialState(),
    enabled: current.enabled,
  }));
});
