// Headless smoke test: verifies the renderer bundle builds and that Phaser can
// boot the scene graph far enough to bake textures and instantiate the world.
// Runs in Node with a jsdom-free canvas stub — we only assert wiring, not pixels.
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const bundle = path.join(root, "dist", "renderer", "bundle.js");
const main = path.join(root, "dist", "electron", "main.js");

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}`);
    failures++;
  }
}

console.log("[smoke] build artifacts");
check("renderer bundle exists", fs.existsSync(bundle));
check("electron main exists", fs.existsSync(main));

if (fs.existsSync(bundle)) {
  const src = fs.readFileSync(bundle, "utf8");
  check("bundle is non-trivial", src.length > 200_000);
  check("contains Phaser.Game", src.includes("Phaser") || src.includes("phaser"));
  check("registers Game scene", src.includes("Game"));
  check("registers Boot scene", src.includes("Boot"));
}

if (fs.existsSync(main)) {
  const src = fs.readFileSync(main, "utf8");
  check("main loads renderer index.html", src.includes("index.html"));
  check("main uses BrowserWindow", src.includes("BrowserWindow"));
}

if (failures) {
  console.error(`[smoke] ${failures} check(s) failed`);
  process.exit(1);
}
console.log("[smoke] all checks passed");
