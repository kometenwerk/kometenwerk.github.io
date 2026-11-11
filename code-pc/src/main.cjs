// Kometenwerk Code · Hauptprozess (Electron)
// Fenster, Dateien, und die Arbeit mit arduino-cli: einrichten, prüfen (kompilieren), hochladen, serieller Monitor.

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

const WIN = process.platform === "win32";
const werkzeug = app.isPackaged ? path.join(process.resourcesPath, "werkzeug") : path.join(__dirname, "..", "werkzeug");
const cliPfad = () => { const p = path.join(werkzeug, WIN ? "arduino-cli.exe" : "arduino-cli"); return fs.existsSync(p) ? p : "arduino-cli"; };
const daten = () => path.join(app.getPath("userData"), "arduino");
const sketchbook = () => path.join(app.getPath("documents"), "Kometenwerk Code");
let fenster = null, monitor = null, offenBeimStart = null;

/* ---------- arduino-cli ---------- */
function konfig() {
  if (process.env.KC_CLI_KONFIG) return process.env.KC_CLI_KONFIG;     // nur zum Testen
  const d = daten(); fs.mkdirSync(d, { recursive: true }); fs.mkdirSync(sketchbook(), { recursive: true });
  const datei = path.join(d, "arduino-cli.yaml");
  const yaml = "directories:\n  data: " + JSON.stringify(path.join(d, "data")) + "\n  downloads: " + JSON.stringify(path.join(d, "downloads")) + "\n  user: " + JSON.stringify(sketchbook()) + "\nlocale: de\n";
  fs.writeFileSync(datei, yaml);
  return datei;
}
// Führt arduino-cli aus; meldet jede Zeile an den Bildschirm (kanal), gibt { code, aus } zurück
function cli(args, kanal, eingabe) {
  return new Promise((fertig) => {
    let aus = "";
    let p;
    try { p = spawn(cliPfad(), ["--config-file", konfig(), ...args], { windowsHide: true }); }
    catch (e) { fertig({ code: -1, aus: String(e) }); return; }
    const zeile = (d) => { const t = d.toString(); aus += t; if (kanal && fenster) fenster.webContents.send(kanal, t); };
    p.stdout.on("data", zeile); p.stderr.on("data", zeile);
    p.on("error", (e) => fertig({ code: -1, aus: aus + "\n" + (e.code === "ENOENT" ? "arduino-cli wurde nicht gefunden." : String(e)) }));
    p.on("close", (code) => fertig({ code, aus }));
    if (eingabe) { p.stdin.write(eingabe); p.stdin.end(); }
  });
}
function sketchSchreiben(name, code) {
  const n = (String(name || "sketch").replace(/[^\w]/g, "_").replace(/^_+/, "") || "sketch").slice(0, 40);
  const ordner = path.join(os.tmpdir(), "kometenwerk-code", n);
  fs.mkdirSync(ordner, { recursive: true });
  for (const f of fs.readdirSync(ordner)) if (/\.ino$/.test(f)) fs.unlinkSync(path.join(ordner, f));
  fs.writeFileSync(path.join(ordner, n + ".ino"), code);
  return ordner;
}

ipcMain.handle("einrichten:status", async () => {
  const r = await cli(["core", "list", "--format", "json"]);
  if (r.code === -1) return { cli: false, avr: false, text: r.aus };
  let avr = false; try { const j = JSON.parse(r.aus); const liste = j.platforms || j || []; avr = liste.some(x => (x.id || (x.metadata && x.metadata.id)) === "arduino:avr"); } catch (e) { avr = /arduino:avr/.test(r.aus); }
  return { cli: true, avr };
});
ipcMain.handle("einrichten:los", async () => {
  const a = await cli(["core", "update-index"], "einrichten:zeile");
  if (a.code !== 0) return { ok: false, aus: a.aus };
  const b = await cli(["core", "install", "arduino:avr"], "einrichten:zeile");
  return { ok: b.code === 0, aus: a.aus + b.aus };
});
ipcMain.handle("ports", async () => {
  const r = await cli(["board", "list", "--format", "json"]);
  try {
    const j = JSON.parse(r.aus), liste = Array.isArray(j) ? j : (j.detected_ports || []);
    return liste.map(x => { const port = x.port || x; const b = (x.matching_boards || x.boards || [])[0]; return { adresse: port.address, name: port.label || port.address, protokoll: port.protocol, board: b ? b.name : "", fqbn: b ? b.fqbn : "" }; }).filter(p => p.adresse && p.protokoll !== "network");
  } catch (e) { return []; }
});
ipcMain.handle("pruefen", async (_, { name, code, fqbn }) => {
  const ordner = sketchSchreiben(name, code);
  const r = await cli(["compile", "--fqbn", fqbn, "--warnings", "default", ordner], "ausgabe:zeile");
  return { ok: r.code === 0, aus: r.aus, datei: path.basename(ordner) + ".ino" };
});
ipcMain.handle("hochladen", async (_, { name, code, fqbn, port }) => {
  const warMonitor = !!monitor; monitorStopp();
  const ordner = sketchSchreiben(name, code);
  const r = await cli(["compile", "--fqbn", fqbn, "--upload", "-p", port, "--warnings", "default", ordner], "ausgabe:zeile");
  return { ok: r.code === 0, aus: r.aus, datei: path.basename(ordner) + ".ino", warMonitor };
});
ipcMain.handle("bibliothek:installieren", async (_, name) => { const r = await cli(["lib", "install", name], "ausgabe:zeile"); return { ok: r.code === 0, aus: r.aus }; });
ipcMain.handle("bibliothek:suchen", async (_, wort) => {
  const r = await cli(["lib", "search", wort, "--format", "json"]);
  try { const j = JSON.parse(r.aus); return (j.libraries || []).slice(0, 20).map(l => ({ name: l.name, text: (l.latest || (l.releases && Object.values(l.releases)[0]) || {}).sentence || "" })); } catch (e) { return []; }
});
ipcMain.handle("bibliothek:liste", async () => {
  const r = await cli(["lib", "list", "--format", "json"]);
  try { const j = JSON.parse(r.aus); return (j.installed_libraries || j || []).map(l => (l.library || l).name); } catch (e) { return []; }
});

/* ---------- Serieller Monitor ---------- */
function monitorStopp() { if (monitor) { try { monitor.kill(); } catch (e) {} monitor = null; } }
ipcMain.handle("monitor:start", async (_, { port, baud }) => {
  monitorStopp();
  try { monitor = spawn(cliPfad(), ["--config-file", konfig(), "monitor", "-p", port, "--config", "baudrate=" + baud, "--quiet"], { windowsHide: true }); }
  catch (e) { return { ok: false }; }
  const m = monitor;
  m.stdout.on("data", d => fenster && fenster.webContents.send("monitor:daten", d.toString()));
  m.stderr.on("data", d => fenster && fenster.webContents.send("monitor:fehler", d.toString()));
  m.on("close", () => { if (monitor === m) { monitor = null; fenster && fenster.webContents.send("monitor:zu"); } });
  return { ok: true };
});
ipcMain.handle("monitor:senden", async (_, text) => { if (monitor) monitor.stdin.write(text + "\n"); return !!monitor; });
ipcMain.handle("monitor:stopp", async () => { monitorStopp(); return true; });

/* ---------- Dateien ---------- */
ipcMain.handle("datei:oeffnen", async () => {
  const r = await dialog.showOpenDialog(fenster, { defaultPath: sketchbook(), filters: [{ name: "Arduino-Sketch", extensions: ["ino", "cpp", "h", "txt"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { pfad: r.filePaths[0], name: path.basename(r.filePaths[0]).replace(/\.\w+$/, ""), code: fs.readFileSync(r.filePaths[0], "utf8") };
});
ipcMain.handle("datei:speichern", async (_, { pfad, name, code, unter }) => {
  let ziel = pfad;
  if (!ziel || unter) {
    const n = (name || "sketch").replace(/[^\w]/g, "_");
    const r = await dialog.showSaveDialog(fenster, { defaultPath: path.join(sketchbook(), n, n + ".ino"), filters: [{ name: "Arduino-Sketch", extensions: ["ino"] }] });
    if (r.canceled || !r.filePath) return null;
    ziel = r.filePath;
  }
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, code);
  return { pfad: ziel, name: path.basename(ziel).replace(/\.\w+$/, "") };
});
ipcMain.handle("sketchbook", async () => {
  const sb = sketchbook(), out = [];
  try {
    for (const d of fs.readdirSync(sb, { withFileTypes: true })) {
      if (!d.isDirectory() || d.name === "libraries") continue;
      const f = path.join(sb, d.name, d.name + ".ino");
      if (fs.existsSync(f)) out.push({ name: d.name, pfad: f, zeit: fs.statSync(f).mtimeMs });
    }
  } catch (e) {}
  return out.sort((a, b) => b.zeit - a.zeit);
});
ipcMain.handle("datei:lesen", async (_, pfad) => ({ pfad, name: path.basename(pfad).replace(/\.\w+$/, ""), code: fs.readFileSync(pfad, "utf8") }));
ipcMain.handle("ordner:zeigen", async (_, pfad) => { shell.showItemInFolder(pfad || sketchbook()); return true; });
ipcMain.handle("start:datei", async () => { const x = offenBeimStart; offenBeimStart = null; return x; });

/* ---------- Links aus FIDELIA Notizen: kometenwerk-code://oeffnen?name=…&code=… ---------- */
function linkLesen(url) {
  try {
    const u = new URL(url); if (u.protocol !== "kometenwerk-code:") return null;
    const b64 = (u.searchParams.get("code") || "").replace(/-/g, "+").replace(/_/g, "/");
    return { name: u.searchParams.get("name") || "sketch", code: Buffer.from(b64, "base64").toString("utf8"), ausNotizen: true };
  } catch (e) { return null; }
}
function argumenteLesen(argv) {
  for (const a of argv.slice(1)) {
    if (/^kometenwerk-code:/i.test(a)) return linkLesen(a);
    if (/\.ino$/i.test(a) && fs.existsSync(a)) return { pfad: a, name: path.basename(a).replace(/\.\w+$/, ""), code: fs.readFileSync(a, "utf8") };
  }
  return null;
}
function weitergeben(x) { if (!x) return; if (fenster) { if (fenster.isMinimized()) fenster.restore(); fenster.focus(); fenster.webContents.send("oeffnen", x); } else offenBeimStart = x; }

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", (_, argv) => weitergeben(argumenteLesen(argv)));
  app.on("open-url", (e, url) => { e.preventDefault(); weitergeben(linkLesen(url)); });
  if (process.defaultApp) { if (process.argv.length >= 2) app.setAsDefaultProtocolClient("kometenwerk-code", process.execPath, [path.resolve(process.argv[1])]); }
  else app.setAsDefaultProtocolClient("kometenwerk-code");
  offenBeimStart = argumenteLesen(process.argv);

  app.whenReady().then(() => {
    fenster = new BrowserWindow({
      width: 1280, height: 820, minWidth: 760, minHeight: 520, title: "Kometenwerk Code", backgroundColor: "#0b111c",
      icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    fenster.loadFile(path.join(__dirname, "index.html"));
    fenster.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
    fenster.webContents.on("will-navigate", (e) => e.preventDefault());
    fenster.on("closed", () => { fenster = null; monitorStopp(); });
  });
  app.on("window-all-closed", () => { monitorStopp(); app.quit(); });
}
