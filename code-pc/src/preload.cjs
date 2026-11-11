// Kometenwerk Code · sichere Brücke zwischen Fenster und Hauptprozess
const { contextBridge, ipcRenderer } = require("electron");
const hoeren = (kanal) => (cb) => { const f = (_, d) => cb(d); ipcRenderer.on(kanal, f); return () => ipcRenderer.removeListener(kanal, f); };
contextBridge.exposeInMainWorld("KC", {
  einrichtenStatus: () => ipcRenderer.invoke("einrichten:status"),
  einrichten: () => ipcRenderer.invoke("einrichten:los"),
  ports: () => ipcRenderer.invoke("ports"),
  pruefen: (x) => ipcRenderer.invoke("pruefen", x),
  hochladen: (x) => ipcRenderer.invoke("hochladen", x),
  bibliothekInstallieren: (n) => ipcRenderer.invoke("bibliothek:installieren", n),
  bibliothekSuchen: (w) => ipcRenderer.invoke("bibliothek:suchen", w),
  bibliotheken: () => ipcRenderer.invoke("bibliothek:liste"),
  monitorStart: (x) => ipcRenderer.invoke("monitor:start", x),
  monitorSenden: (t) => ipcRenderer.invoke("monitor:senden", t),
  monitorStopp: () => ipcRenderer.invoke("monitor:stopp"),
  oeffnen: () => ipcRenderer.invoke("datei:oeffnen"),
  speichern: (x) => ipcRenderer.invoke("datei:speichern", x),
  lesen: (p) => ipcRenderer.invoke("datei:lesen", p),
  sketchbook: () => ipcRenderer.invoke("sketchbook"),
  ordnerZeigen: (p) => ipcRenderer.invoke("ordner:zeigen", p),
  startDatei: () => ipcRenderer.invoke("start:datei"),
  beiEinrichten: hoeren("einrichten:zeile"),
  beiAusgabe: hoeren("ausgabe:zeile"),
  beiMonitor: hoeren("monitor:daten"),
  beiMonitorFehler: hoeren("monitor:fehler"),
  beiMonitorZu: hoeren("monitor:zu"),
  beiOeffnen: hoeren("oeffnen"),
  beiMenue: hoeren("menue"),
  exportSpeichern: (x) => ipcRenderer.invoke("export:speichern", x),
  versionAblegen: (x) => ipcRenderer.invoke("version:ablegen", x),
  pdfSpeichern: (x) => ipcRenderer.invoke("pdf:speichern", x),
  drucken: (x) => ipcRenderer.invoke("drucken", x),
  version: () => ipcRenderer.invoke("version")
});
