import { context } from "esbuild";

const port = Number(process.env.PORT ?? 8000);

const ctx = await context({
  entryPoints: { panel: "src/play/panel.ts", slide: "src/play/slide.ts" },
  outdir: "play/assets",
  bundle: true,
  format: "iife",
  target: "chrome114",
  loader: { ".css": "text" },
  sourcemap: "inline",
  write: false,
  logLevel: "info",
});

await ctx.watch();
await ctx.serve({ servedir: "play", port });
