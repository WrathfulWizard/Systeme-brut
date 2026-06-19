import { app, BrowserWindow } from "electron";
import * as path from "node:path";

// Ashbound desktop shell. The game itself runs entirely in the renderer
// (Phaser); this process only owns the window and OS integration.

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: "#07060a",
    title: "Ashbound",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The renderer is fully local; sandbox keeps it honest.
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));

  if (isDev && process.env.ASHBOUND_DEVTOOLS) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  if (process.env.ASHBOUND_SMOKE) runSmoke(win);
}

// Headless boot verification (xvfb). Loads the real renderer, then inspects the
// window flags the game sets to confirm it reached the world without throwing.
function runSmoke(win: BrowserWindow): void {
  const finish = (code: number): void => {
    try {
      win.destroy();
    } catch {
      /* already gone */
    }
    app.exit(code);
  };
  win.webContents.on("console-message", (_e, level, msg) => {
    if (level >= 2) console.log("[renderer]", msg);
  });
  win.webContents.on("render-process-gone", (_e, d) => {
    console.error("[smoke] render process gone:", d.reason);
    finish(2);
  });
  win.webContents.once("did-finish-load", () => {
    setTimeout(async () => {
      try {
        const raw = await win.webContents.executeJavaScript(
          "JSON.stringify(window.__ashbound||{})",
        );
        const st = JSON.parse(raw || "{}");
        if (st.error) {
          console.error("[smoke] renderer threw:", st.error);
          finish(3);
        } else if (st.booted) {
          console.log("[smoke] renderer booted to Game scene OK");
          finish(0);
        } else {
          console.error("[smoke] renderer never reached Game scene");
          finish(4);
        }
      } catch (err) {
        console.error("[smoke] eval failed:", err);
        finish(5);
      }
    }, 4000);
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
