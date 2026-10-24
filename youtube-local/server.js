"use strict";

const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const app = express();
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4390);
const LOCAL_DATA = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "Kometenwerk", "YouTube");
const CLIENT_FILE = path.join(LOCAL_DATA, "client_secret.json");
const TOKEN_FILE = path.join(LOCAL_DATA, "youtube-token.json");
const TEMP_DIR = path.join(LOCAL_DATA, "uploads");
const CALLBACK = `http://127.0.0.1:${PORT}/oauth2callback`;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024 * 1024;
const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

let oauthClient;
let pendingState = null;

function isLocalRequest(req) {
  const host = (req.headers.host || "").toLowerCase();
  const origin = req.headers.origin;
  return (host === `localhost:${PORT}` || host === `127.0.0.1:${PORT}`) &&
    (!origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`);
}

app.use((req, res, next) => {
  if (!isLocalRequest(req)) return res.status(403).send("Nur lokale Zugriffe sind erlaubt.");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

async function getOAuthClient() {
  if (oauthClient) return oauthClient;
  let raw;
  try {
    raw = JSON.parse(await fs.readFile(CLIENT_FILE, "utf8"));
  } catch {
    const err = new Error(`OAuth-Datei fehlt. Lege deine Google-JSON-Datei hier ab: ${CLIENT_FILE}`);
    err.status = 409;
    throw err;
  }
  const cfg = raw.installed;
  if (!cfg || !cfg.client_id || !cfg.client_secret) {
    const err = new Error("Die OAuth-JSON-Datei sieht nicht wie ein gültiger Desktop-App-Client aus.");
    err.status = 400;
    throw err;
  }
  oauthClient = new google.auth.OAuth2(cfg.client_id, cfg.client_secret, CALLBACK);
  try {
    const token = JSON.parse(await fs.readFile(TOKEN_FILE, "utf8"));
    oauthClient.setCredentials(token);
  } catch { /* Noch nicht verbunden. */ }
  return oauthClient;
}

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

app.get("/api/status", async (_req, res) => {
  try {
    const client = await getOAuthClient();
    res.json({ ready: true, connected: Boolean(client.credentials.refresh_token || client.credentials.access_token) });
  } catch (err) {
    res.status(err.status || 500).json({ ready: false, connected: false, message: err.message });
  }
});

const credentialFileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 64 * 1024, files: 1 } });
app.post("/api/client-credentials", credentialFileUpload.single("credentials"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "Wähle die heruntergeladene Google-JSON-Datei aus." });
  try {
    const config = JSON.parse(req.file.buffer.toString("utf8"));
    const client = config.installed || config.web;
    if (!client?.client_id || !client?.client_secret) return res.status(400).json({ message: "Das ist keine gültige Google-OAuth-Client-JSON-Datei." });
    await fs.mkdir(LOCAL_DATA, { recursive: true });
    await fs.writeFile(CLIENT_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
    oauthClient = null;
    res.json({ ok: true, message: "Google-Client lokal gespeichert. Jetzt kannst du dein Konto verbinden." });
  } catch (err) {
    res.status(400).json({ message: err instanceof SyntaxError ? "Die ausgewählte Datei ist keine gültige JSON-Datei." : err.message });
  }
});

app.get("/auth", async (_req, res) => {
  try {
    const client = await getOAuthClient();
    pendingState = crypto.randomBytes(24).toString("hex");
    const url = client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent select_account",
      scope: [SCOPE],
      state: pendingState
    });
    res.redirect(url);
  } catch (err) { res.status(err.status || 500).send(err.message); }
});

app.get("/oauth2callback", async (req, res) => {
  const state = String(req.query.state || "");
  if (!pendingState || state !== pendingState) return res.status(400).send("Anmeldung abgelehnt: Statusprüfung fehlgeschlagen. Bitte erneut verbinden.");
  pendingState = null;
  if (req.query.error) return res.status(400).send("Google-Anmeldung wurde abgebrochen. Du kannst das Fenster schließen.");
  try {
    const client = await getOAuthClient();
    const { tokens } = await client.getToken(String(req.query.code || ""));
    client.setCredentials(tokens);
    await fs.mkdir(LOCAL_DATA, { recursive: true });
    await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
    res.send("<!doctype html><meta charset=utf-8><title>YouTube verbunden</title><p>YouTube ist verbunden. Du kannst dieses Fenster schließen und zum Kometenwerk-Uploadhelfer zurückkehren.</p>");
  } catch (err) { res.status(500).send(`Verbindung fehlgeschlagen: ${escapeHtml(err.message)}`); }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => fs.mkdir(TEMP_DIR, { recursive: true }).then(() => cb(null, TEMP_DIR), cb),
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(18).toString("hex")}${path.extname(file.originalname).slice(0, 12)}`)
  }),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 3 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith("video/") || file.mimetype === "application/octet-stream")
});

app.post("/api/upload", upload.single("video"), async (req, res) => {
  try {
    const client = await getOAuthClient();
    if (!client.credentials.refresh_token && !client.credentials.access_token) {
      return res.status(401).json({ message: "Verbinde zuerst dein YouTube-Konto." });
    }
    if (!req.file) return res.status(400).json({ message: "Bitte wähle eine Videodatei aus." });
    const title = String(req.body.title || "").trim();
    let description = String(req.body.description || "").trim();
    if (!title || title.length > 100) return res.status(400).json({ message: "Der Titel muss 1 bis 100 Zeichen lang sein." });
    const websiteLink = "https://kometenwerk.github.io/";
    if (!description.includes(websiteLink)) description = `${description}${description ? "\n\n" : ""}${websiteLink}`;
    if (description.length > 5000) return res.status(400).json({ message: "Die Beschreibung darf mit Website-Link höchstens 5000 Zeichen lang sein." });
    const youtube = google.youtube({ version: "v3", auth: client });
    const result = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: { title, description },
        status: { privacyStatus: "private" }
      },
      media: { body: fsSync.createReadStream(req.file.path) }
    });
    res.json({ ok: true, id: result.data.id, url: `https://studio.youtube.com/video/${encodeURIComponent(result.data.id)}/edit`, message: "Video wurde privat hochgeladen. Prüfe es in YouTube Studio, bevor du es veröffentlichst." });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || "Upload fehlgeschlagen." });
  } finally {
    if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
  }
});

app.post("/api/disconnect", async (_req, res) => {
  try {
    const client = await getOAuthClient();
    if (client.credentials.access_token) await client.revokeCredentials().catch(() => {});
    oauthClient = null;
    await fs.unlink(TOKEN_FILE).catch(() => {});
    res.json({ ok: true });
  } catch (err) { res.status(err.status || 500).json({ message: err.message }); }
});

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

app.listen(PORT, HOST, () => {
  console.log(`Kometenwerk YouTube-Uploadhelfer: http://127.0.0.1:${PORT}`);
  console.log(`Lokaler OAuth-/Token-Ordner: ${LOCAL_DATA}`);
});
