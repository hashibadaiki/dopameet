import { build, context, type BuildOptions, type Plugin } from "esbuild";
import { watch as watchFiles } from "node:fs";
import { cp, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

const copyPublic = () => cp("public", outdir, { recursive: true });

const publicFiles: Plugin = {
  name: "public-files",
  setup(pluginBuild) {
    pluginBuild.onEnd(async (result) => {
      if (result.errors.length === 0) await copyPublic();
    });
  },
};

const options: BuildOptions = {
  entryPoints: ["src/meet.ts", "src/overlay.ts", "src/popup.ts"],
  outdir,
  bundle: true,
  format: "iife",
  target: "chrome114",
  loader: { ".css": "text" },
  sourcemap: watch ? "inline" : false,
  logLevel: "info",
  plugins: [publicFiles],
};

await rm(outdir, { recursive: true, force: true });

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  watchFiles("public", { recursive: true }, () => void copyPublic());
} else {
  await build(options);
}
