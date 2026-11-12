// Kometenwerk Code · Hauptprozess (Electron)
// Fenster, Dateien, und die Arbeit mit arduino-cli: einrichten, prüfen (kompilieren), hochladen, serieller Monitor.

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, net } = require("electron");
const http = require("http");
const crypto = require("crypto");
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
  for (const p of liste) {
    const s2 = sys.find(x => x.adresse === p.adresse); if (!s2) continue;
    p.geraet = s2.name;
    // arduino-cli kennt Nachbauten (CH340 usw.) nicht – dann hilft der Name, den Windows anzeigt
    if (!p.board && istArduinoName(s2.name)) { p.board = /ch34|wch/i.test(s2.name) ? "Nachbau (CH340)" : /arduino/i.test(s2.name) ? s2.name.replace(/\s*\(COM\d+\)/, "") : "USB-Seriell (vielleicht Arduino)"; if (/arduino uno/i.test(s2.name)) p.fqbn = "arduino:avr:uno"; }
  }
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


/* ---------- Verbindung testen: Schritt für Schritt mit Ampel ---------- */
function portFrei(adresse) {
  return new Promise((fertig) => {
    const pfad = WIN ? "\\\\.\\" + adresse : adresse;
    fs.open(pfad, "r+", (err, fd) => {
      if (fd != null) { fs.close(fd, () => fertig({ frei: true })); return; }
      const c = err && err.code;
      fertig({ frei: !/EBUSY|EACCES|EPERM/.test(c || ""), code: c || "" });
    });
  });
}
ipcMain.handle("verbindung:test", async (_, { port, fqbn }) => {
  const schritte = [];
  const s = (titel, ok, text, tipp) => schritte.push({ titel, ok, text, tipp: tipp || "" });
  // 1. Werkzeuge
  const st = await cli(["core", "list", "--format", "json"]);
  if (st.code === -1) s("Werkzeuge", "nein", "arduino-cli fehlt.", "Installier Kometenwerk Code neu.");
  else {
    let avr = false; try { const j = JSON.parse(st.json); const l = j.platforms || j || []; avr = l.some(x => (x.id || (x.metadata && x.metadata.id)) === "arduino:avr"); } catch (e) { avr = /arduino:avr/.test(st.aus); }
    s("Werkzeuge", avr ? "ja" : "nein", avr ? "Arduino-Werkzeuge sind eingerichtet." : "Die Arduino-Werkzeuge fehlen noch.", avr ? "" : "Menü Werkzeuge → Einrichten (braucht einmal Internet).");
  }
  // 2. Arduino gefunden?
  const sys = await systemPorts(), bl = await cli(["board", "list", "--format", "json"]);
  let liste = []; try { const j = JSON.parse(bl.json || "{}"); liste = (Array.isArray(j) ? j : (j.detected_ports || [])).map(x => ({ adresse: (x.port || x).address, board: ((x.matching_boards || x.boards || [])[0] || {}).name || "" })); } catch (e) {}
  for (const x of sys) { const l = liste.find(p => p.adresse === x.adresse); if (l) { if (!l.board && istArduinoName(x.name)) l.board = x.name; } else liste.push({ adresse: x.adresse, board: istArduinoName(x.name) ? x.name : "" }); }
  const arduinos = liste.filter(p => p.board);
  if (!arduinos.length) s("Arduino gefunden", "nein", "Es ist kein Arduino angesteckt" + (liste.length ? " (nur andere Anschlüsse: " + liste.map(p => p.adresse).join(", ") + ")." : "."), "USB-Kabel prüfen – manche Kabel laden nur und übertragen keine Daten. Anderen USB-Anschluss probieren. Bei Nachbauten den CH340-Treiber installieren.");
  else s("Arduino gefunden", "ja", arduinos.map(p => p.board.replace(/\s*\(COM\d+\)/, "") + " an " + p.adresse).join(", "));
  // 3. richtiger Port gewählt?
  if (!port) s("Port gewählt", "nein", "Es ist kein Port ausgewählt.", "Oben auf die Board-Auswahl klicken und den Arduino mit ✔ wählen.");
  else if (arduinos.some(p => p.adresse === port)) s("Port gewählt", "ja", port + " – dort ist der Arduino.");
  else s("Port gewählt", arduinos.length ? "nein" : "warn", port + " ist gewählt, dort ist aber kein Arduino.", arduinos.length ? "Wähl oben " + arduinos[0].adresse + "." : "");
  // 4. Port frei?
  const ziel = arduinos.some(p => p.adresse === port) ? port : (arduinos[0] || {}).adresse;
  if (ziel) {
    if (monitor) s("Port frei", "ja", "Der Serielle Monitor von Kometenwerk Code ist verbunden – das ist in Ordnung, beim Hochladen wird er kurz getrennt.");
    else { const f = await portFrei(ziel); s("Port frei", f.frei ? "ja" : "nein", f.frei ? ziel + " ist frei." : ziel + " ist von einem anderen Programm belegt.", f.frei ? "" : "Arduino IDE, Cura, ein anderer Serieller Monitor oder ein zweites Kometenwerk-Code-Fenster schließen."); }
  }
  // 5. Board passt?
  const gefunden = arduinos.find(p => p.adresse === ziel);
  if (gefunden && fqbn) { const name = gefunden.board.toLowerCase(), passt = !/uno|nano|mega|leonardo|micro/.test(name) || (fqbn.includes("uno") && name.includes("uno")) || (fqbn.includes("nano") && name.includes("nano")) || (fqbn.includes("mega") && name.includes("mega")) || (fqbn.includes("leonardo") && name.includes("leonardo")) || (fqbn.includes("micro") && name.includes("micro"));
    s("Board passt", passt ? "ja" : "warn", passt ? "Das gewählte Board passt." : "Angesteckt ist „" + gefunden.board + "“, gewählt ist etwas anderes.", passt ? "" : "Unter Board auswählen das passende Board nehmen."); }
  return { schritte, gut: schritte.every(x => x.ok === "ja") };
});

/* ---------- Automatisches Update (über das GitHub-Release) ---------- */
const RELEASE = "https://api.github.com/repos/kometenwerk/kometenwerk.github.io/releases/tags/kometenwerk-code-neueste";
const RELEASE_SEITE = "https://github.com/kometenwerk/kometenwerk.github.io/releases/tag/kometenwerk-code-neueste";
const neuer = (a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) > (y[i] || 0)) return true; if ((x[i] || 0) < (y[i] || 0)) return false; } return false; };
let updateInfo = null;
ipcMain.handle("update:pruefen", async () => {
  try {
    const r = await net.fetch(RELEASE, { headers: { "User-Agent": "Kometenwerk-Code", Accept: "application/vnd.github+json" } });
    if (!r.ok) return { fehler: "GitHub antwortet nicht (" + r.status + ")." };
    const j = await r.json(), assets = j.assets || [];
    const setup = assets.find(a => /Setup-(\d+\.\d+\.\d+)\.exe$/.test(a.name)), v = setup ? /Setup-(\d+\.\d+\.\d+)\.exe$/.exec(setup.name)[1] : (assets.map(a => (/(\d+\.\d+\.\d+)/.exec(a.name) || [])[1]).find(Boolean) || "");
    if (!v) return { fehler: "Keine Version gefunden." };
    const art = process.env.PORTABLE_EXECUTABLE_DIR ? "portable" : WIN ? "setup" : "seite";
    updateInfo = { version: v, url: setup && setup.browser_download_url, art };
    return { aktuell: app.getVersion(), neu: v, gibtNeues: neuer(v, app.getVersion()), art };
  } catch (e) { return { fehler: "Kein Internet." }; }
});
ipcMain.handle("update:los", async () => {
  if (!updateInfo || updateInfo.art !== "setup" || !updateInfo.url) { shell.openExternal(RELEASE_SEITE); return { seite: true }; }
  const ziel = path.join(os.tmpdir(), "Kometenwerk-Code-Setup-" + updateInfo.version + ".exe");
  try {
    const r = await net.fetch(updateInfo.url, { headers: { "User-Agent": "Kometenwerk-Code" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const gesamt = Number(r.headers.get("content-length")) || 0, teile = []; let da = 0;
    const leser = r.body.getReader();
    for (;;) { const { done, value } = await leser.read(); if (done) break; teile.push(Buffer.from(value)); da += value.length; if (fenster && gesamt) fenster.webContents.send("update:fortschritt", Math.round(da / gesamt * 100)); }
    fs.writeFileSync(ziel, Buffer.concat(teile));
  } catch (e) { shell.openExternal(RELEASE_SEITE); return { fehler: String(e.message || e), seite: true }; }
  monitorStopp();
  const p = spawn(ziel, [], { detached: true, stdio: "ignore" }); p.unref();
  setTimeout(() => app.quit(), 800);
  return { ok: true };
});

/* ---------- Automatische Sicherung im Dokumente-Ordner ---------- */
const sicherungOrdner = () => path.join(sketchbook(), "Sicherung");
ipcMain.handle("sicherung:schreiben", async (_, text) => {
  try {
    const o = sicherungOrdner(); fs.mkdirSync(o, { recursive: true });
    const tag = new Date().toISOString().slice(0, 10);
    fs.writeFileSync(path.join(o, "projekt-" + tag + ".json"), text);
    const alle = fs.readdirSync(o).filter(f => /^projekt-\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
    for (const f of alle.slice(0, Math.max(0, alle.length - 14))) fs.unlinkSync(path.join(o, f));
    return { ok: true, ordner: o };
  } catch (e) { return { ok: false }; }
});
ipcMain.handle("sicherung:laden", async () => {
  const r = await dialog.showOpenDialog(fenster, { defaultPath: sicherungOrdner(), filters: [{ name: "Kometenwerk-Code-Sicherung", extensions: ["json"] }], properties: ["openFile"] });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return fs.readFileSync(r.filePaths[0], "utf8"); } catch (e) { return null; }
});
ipcMain.handle("sicherung:zeigen", async () => { fs.mkdirSync(sicherungOrdner(), { recursive: true }); shell.openPath(sicherungOrdner()); return true; });

/* ---------- Zeichnung an FIDELIA Notizen schicken ---------- */
// Kleiner Server nur auf diesem Computer (127.0.0.1): Notizen holt das Bild genau einmal ab, danach geht er wieder aus.
ipcMain.handle("notizen:senden", async (_, { name, bild, fach }) => {
  const token = crypto.randomBytes(12).toString("hex"), daten = JSON.stringify({ name, bild, fach });
  // zusätzlich als Datei ablegen (falls der Browser die Abholung blockiert)
  let datei = null;
  try { const o = path.join(sketchbook(), "Für Notizen"); fs.mkdirSync(o, { recursive: true }); datei = path.join(o, String(name).replace(/[^\wäöüÄÖÜß -]+/g, "_") + ".png"); fs.writeFileSync(datei, Buffer.from(String(bild).split(",")[1] || "", "base64")); } catch (e) {}
  const server = http.createServer((req, res) => {
    const kopf = { "Access-Control-Allow-Origin": "https://kometenwerk.github.io", "Access-Control-Allow-Private-Network": "true", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "*", Vary: "Origin" };
    if (req.method === "OPTIONS") { res.writeHead(204, kopf); res.end(); return; }
    if (req.url !== "/zeichnung?t=" + token) { res.writeHead(404, kopf); res.end(); return; }
    res.writeHead(200, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, kopf)); res.end(daten);
    setTimeout(() => server.close(), 1000);
  });
  await new Promise(ok => server.listen(0, "127.0.0.1", ok));
  setTimeout(() => { try { server.close(); } catch (e) {} }, 180000);
  const port = server.address().port;
  shell.openExternal("https://kometenwerk.github.io/notizen/#holen/" + port + "/" + token);
  return { ok: true, datei };
});

/* ---------- NWT-Werkzeuge: Dateien exportieren, Versionen ablegen, PDF/Drucken ---------- */
const FILTER = { csv: ["Tabelle (CSV, öffnet in Excel)", "csv"], zip: ["ZIP-Archiv", "zip"], png: ["Bild (PNG)", "png"], svg: ["Zeichnung (SVG)", "svg"], pdf: ["PDF", "pdf"], ino: ["Arduino-Sketch", "ino"], txt: ["Text", "txt"] };
async function speichernDialog(name, art) {
  const f = FILTER[art] || ["Datei", art];
  const r = await dialog.showSaveDialog(fenster, { defaultPath: path.join(app.getPath("documents"), name), filters: [{ name: f[0], extensions: [f[1]] }] });
  return r.canceled || !r.filePath ? null : r.filePath;
}
ipcMain.handle("export:speichern", async (_, { name, art, text, base64 }) => {
  const ziel = await speichernDialog(name, art); if (!ziel) return null;
  fs.writeFileSync(ziel, base64 != null ? Buffer.from(base64, "base64") : text);
  return ziel;
});
ipcMain.handle("version:ablegen", async (_, { pfad, datei, code }) => {
  try { if (!pfad) return null; const o = path.join(path.dirname(pfad), "Versionen"); fs.mkdirSync(o, { recursive: true }); const z = path.join(o, datei); fs.writeFileSync(z, code); return z; } catch (e) { return null; }
});
async function seiteLaden(html) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  await w.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  return w;
}
ipcMain.handle("pdf:speichern", async (_, { html, name, quer }) => {
  const ziel = await speichernDialog(name, "pdf"); if (!ziel) return null;
  const w = await seiteLaden(html);
  try { const pdf = await w.webContents.printToPDF({ pageSize: "A4", landscape: !!quer, printBackground: true, margins: { marginType: "none" }, preferCSSPageSize: true }); fs.writeFileSync(ziel, pdf); }
  finally { w.destroy(); }
  return ziel;
});
ipcMain.handle("drucken", async (_, { html }) => {
  const w = await seiteLaden(html);
  return new Promise((fertig) => w.webContents.print({ printBackground: true, margins: { marginType: "none" } }, (ok) => { w.destroy(); fertig(ok); }));
});

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
    { label: "Projekt", submenu: [
      { label: "Version speichern …", accelerator: "CmdOrCtrl+Alt+S", click: m("versionNeu") },
      { label: "Versionen und Vergleich", click: m("p:versionen") },
      { label: "Messwerte sammeln", click: m("p:messwerte") },
      { label: "Tagebuch-Eintrag …", accelerator: "CmdOrCtrl+Alt+T", click: m("p:tagebuch") },
      { label: "Teileliste", click: m("p:teile") }, { type: "separator" },
      { label: "Schaltplan zeichnen", click: m("z:schaltplan") },
      { label: "Flussdiagramm zeichnen", click: m("z:fluss") },
      { label: "Technische Zeichnung (Bauplan)", click: m("z:bauplan") }, { type: "separator" },
      { label: "Unterrichts-Modus", click: m("p:unterricht") },
      { label: "Eigenleistungs-Nachweis", click: m("p:eigen") },
      { label: "Protokoll-Checkliste", click: m("p:checkliste") },
      { label: "Abgabe-Paket (ZIP) erstellen …", click: m("abgabe") }] },
    { label: "Hilfe", submenu: [
      { label: "Erste Schritte", click: m("hilfe") },
      { label: "Arduino wird nicht gefunden?", click: m("hilfePort") },
      { label: "Verbindung testen", click: m("verbindungTest") },
      { label: "Nach Updates suchen", click: m("update") }, { type: "separator" },
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
