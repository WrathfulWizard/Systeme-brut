import { contextBridge } from "electron";

// Nothing privileged is exposed yet — the game is self-contained. This bridge
// exists so future save-game / settings IPC has a vetted, minimal surface.
contextBridge.exposeInMainWorld("ashbound", {
  platform: process.platform,
  version: "0.0.1",
});
