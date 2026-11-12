import { DEFAULT_TUNING, initialMood, setTuning } from "../mood";
import { createStage } from "../stage";

const params = new URLSearchParams(location.search);
const score = Number(params.get("score") ?? 0);
const now = Date.now();

document.body.dataset.bg = params.get("bg") ?? "slide";
setTuning({ ...DEFAULT_TUNING, sinkPerSec: 0 });

const stage = createStage();
stage.setSettings({ enabled: true, meter: "always" });
stage.setCall({ at: now });
stage.setMood({ ...initialMood(), score, at: now, sinking: true });
