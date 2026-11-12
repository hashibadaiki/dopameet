import { build } from "esbuild";
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";

const chrome =
  process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9333;
const outdir = resolve("store/images");

const SCREENSHOTS = [
  { name: "screenshot-1-hype", score: 70 },
  { name: "screenshot-2-rainbow", score: 95 },
  { name: "screenshot-3-gloom", score: -60 },
  { name: "screenshot-4-end", score: -100 },
];

const TILES = [
  { name: "promo-small", size: "small", width: 440, height: 280 },
  { name: "promo-marquee", size: "marquee", width: 1400, height: 560 },
];

const connect = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
      const { webSocketDebuggerUrl } = (await response.json()) as { webSocketDebuggerUrl: string };
      const socket = new WebSocket(webSocketDebuggerUrl);
      await new Promise((ready) => socket.addEventListener("open", ready, { once: true }));
      return socket;
    } catch {
      await sleep(200);
    }
  }
  throw new Error("Chrome に接続できませんでした");
};

const client = (socket: WebSocket) => {
  let id = 0;
  const pending = new Map<number, (result: Record<string, unknown>) => void>();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown> };
    if (message.id !== undefined) pending.get(message.id)?.(message.result ?? {});
  });
  return (method: string, params: Record<string, unknown> = {}) =>
    new Promise<Record<string, unknown>>((done) => {
      pending.set(++id, done);
      socket.send(JSON.stringify({ id, method, params }));
    });
};

const work = await mkdtemp(join(tmpdir(), "dopameet-store-"));
const browser = spawn(chrome, [
  "--headless",
  "--hide-scrollbars",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${join(work, "profile")}`,
]);

try {
  await build({
    entryPoints: { shot: "src/play/shot.ts" },
    outdir: join(work, "assets"),
    bundle: true,
    format: "iife",
    target: "chrome114",
    loader: { ".css": "text" },
    logLevel: "warning",
  });
  await copyFile("play/slide.css", join(work, "slide.css"));
  const html = await readFile("play/slide.html", "utf8");
  await writeFile(join(work, "shot.html"), html.replace("assets/slide.js", "assets/shot.js"));
  await mkdir(outdir, { recursive: true });

  const send = client(await connect());

  const capture = async (url: URL, name: string, width: number, height: number, waitMs: number) => {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: url.href });
    await sleep(waitMs);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(join(outdir, `${name}.png`), Buffer.from(String(data), "base64"));
    console.log(`${name}.png`);
  };

  for (const { name, score } of SCREENSHOTS) {
    const url = pathToFileURL(join(work, "shot.html"));
    url.search = `?score=${score}`;
    await capture(url, name, 1280, 800, 6000);
  }

  for (const { name, size, width, height } of TILES) {
    const url = pathToFileURL(resolve("store/tile.html"));
    url.search = `?size=${size}`;
    await capture(url, name, width, height, 2000);
  }
} finally {
  const exited = new Promise((done) => browser.once("exit", done));
  browser.kill();
  await exited;
  await rm(work, { recursive: true, force: true });
}
