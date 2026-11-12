const Dopameet = (() => {
  const LIMIT = 100;
  const HALF_LIFE_MS = 45_000;
  const GOOD_STEP = 8;
  const BAD_STEP = 12;
  const RAINBOW_COUNT = 6;
  const RAINBOW_WINDOW_MS = 10_000;
  const RAINBOW_MS = 10_000;
  const CALL_TTL_MS = 150_000;
  const MAX_EVENTS = 12;
  const GOOD = new Set(["💖", "❤", "👍", "🎉", "👏", "😂", "😮"]);
  const BAD = new Set(["👎"]);

  const normalize = (text) =>
    text.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, "").trim();

  const classify = (text) => {
    const emoji = normalize(text);
    if (GOOD.has(emoji)) return "good";
    if (BAD.has(emoji)) return "bad";
    return null;
  };

  const clamp = (value) => Math.max(-LIMIT, Math.min(LIMIT, value));

  const scoreAt = (mood, now) =>
    mood.score * 0.5 ** (Math.max(0, now - mood.at) / HALF_LIFE_MS);

  const recentGood = (mood, now) =>
    mood.goodTimes.filter((time) => now - time < RAINBOW_WINDOW_MS);

  const initialMood = () => ({
    score: 0,
    at: 0,
    rainbowUntil: 0,
    goodTimes: [],
    events: [],
    seq: 0,
  });

  const react = (mood, emoji, kind, now) => {
    const seq = mood.seq + 1;
    const events = [...mood.events, { id: seq, emoji, kind, at: now }].slice(
      -MAX_EVENTS,
    );
    const current = scoreAt(mood, now);
    if (kind === "bad") {
      return { ...mood, score: clamp(current - BAD_STEP), at: now, seq, events };
    }
    const goodTimes = [...recentGood(mood, now), now];
    const burst = goodTimes.length >= RAINBOW_COUNT;
    return {
      ...mood,
      score: clamp(current + GOOD_STEP),
      at: now,
      seq,
      events,
      goodTimes: burst ? [] : goodTimes,
      rainbowUntil: burst ? now + RAINBOW_MS : mood.rainbowUntil,
    };
  };

  const store = (key, initial) => {
    const read = async () => {
      const stored = await chrome.storage.local.get(key);
      return { ...initial(), ...stored[key] };
    };

    let queue = Promise.resolve();
    const update = (change) => {
      queue = queue
        .then(async () =>
          chrome.storage.local.set({ [key]: change(await read()) }),
        )
        .catch((error) => console.warn("[dopameet]", error));
      return queue;
    };

    const subscribe = (listener) => {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[key]) {
          listener({ ...initial(), ...changes[key].newValue });
        }
      });
      read().then(listener);
    };

    return { read, update, subscribe };
  };

  const defaultSettings = () => ({
    enabled: true,
    theme: "simple",
    meter: "call",
  });

  const themes = new Map();
  const defineTheme = (theme) => themes.set(theme.id, theme);

  return {
    LIMIT,
    RAINBOW_COUNT,
    RAINBOW_MS,
    CALL_TTL_MS,
    normalize,
    classify,
    scoreAt,
    recentGood,
    initialMood,
    react,
    defaultSettings,
    mood: store("mood", initialMood),
    settings: store("settings", defaultSettings),
    call: store("call", () => ({ at: 0 })),
    themes,
    defineTheme,
  };
})();
