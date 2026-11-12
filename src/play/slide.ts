import { createStage } from "../stage";
import { READY, type PlayState } from "./protocol";

const stage = createStage();

addEventListener("message", (event: MessageEvent<PlayState>) => {
  if (event.origin !== location.origin) return;
  const { settings, call, mood, background } = event.data;
  document.body.dataset.bg = background;
  stage.setSettings(settings);
  stage.setCall(call);
  stage.setMood(mood);
});

parent.postMessage(READY, location.origin);
