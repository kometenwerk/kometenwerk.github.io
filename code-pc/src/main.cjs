// Kometenwerk Code · Hauptprozess (Electron)
// Fenster, Dateien, und die Arbeit mit arduino-cli: einrichten, prüfen (kompilieren), hochladen, serieller Monitor.

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
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
    let aus = "", nurAus = "";
    let p;
    try { p = spawn(cliPfad(), ["--config-file", konfig(), ...args], { windowsHide: true }); }
    catch (e) { fertig({ code: -1, aus: String(e) }); return; }
    const zeile = (d) => { const t = d.toString(); aus += t; if (kanal && fenster) fenster.webContents.send(kanal, t); };
    p.stdout.on("data", (d) => { nurAus += d.toString(); zeile(d); }); p.stderr.on("data", zeile);
    p.on("error", (e) => fertig({ code: -1, aus: aus + "\n" + (e.code === "ENOENT" ? "arduino-cli wurde nicht gefunden." : String(e)), json: "" }));
    p.on("close", (code) => fertig({ code, aus, json: nurAus }));
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
  let avr = false; try { const j = JSON.parse(r.json); const liste = j.platforms || j || []; avr = liste.some(x => (x.id || (x.metadata && x.metadata.id)) === "arduino:avr"); } catch (e) { avr = /arduino:avr/.test(r.aus); }
  return { cli: true, avr };
});
ipcMain.handle("einrichten:los", async () => {
  const a = await cli(["core", "update-index"], "einrichten:zeile");
  if (a.code !== 0) return { ok: false, aus: a.aus };
  const b = await cli(["core", "install", "arduino:avr"], "einrichten:zeile");
  return { ok: b.code === 0, aus: a.aus + b.aus };
});
// Ports ohne arduino-cli finden (klappt auch, wenn „Einrichten“ noch nicht fertig ist, und zeigt Nachbauten mit CH340)
function systemPorts() {
  return new Promise((fertig) => {
    if (WIN) {
      const ps = "Get-CimInstance Win32_PnPEntity | Where-Object { $_.Name -match '\\(COM\\d+\\)' } | ForEach-Object { $_.Name }";
      let aus = ""; let p;
      try { p = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true }); } catch (e) { fertig([]); return; }
      p.stdout.on("data", d => aus += d.toString()); p.on("error", () => fertig([]));
      p.on("close", () => fertig(aus.split(/\r?\n/).map(z => z.trim()).filter(Boolean).map(z => { const m = /\((COM\d+)\)/.exec(z); return m ? { adresse: m[1], name: z } : null; }).filter(Boolean)));
    } else {
      try { fertig(fs.readdirSync("/dev").filter(n => /^(ttyACM|ttyUSB|cu\.usb|tty\.usb)/.test(n)).map(n => ({ adresse: "/dev/" + n, name: n }))); } catch (e) { fertig([]); }
    }
  });
}
const istArduinoName = (n) => /arduino|ch34|usb-serial|usb serial|cp210|ftdi|wch/i.test(n || "");
ipcMain.handle("ports", async () => {
  const [r, sys] = await Promise.all([cli(["board", "list", "--format", "json"]), systemPorts()]);
  let liste = [], hinweis = "";
  try {
    const j = JSON.parse(r.json || "{}"), roh = Array.isArray(j) ? j : (j.detected_ports || []);
    liste = roh.map(x => { const port = x.port || x; const b = (x.matching_boards || x.boards || [])[0]; return { adresse: port.address, name: port.label || port.address, protokoll: port.protocol, board: b ? b.name : "", fqbn: b ? b.fqbn : "" }; }).filter(p => p.adresse && p.protokoll !== "network");
    if (!liste.length && /discovery|not found|nicht gefunden/i.test((j.warnings || []).join(" ") + r.aus)) hinweis = "einrichten";
  } catch (e) { hinweis = "einrichten"; }
  // was Windows/Linux selbst sieht, dazunehmen
  for (const s2 of sys) if (!liste.some(p => p.adresse === s2.adresse)) liste.push({ adresse: s2.adresse, name: s2.name, protokoll: "serial", board: istArduinoName(s2.name) ? (/ch34|wch/i.test(s2.name) ? "Nachbau (CH340)" : /arduino/i.test(s2.name) ? s2.name.replace(/\s*\(COM\d+\)/, "") : "USB-Seriell") : "", fqbn: /arduino uno/i.test(s2.name) ? "arduino:avr:uno" : /mega/i.test(s2.name) ? "arduino:avr:mega" : "" });
  for (const p of liste) { const s2 = sys.find(x => x.adresse === p.adresse); if (s2) p.geraet = s2.name; }
  liste.sort((a, b) => (b.board ? 1 : 0) - (a.board ? 1 : 0));
  return { liste, hinweis, systemZahl: sys.length };
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
  try { const j = JSON.parse(r.json); return (j.libraries || []).slice(0, 20).map(l => ({ name: l.name, text: (l.latest || (l.releases && Object.values(l.releases)[0]) || {}).sentence || "" })); } catch (e) { return []; }
});
ipcMain.handle("bibliothek:liste", async () => {
  const r = await cli(["lib", "list", "--format", "json"]);
  try { const j = JSON.parse(r.json); return (j.installed_libraries || j || []).map(l => (l.library || l).name); } catch (e) { return []; }
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
ipcMain.handle("monitor:senden", async (_, text) => { if (monitor) monitor.stdin.write(text); return !!monitor; });
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

/* ---------- Menüleiste (wie in einer Arduino-Umgebung, auf Deutsch) ---------- */
function menueBauen() {
  const m = (id) => () => fenster && fenster.webContents.send("menue", id);
  const vorlage = [
    { label: "Datei", submenu: [
      { label: "Neuer Sketch", accelerator: "CmdOrCtrl+N", click: m("neu") },
      { label: "Öffnen …", accelerator: "CmdOrCtrl+O", click: m("oeffnen") },
      { label: "Sketchbook", click: m("sketchbook") },
      { type: "separator" },
      { label: "Speichern", accelerator: "CmdOrCtrl+S", click: m("speichern") },
      { label: "Speichern unter …", accelerator: "CmdOrCtrl+Shift+S", click: m("speichernUnter") },
      { type: "separator" },
      { label: "Beenden", accelerator: "CmdOrCtrl+Q", role: "quit" }] },
    { label: "Bearbeiten", submenu: [
      { label: "Rückgängig", role: "undo" }, { label: "Wiederholen", role: "redo" }, { type: "separator" },
      { label: "Ausschneiden", role: "cut" }, { label: "Kopieren", role: "copy" }, { label: "Einfügen", role: "paste" }, { label: "Alles auswählen", role: "selectAll" }, { type: "separator" },
      { label: "Kommentar ein/aus", accelerator: "CmdOrCtrl+/", click: m("kommentar") },
      { label: "Schrift vergrößern", accelerator: "CmdOrCtrl+=", click: m("schrift+") },
      { label: "Schrift verkleinern", accelerator: "CmdOrCtrl+-", click: m("schrift-") }, { type: "separator" },
      { label: "Suchen und Ersetzen", accelerator: "CmdOrCtrl+F", click: m("suchen") }] },
    { label: "Sketch", submenu: [
      { label: "Überprüfen/Kompilieren", accelerator: "CmdOrCtrl+R", click: m("pruefen") },
      { label: "Hochladen", accelerator: "CmdOrCtrl+U", click: m("hochladen") }, { type: "separator" },
      { label: "Bibliotheken verwalten …", accelerator: "CmdOrCtrl+Shift+I", click: m("bibliotheken") },
      { label: "Sketch-Ordner anzeigen", accelerator: "CmdOrCtrl+K", click: m("ordner") }] },
    { label: "Werkzeuge", submenu: [
      { label: "Serieller Monitor", accelerator: "CmdOrCtrl+Shift+M", click: m("monitor") },
      { label: "Serieller Plotter", accelerator: "CmdOrCtrl+Shift+L", click: m("plotter") }, { type: "separator" },
      { label: "Board und Port auswählen …", click: m("board") },
      { label: "Boardverwalter …", accelerator: "CmdOrCtrl+Shift+B", click: m("boards") }, { type: "separator" },
      { label: "Entwicklerwerkzeuge", accelerator: "F12", role: "toggleDevTools", visible: !app.isPackaged }] },
    { label: "Hilfe", submenu: [
      { label: "Erste Schritte", click: m("hilfe") },
      { label: "Arduino wird nicht gefunden?", click: m("hilfePort") }, { type: "separator" },
      { label: "Über Kometenwerk Code", click: m("ueber") }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(vorlage));
}
ipcMain.handle("version", async () => app.getVersion());

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
    menueBauen();
    fenster = new BrowserWindow({
      width: 1280, height: 820, minWidth: 760, minHeight: 520, title: "Kometenwerk Code", backgroundColor: "#171e21",
      icon: path.join(__dirname, "icon.png"), autoHideMenuBar: false,
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true }
    });
    fenster.loadFile(path.join(__dirname, "index.html"));
    fenster.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
    fenster.webContents.on("will-navigate", (e) => e.preventDefault());
    fenster.on("closed", () => { fenster = null; monitorStopp(); });
  });
  app.on("window-all-closed", () => { monitorStopp(); app.quit(); });
}
