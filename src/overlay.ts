import { callStore, moodStore, settingsStore } from "./mood";
import { createStage } from "./stage";

const start = () => {
  const stage = createStage();
  settingsStore.subscribe(stage.setSettings);
  callStore.subscribe(stage.setCall);
  moodStore.subscribe(stage.setMood);
};

if (window.top === window) start();
