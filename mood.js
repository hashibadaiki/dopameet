const MeetMood = (() => {
  const STORAGE_KEY = "mood";
  const LIMIT = 100;
  const HALF_LIFE_MS = 45_000;
  const GOOD_STEP = 8;
  const BAD_STEP = 12;
  const RAINBOW_COUNT = 6;
  const RAINBOW_WINDOW_MS = 10_000;
  const RAINBOW_MS = 10_000;
  const GOOD = new Set(["💖", "❤", "👍", "🎉", "👏", "😂", "😮"]);
  const BAD = new Set(["👎"]);

  const initialState = () => ({
    score: 0,
    at: 0,
    rainbowUntil: 0,
    goodTimes: [],
    enabled: true,
  });

  const normalize = (text) =>
    text.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, "").trim();

  const classify = (text) => {
    const emoji = normalize(text);
    if (GOOD.has(emoji)) return "good";
    if (BAD.has(emoji)) return "bad";
    return null;
  };

  const scoreAt = (state, now) =>
    state.score * 0.5 ** (Math.max(0, now - state.at) / HALF_LIFE_MS);

  const clamp = (value) => Math.max(-LIMIT, Math.min(LIMIT, value));

  const react = (state, kind, now) => {
    const current = scoreAt(state, now);
    if (kind === "bad") {
      return { ...state, score: clamp(current - BAD_STEP), at: now };
    }
    const goodTimes = [
      ...state.goodTimes.filter((time) => now - time < RAINBOW_WINDOW_MS),
      now,
    ];
    const burst = goodTimes.length >= RAINBOW_COUNT;
    return {
      ...state,
      score: clamp(current + GOOD_STEP),
      at: now,
      goodTimes: burst ? [] : goodTimes,
      rainbowUntil: burst ? now + RAINBOW_MS : state.rainbowUntil,
    };
  };

  const load = async () => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return { ...initialState(), ...stored[STORAGE_KEY] };
  };

  const save = (state) => chrome.storage.local.set({ [STORAGE_KEY]: state });

  let queue = Promise.resolve();
  const update = (change) => {
    queue = queue
      .then(async () => save(change(await load())))
      .catch((error) => console.warn("[dopagaki-meet]", error));
    return queue;
  };

  const subscribe = (listener) => {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[STORAGE_KEY]) {
        listener({ ...initialState(), ...changes[STORAGE_KEY].newValue });
      }
    });
    load().then(listener);
  };

  return {
    LIMIT,
    RAINBOW_MS,
    initialState,
    normalize,
    classify,
    scoreAt,
    react,
    update,
    subscribe,
  };
})();
