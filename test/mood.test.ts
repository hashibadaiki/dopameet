import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import {
  DEFAULT_TUNING,
  LIMIT,
  classify,
  initialMood,
  isRainbow,
  react,
  restart,
  scoreAt,
  setSinking,
  setTuning,
  type Mood,
} from "../src/mood.ts";

const T0 = 1_000_000;
const { goodStep, badStep, halfLifeMs, sinkPerSec, rainbowAt } = DEFAULT_TUNING;

const press = (mood: Mood, emoji: string, times: number, at = T0, gapMs = 100) => {
  let next = mood;
  for (let i = 0; i < times; i++) {
    const kind = classify(emoji);
    assert.ok(kind);
    next = react(next, emoji, kind, at + i * gapMs);
  }
  return next;
};

const atScore = (score: number, sinking = false): Mood => ({
  ...initialMood(),
  score,
  at: T0,
  sinking,
});

const seconds = (s: number) => T0 + s * 1000;

beforeEach(() => setTuning({ ...DEFAULT_TUNING }));

describe("classify", () => {
  test("good と bad を見分け、肌色や異体字セレクタは無視する", () => {
    assert.equal(classify("👍"), "good");
    assert.equal(classify("👍🏽"), "good");
    assert.equal(classify("❤️"), "good");
    assert.equal(classify("👎"), "bad");
    assert.equal(classify("🙂"), null);
  });
});

describe("react", () => {
  test("good で加点、bad で減点する", () => {
    const up = react(initialMood(), "👍", "good", T0);
    assert.equal(up.score, goodStep);
    assert.equal(react(up, "👎", "bad", T0).score, goodStep - badStep);
  });

  test("±LIMIT を超えない", () => {
    assert.equal(press(initialMood(), "👎", 30).score, -LIMIT);
    assert.equal(press(atScore(LIMIT), "👍", 3).score, LIMIT);
  });

  test("いまの値に加点する", () => {
    const mood = react(atScore(0, true), "👍", "good", seconds(10));
    assert.equal(mood.score, -10 * sinkPerSec + goodStep);
  });
});

describe("通話中（sinking）", () => {
  test("何もしなければ 0 を通り過ぎて下がり続ける", () => {
    const mood = atScore(20, true);
    assert.equal(scoreAt(mood, seconds(10)), 20 - 10 * sinkPerSec);
    assert.ok(scoreAt(mood, seconds(40)) < 0);
  });

  test("最低で止まる", () => {
    assert.equal(scoreAt(atScore(0, true), seconds(10_000)), -LIMIT);
  });

  test("リアクションし続ければ保てる", () => {
    let mood = atScore(0, true);
    const gap = goodStep / sinkPerSec;
    for (let i = 1; i <= 20; i++) mood = react(mood, "👍", "good", seconds(i * gap));
    assert.equal(scoreAt(mood, seconds(20 * gap)), 0);
  });
});

describe("通話外", () => {
  test("半減期ごとに 0 へ半分ずつ戻る", () => {
    assert.equal(scoreAt(atScore(80), T0 + halfLifeMs), 40);
    assert.equal(scoreAt(atScore(-80), T0 + halfLifeMs * 2), -20);
  });
});

describe("通話の切り替え", () => {
  test("restart は 0 から始め、seq を引き継ぐ", () => {
    const before = press(atScore(-60, true), "👎", 3);
    const after = restart(before, false, seconds(5));
    assert.equal(after.score, 0);
    assert.equal(after.sinking, false);
    assert.equal(after.seq, before.seq);
    assert.equal(scoreAt(after, seconds(500)), 0);
  });

  test("setSinking はいまの値を保ったまま切り替える", () => {
    const mood = setSinking(atScore(50, true), false, seconds(10));
    assert.equal(mood.score, 50 - 10 * sinkPerSec);
    assert.equal(scoreAt(mood, seconds(10) + halfLifeMs), mood.score / 2);
  });
});

describe("rainbow", () => {
  test("rainbowAt 以上ならレインボー、未満なら違う", () => {
    assert.equal(isRainbow(rainbowAt), true);
    assert.equal(isRainbow(rainbowAt - 0.1), false);
  });

  test("一番下から good を 6 回押してもレインボーにならない", () => {
    const mood = press(atScore(-LIMIT, true), "👍", 6);
    assert.equal(isRainbow(scoreAt(mood, T0 + 500)), false);
  });

  test("レインボーでも放置すると抜ける", () => {
    const mood = atScore(LIMIT, true);
    assert.equal(isRainbow(scoreAt(mood, T0)), true);
    const leaveAfter = (LIMIT - rainbowAt) / sinkPerSec;
    assert.equal(isRainbow(scoreAt(mood, seconds(leaveAfter + 0.1))), false);
  });
});
