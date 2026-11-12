import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8")) as { version: string };
const pkg = JSON.parse(await readFile("package.json", "utf8")) as { version: string };

if (manifest.version !== pkg.version) {
  throw new Error(`manifest.json (${manifest.version}) と package.json (${pkg.version}) の version が違います`);
}

const out = resolve(`dopameet-${manifest.version}.zip`);
await rm(out, { force: true });
await promisify(execFile)("zip", ["-r", "-X", out, "."], { cwd: "dist" });
console.log(out);
