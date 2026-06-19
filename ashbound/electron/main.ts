import { app, BrowserWindow } from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

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
    // Drive synthetic input so combat / menu / interaction paths run too.
    const sim = `
      (function(){
        var K={J:74,SPACE:32,Q:81,TAB:9,E:69,W:87,S:83,D:68,A:65};
        function press(code){
          var kc=K[code];
          ['keydown','keyup'].forEach(function(t){
            window.dispatchEvent(new KeyboardEvent(t,{key:code,code:code,keyCode:kc,which:kc,bubbles:true}));
          });
        }
        var shot = ${process.env.ASHBOUND_SHOT ? "true" : "false"};
        var seq = shot
          ? ['D','D','D','D','D','D','D','D','J','D','D','J','SPACE','D','J']
          : ['D','D','J','SPACE','Q','TAB','J','E','S','W','E','J'];
        seq.forEach(function(c,i){ setTimeout(function(){ try{press(c);}catch(e){} }, 800+i*150); });
      })();
    `;
    win.webContents.executeJavaScript(sim).catch(() => {});
    setTimeout(async () => {
      try {
        const raw = await win.webContents.executeJavaScript(
          "JSON.stringify(window.__ashbound||{})",
        );
        const st = JSON.parse(raw || "{}");
        if (process.env.ASHBOUND_SHOT) {
          try {
            const img = await win.webContents.capturePage();
            fs.writeFileSync(process.env.ASHBOUND_SHOT, img.toPNG());
            console.log("[smoke] screenshot ->", process.env.ASHBOUND_SHOT);
          } catch (e) {
            console.error("[smoke] screenshot failed", e);
          }
        }
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
