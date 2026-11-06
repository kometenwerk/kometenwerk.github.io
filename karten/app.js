// OMNIVIA Karten – Oberfläche
import { Netz, meterText, drehWort, unterschied, radInfo } from "./netz.js";
import { Suche } from "./suche.js";
import { meldungenLaden, meldungenAnRoute, routeErklaeren, zeitText } from "./verkehr.js";
import { vorbereiten, fortschritt, naechste, ansage, faellig, kurzText, tempoSchild, pfeilVon, danachVon, wahrzeichen } from "./navi.js";

const DATEN = "daten/";
const STIL_HELL = "https://tiles.openfreemap.org/styles/liberty";
const STIL_DUNKEL = "https://tiles.openfreemap.org/styles/dark";
const START = { lat: 47.995, lon: 7.85, zoom: 10 };
const $ = s => document.querySelector(s);
const esc = s => window.KW ? KW.esc(s) : String(s ?? "").replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const gespeichert = (window.KW && KW.load("kw-karten", null)) || {};
const S = {
  modus: gespeichert.modus || "auto",
  opt: Object.assign({ auto: { keineSchleichwege: true, keineEngen: true, keineAutobahn: false }, rad: { ruhig: true }, fuss: { hell: false, barrierefrei: false } }, gespeichert.opt || {}),
  von: null, nach: null, stopps: [], runde: 0, ankunft: "", route: null, routen: null, wahl: null, verkehrAn: gespeichert.verkehrAn !== false, autoStart: !!gespeichert.autoStart,
  meldungen: [], meldStand: null, meldLive: false, ich: null, ansicht: "start", ort: null,
};
// Letzte Ziele, Zuhause und Schule – bleiben nur auf diesem Gerät
const ORTE = (() => { try { return Object.assign({ letzte: [], zuhause: null, schule: null }, KW.load("kw-karten-orte", {})); } catch { return { letzte: [], zuhause: null, schule: null }; } })();
function orteMerken() { try { KW.save("kw-karten-orte", ORTE); } catch {} }
function zielMerken(p) {
  if (!p || !p.name || p.name === "Ziel" || p.name === "Punkt auf der Karte") return;
  ORTE.letzte = [{ name: p.name, unter: p.unter || "", lat: p.lat, lon: p.lon }, ...ORTE.letzte.filter(x => x.name !== p.name || Math.abs(x.lat - p.lat) > 1e-4)].slice(0, 6);
  orteMerken();
}
function merken() { window.KW && KW.save("kw-karten", { modus: S.modus, opt: S.opt, verkehrAn: S.verkehrAn, autoStart: S.autoStart }); }

/* ---------- Daten ---------- */
async function entpacken(buf) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0x1f || b[1] !== 0x8b) return buf;
  return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
}
async function ladenRoh(p) {
  const r = await fetch(DATEN + p + (index && p !== "index.json" ? `?v=${index.bau || index.stand}` : ""));
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return entpacken(await r.arrayBuffer());
}
const ladenJSON = async p => JSON.parse(new TextDecoder().decode(await ladenRoh(p)));

let index = null, netz = null, suche = null, datenFehler = null, anschluss = null;
const datenBereit = (async () => {
  try {
    index = await ladenJSON("index.json");
    netz = new Netz(index, ladenRoh);
    suche = new Suche(ladenJSON, index.suche, await ladenJSON("orte.json"), index.kategorien);
    altesAufraeumen();
    anschluss = await ladenJSON("anschluss.json").catch(() => null);
  } catch (e) { datenFehler = e; }
})();

// Alte Kartendaten aus dem Offline-Speicher werfen (nach einem Update)
async function altesAufraeumen() {
  try {
    const c = await caches.open("kw-karten-daten"), v = `v=${index.bau || index.stand}`;
    for (const req of await c.keys()) if (req.url.includes("?v=") && !req.url.includes(v)) c.delete(req);
  } catch {}
}

function imGebiet(p) {
  if (!index) return false;
  const [s, w, n, o] = index.bbox;
  return p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= o;
}

/* ---------- Karte ---------- */
const dunkel = matchMedia("(prefers-color-scheme: dark)").matches;
let karte = null, markerVon = null, markerNach = null, markerIch = null, meldMarker = [];
function karteStarten() {
  if (!window.maplibregl) { $("#karte").innerHTML = `<div class="kk-fehler" style="margin:90px 16px">Die Karte konnte nicht geladen werden. Hast du Internet?</div>`; return; }
  karte = new maplibregl.Map({
    container: "karte", style: dunkel ? STIL_DUNKEL : STIL_HELL, center: [START.lon, START.lat], zoom: START.zoom,
    attributionControl: { compact: true }, hash: false, maxPitch: 60, dragRotate: false,
  });
  karte.on("error", e => { if (dunkel && e?.error && String(e.error.message || "").includes("styles/dark") && !karte._ersatz) { karte._ersatz = true; karte.setStyle(STIL_HELL); } });
  karte.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
  karte.on("load", () => { routeEbenen(); if (S.route) routeZeichnen(); meldungenZeichnen(); });
  karte.on("click", e => {
    // Tipp auf eine graue Route wählt sie aus
    const f = karte.getLayer("alt") && karte.queryRenderedFeatures([[e.point.x - 8, e.point.y - 8], [e.point.x + 8, e.point.y + 8]], { layers: ["alt"] })[0];
    if (f && !N.an) return routeWaehlen(f.properties.nr);
    if (N.an) return;
    punktGewaehlt({ lat: e.lngLat.lat, lon: e.lngLat.lng });
  });
}
function routeEbenen() {
  if (karte.getSource("route")) return;
  karte.addSource("alt", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  karte.addLayer({ id: "alt-rand", type: "line", source: "alt", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": dunkel ? "#334155" : "#64748b", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 5, 16, 12], "line-opacity": 0.6 } });
  karte.addLayer({ id: "alt", type: "line", source: "alt", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": dunkel ? "#94a3b8" : "#a5b4fc", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 16, 8] } });
  karte.on("mouseenter", "alt", () => { karte.getCanvas().style.cursor = "pointer"; });
  karte.on("mouseleave", "alt", () => { karte.getCanvas().style.cursor = ""; });
  karte.addSource("route", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  karte.addLayer({ id: "route-rand", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#1e1b4b", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 6, 16, 14], "line-opacity": 0.55 } });
  karte.addLayer({ id: "route", type: "line", source: "route", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": dunkel ? "#818cf8" : "#4f46e5", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3.5, 16, 9] } });
}
function marker(alt, art, p) {
  if (!karte) return null;
  if (alt) alt.remove();
  if (!p) return null;
  const el = document.createElement("div"); el.className = "kk-marker " + art;
  return new maplibregl.Marker({ element: el, anchor: art === "ziel" ? "bottom" : "center", offset: art === "ziel" ? [0, -4] : [0, 0] }).setLngLat([p.lon, p.lat]).addTo(karte);
}
function routeZeichnen(einpassen = true) {
  if (!karte || !karte.getSource("route")) return;
  const r = S.route;
  karte.getSource("route").setData(r ? { type: "Feature", geometry: { type: "LineString", coordinates: r.punkte.map(p => [p[1], p[0]]) } } : { type: "FeatureCollection", features: [] });
  radEbenen(N.an ? null : r);
  const andere = N.an ? [] : (S.routen || []).map((x, nr) => ({ x, nr })).filter(o => o.x !== r);
  karte.getSource("alt")?.setData({ type: "FeatureCollection", features: andere.map(o => ({ type: "Feature", properties: { nr: o.nr }, geometry: { type: "LineString", coordinates: o.x.punkte.map(p => [p[1], p[0]]) } })) });
  if (r && einpassen) {
    const b = new maplibregl.LngLatBounds();
    for (const x of (S.routen && !N.an ? S.routen : [r])) x.punkte.forEach(p => b.extend([p[1], p[0]]));
    karte.stop();
    karte.setPadding({ top: 0, right: 0, bottom: 0, left: 0 }); // flyTo merkt sich den Rand, sonst passt die Route nicht
    karte.fitBounds(b, { padding: randAbstand(), duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600, maxZoom: 16 });
  }
}
function randAbstand() {
  const breit = innerWidth >= 820;
  return breit ? { top: 80, bottom: 40, left: 440, right: 70 } : { top: 80, bottom: Math.round(innerHeight * 0.48), left: 30, right: 70 };
}
const SYM = { stau: "🚗", baustelle: "🚧", sperrung: "⛔", warnung: "⚠️" };
function meldungenZeichnen() {
  meldMarker.forEach(m => m.remove()); meldMarker = [];
  if (!karte || !S.verkehrAn) return;
  for (const m of S.meldungen) {
    const el = document.createElement("button");
    el.type = "button"; el.className = "kk-meldung-pin " + m.art; el.textContent = SYM[m.art] || "⚠️";
    el.setAttribute("aria-label", `${m.titel} ${m.richtung}`);
    const pop = new maplibregl.Popup({ offset: 16, maxWidth: "280px" }).setHTML(`<b>${esc(SYM[m.art])} ${esc(m.titel)}</b><br><small>${esc(m.richtung)}</small><p style="margin:6px 0 0;font-size:.85rem">${esc(m.text.slice(0, 280))}</p>`);
    el.addEventListener("click", ev => ev.stopPropagation());
    meldMarker.push(new maplibregl.Marker({ element: el }).setLngLat([m.lon, m.lat]).setPopup(pop).addTo(karte));
  }
}

/* ---------- Verkehr ---------- */
async function verkehrHolen() {
  await datenBereit;
  const bbox = index?.bbox || [47.4, 7.4, 48.75, 9.0];
  try {
    const r = await meldungenLaden(bbox, { kopie: DATEN + "verkehr.json", anschluss });
    S.meldungen = r.meldungen; S.meldStand = r.stand; S.meldLive = r.live;
  } catch { S.meldungen = []; S.meldStand = null; }
  meldungenZeichnen();
  if (S.ansicht === "start") zeigeStart();
  if (N.an) verkehrUnterwegs();
}

/* ---------- Suche ---------- */
let suchNr = 0, auswahl = -1, letzteTreffer = [];
const ART_SYM = { ort: "🏘️", strasse: "📍", ziel: "⭐" };
async function suchen() {
  const text = $("#q").value.trim();
  $("#qWeg").hidden = !text;
  const liste = $("#treffer");
  if (text.length < 2) { liste.hidden = true; return; }
  const nr = ++suchNr;
  await datenBereit;
  if (!suche) { liste.innerHTML = `<li class="leer">Die Suche für Südbaden wird gerade vorbereitet. Schau bald wieder rein.</li>`; liste.hidden = false; return; }
  const nahe = S.ich || (karte ? { lat: karte.getCenter().lat, lon: karte.getCenter().lng } : null);
  const t = await suche.suchen(text, { nahe });
  if (nr !== suchNr) return;
  letzteTreffer = t; auswahl = -1;
  liste.innerHTML = t.length ? t.map((x, i) => `<li role="option" id="t${i}" data-i="${i}" aria-selected="false"><span class="sym" aria-hidden="true">${ART_SYM[x.art]}</span><span><b>${esc(x.titel)}</b><small>${esc(x.unter)}</small></span></li>`).join("")
    : `<li class="leer">Nichts gefunden. Tipp: Straße und Ort, z. B. „Hauptstraße 5 Lahr“.</li>`;
  liste.hidden = false;
}
function trefferWaehlen(x) {
  $("#treffer").hidden = true;
  $("#q").value = ""; $("#qWeg").hidden = true; $("#q").blur();
  const p = { lat: x.lat, lon: x.lon, name: x.titel, unter: x.unter };
  if (S.wahl?.startsWith("fav:")) return favSetzen(S.wahl.slice(4), p);
  if (S.wahl === "stopp") { S.stopps.push(p); S.wahl = null; planerZeigen(); routeRechnen(); return; }
  if (S.wahl) { S[S.wahl] = p; S.wahl = null; planerZeigen(); routeRechnen(); return; }
  karte?.flyTo({ center: [p.lon, p.lat], zoom: x.zoom || 16, padding: randAbstand(), duration: 800 });
  ortZeigen(p);
}

/* ---------- Ansichten im Blatt ---------- */
const blatt = $("#blatt"), inhalt = $("#blattInhalt");
function blattGroesse(g) { blatt.classList.toggle("gross", g === "gross"); blatt.classList.toggle("klein", g === "klein"); }
$("#griff").onclick = () => blattGroesse(blatt.classList.contains("klein") ? "" : blatt.classList.contains("gross") ? "klein" : "gross");

function zeigeStart() {
  S.ansicht = "start";
  const daten = index ? `Straßen und Adressen für Südbaden, Stand ${new Date(index.stand).toLocaleDateString("de-DE")}.` : datenFehler ? "Die Straßendaten werden gerade vorbereitet – Karte anschauen geht schon." : "Daten werden geladen …";
  const zahl = S.meldungen.length;
  const verkehr = S.meldStand ? `${zahl} Meldungen auf den Autobahnen (${S.meldLive ? "live" : "Stand " + new Date(S.meldStand).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr"}).` : "";
  const fav = (k, sym, t) => `<button class="kk-fav" data-fav="${k}">${sym} <span>${ORTE[k] ? esc(t) : esc(t) + " festlegen"}</span></button>`;
  inhalt.innerHTML = `<h2>Wohin geht's?</h2>
    <div class="kk-favs">${fav("zuhause", "🏠", "Zuhause")}${fav("schule", "🏫", "Schule")}</div>
    ${ORTE.letzte.length ? `<h3 class="kk-klein">Zuletzt</h3><ul class="kk-letzte">${ORTE.letzte.map((x, i) => `<li><button class="ziel" data-l="${i}"><span aria-hidden="true">🕘</span><span><b>${esc(x.name)}</b><small>${esc(x.unter)}</small></span></button><button class="weg" data-w="${i}" aria-label="${esc(x.name)} aus der Liste entfernen">×</button></li>`).join("")}</ul>` : ""}
    <p class="unter">${esc(daten)} ${esc(verkehr)}</p>
    <div class="kk-reihe"><button class="btn primary" id="planen">🧭 Route planen</button></div>
    <p class="kk-hinweis">Kein Tracking, keine Werbung. Deine Suche und deine Route werden auf deinem Gerät berechnet. Kartendaten: © OpenStreetMap-Mitwirkende.</p>`;
  $("#planen").onclick = () => { planerZeigen(); };
  inhalt.querySelectorAll("[data-fav]").forEach(b => b.onclick = () => {
    const k = b.dataset.fav;
    if (ORTE[k]) { S.nach = { ...ORTE[k] }; planerZeigen(); routeRechnen(); }
    else { S.wahl = "fav:" + k; $("#q").placeholder = k === "zuhause" ? "Adresse von Zuhause suchen …" : "Deine Schule suchen …"; $("#q").focus(); KW.toast("Such die Adresse oder tippe auf die Karte."); }
  });
  inhalt.querySelectorAll("[data-l]").forEach(b => b.onclick = () => { S.nach = { ...ORTE.letzte[+b.dataset.l] }; planerZeigen(); routeRechnen(); });
  inhalt.querySelectorAll("[data-w]").forEach(b => b.onclick = () => { ORTE.letzte.splice(+b.dataset.w, 1); orteMerken(); zeigeStart(); });
  blattGroesse(ORTE.letzte.length ? "" : "klein");
}

async function ortZeigen(p) {
  S.ansicht = "ort"; S.ort = p;
  if (karte) { markerNach = marker(markerNach, "ziel", p); }
  inhalt.innerHTML = `<h2>${esc(p.name || "Punkt auf der Karte")}</h2><p class="unter" id="ortUnter">${esc(p.unter || "")}</p>
    <div class="kk-reihe"><button class="btn primary" id="hin">🧭 Route hierher</button><button class="btn" id="ab">Von hier starten</button></div>
    <div class="kk-reihe"><button class="btn small" id="alsZuhause">🏠 Als Zuhause speichern</button><button class="btn small" id="alsSchule">🏫 Als Schule speichern</button></div>
    <div class="kk-reihe"><button class="btn small" id="zurueck">← Zurück</button></div>`;
  $("#alsZuhause").onclick = () => favSetzen("zuhause", p);
  $("#alsSchule").onclick = () => favSetzen("schule", p);
  $("#hin").onclick = () => { S.nach = p; planerZeigen(); routeRechnen(); };
  $("#ab").onclick = () => { S.von = p; planerZeigen(); routeRechnen(); };
  $("#zurueck").onclick = () => { markerNach = marker(markerNach, "ziel", S.route ? S.nach : null); S.route ? planerZeigen() : zeigeStart(); };
  blattGroesse("");
  if (!p.name) {
    await datenBereit;
    if (netz && imGebiet(p)) {
      try {
        const e = await netz.einrasten(p.lat, p.lon, "fuss");
        if (e && S.ort === p) {
          const n = e.k.namen[e.k.nm[e.e]];
          $("#ortUnter").textContent = n ? `In der Nähe: ${n} (${meterText(e.abstand)})` : `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
        }
      } catch {}
    } else $("#ortUnter").textContent = `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;
  }
}

function favSetzen(k, p) {
  S.wahl = null; $("#q").placeholder = "Wohin? Ort, Straße, Hausnummer …";
  ORTE[k] = { name: k === "zuhause" ? "Zuhause" : "Schule", unter: p.name && p.name !== "Punkt auf der Karte" ? p.name : "", lat: p.lat, lon: p.lon };
  orteMerken(); KW.toast(k === "zuhause" ? "Zuhause gespeichert – nur auf diesem Gerät." : "Schule gespeichert – nur auf diesem Gerät.");
  zeigeStart();
}

function punktGewaehlt(p) {
  $("#treffer").hidden = true;
  if (S.wahl?.startsWith("fav:")) return favSetzen(S.wahl.slice(4), { ...p, name: "Punkt auf der Karte" });
  if (S.wahl === "stopp") { S.stopps.push({ ...p, name: "Punkt auf der Karte" }); S.wahl = null; planerZeigen(); routeRechnen(); return; }
  if (S.wahl) { S[S.wahl] = { ...p, name: "Punkt auf der Karte" }; S.wahl = null; planerZeigen(); routeRechnen(); return; }
  ortZeigen(p);
}

const MODI = [["auto", "🚗", "Auto"], ["rad", "🚲", "Rad"], ["fuss", "🚶", "Zu Fuß"]];
const OPTIONEN = {
  auto: [["keineSchleichwege", "Keine Schleichwege durch Wohngebiete"], ["keineEngen", "Keine engen Feld- und Waldwege"], ["keineAutobahn", "Keine Autobahn"],
    ["keineBundes", "Bundesstraßen meiden"], ["keineTunnel", "Tunnel meiden"], ["oeko", "Spritsparend (ruhiger fahren, weniger Ampeln)"]],
  rad: [["abseits", "Nicht auf der Straße (Rad- und Feldwege)"], ["geteert", "Nur geteerte Wege"], ["ruhig", "Ruhige Wege statt großer Straßen"], ["ebike", "E-Bike (schneller unterwegs)"]],
  fuss: [["hell", "Lieber beleuchtete Wege (nachts)"], ["barrierefrei", "Ohne Treppen (Kinderwagen, Rollstuhl)"], ["rast", "Wege mit Bänken und Toiletten"]],
};
function name(p, leer) { return p ? (p.name || "Punkt auf der Karte") : leer; }
function planerZeigen() {
  S.ansicht = "planer";
  inhalt.innerHTML = `<h2>Route planen</h2>
    <div class="kk-punkte">
      <span class="pkt" aria-hidden="true"></span><button class="inp" id="feldVon" style="text-align:left">${esc(name(S.von, "📍 Mein Standort"))}</button>
      <button class="tausch" id="tausch" aria-label="Start und Ziel tauschen">⇅</button>
      ${S.stopps.map((x, i) => `<span class="pkt stopp" aria-hidden="true">${i + 1}</span><div class="kk-stopp"><span>${esc(name(x))}</span><button data-sw="${i}" aria-label="Zwischenziel ${esc(name(x))} entfernen">×</button></div>`).join("")}
      <span class="pkt ziel" aria-hidden="true"></span><button class="inp" id="feldNach" style="text-align:left">${esc(S.runde ? "🔁 Runde " + S.runde + " km" : name(S.nach, "Ziel wählen …"))}</button>
    </div>
    <div class="kk-plus">${S.runde ? "" : `<button class="btn small" id="stoppPlus">＋ Zwischenziel</button>`}${S.modus !== "auto" ? `<span class="kk-runde">🔁 Runde: ${[3, 5, 10, 20].map(k => `<button class="btn small" data-runde="${k}" aria-pressed="${S.runde === k}">${k} km</button>`).join("")}</span>` : ""}</div>
    <div class="kk-modi" role="group" aria-label="Wie bist du unterwegs?">${MODI.map(([m, s, t]) => `<button data-m="${m}" aria-pressed="${S.modus === m}"><span aria-hidden="true">${s}</span>${t}</button>`).join("")}</div>
    <div id="ergebnis"></div>
    <details class="kk-einst" ${!S.route || S.einstOffen ? "open" : ""}><summary>⚙️ Einstellungen</summary>
      <div class="kk-optionen">${OPTIONEN[S.modus].map(([k, t]) => `<label><input type="checkbox" data-o="${k}" ${S.opt[S.modus][k] ? "checked" : ""}>${esc(t)}</label>`).join("")}
      <label><input type="checkbox" id="autoStart" ${S.autoStart ? "checked" : ""}> Navi startet von selbst nach 10 Sekunden</label></div>
    </details>
    <div class="kk-reihe"><button class="btn small" id="zurueck">← Zurück</button></div>
    <div class="kk-startleiste" id="startleiste" hidden><button class="btn primary" id="los">▶ Starten</button></div>`;
  $("#los").onclick = () => { countdownStopp(); naviStarten(false); };
  inhalt.querySelector(".kk-einst").addEventListener("toggle", e => { if (e.isTrusted || e.target.open) S.einstOffen = e.target.open; });
  $("#autoStart").onchange = e => { S.autoStart = e.target.checked; merken(); if (!S.autoStart) countdownStopp(); };
  const waehle = was => { S.wahl = was; $("#q").placeholder = was === "von" ? "Start suchen oder auf die Karte tippen …" : was === "stopp" ? "Zwischenziel suchen oder auf die Karte tippen …" : "Ziel suchen oder auf die Karte tippen …"; $("#q").focus(); blattGroesse("klein"); };
  $("#feldVon").onclick = () => waehle("von");
  $("#feldNach").onclick = () => { S.runde = 0; waehle("nach"); };
  $("#stoppPlus") && ($("#stoppPlus").onclick = () => { if (S.stopps.length >= 5) return KW.toast("Höchstens 5 Zwischenziele."); waehle("stopp"); });
  inhalt.querySelectorAll("[data-sw]").forEach(b => b.onclick = () => { S.stopps.splice(+b.dataset.sw, 1); planerZeigen(); routeRechnen(); });
  inhalt.querySelectorAll("[data-runde]").forEach(b => b.onclick = () => {
    const k = +b.dataset.runde;
    if (S.runde === k) { S.runde = 0; S.nach = null; } else { S.runde = k; S.stopps = []; S.nach = { name: `Runde ${k} km`, lat: 0, lon: 0, runde: true }; }
    planerZeigen(); routeRechnen();
  });
  $("#tausch").onclick = () => { [S.von, S.nach] = [S.nach, S.von]; if (!S.nach && S.von === null) {} planerZeigen(); routeRechnen(); };
  inhalt.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.modus = b.dataset.m; if (S.modus === "auto" && S.runde) { S.runde = 0; S.nach = null; } merken(); planerZeigen(); routeRechnen(); });
  inhalt.querySelectorAll("[data-o]").forEach(c => c.onchange = () => { S.opt[S.modus][c.dataset.o] = c.checked; merken(); routeRechnen(); });
  $("#zurueck").onclick = () => { countdownStopp(); S.route = null; S.routen = null; S.von = S.nach = null; S.stopps = []; S.runde = 0; radEbenen(null); routeZeichnen(); markerVon = marker(markerVon, "von", null); markerNach = marker(markerNach, "ziel", null); history.replaceState(null, "", location.pathname); zeigeStart(); };
  blattGroesse("");
  if (S.route) ergebnisZeigen();
}

function standortHolen() {
  return new Promise((ok, nein) => {
    if (!navigator.geolocation) return nein(new Error("Dein Gerät kann den Standort nicht bestimmen."));
    navigator.geolocation.getCurrentPosition(p => { S.ich = { lat: p.coords.latitude, lon: p.coords.longitude }; ichZeigen(); ok(S.ich); },
      () => nein(new Error("Ich darf deinen Standort nicht sehen. Wähle den Start bitte selbst.")), { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
}
function ichZeigen() {
  if (!karte || !S.ich) return;
  if (!markerIch) { const el = document.createElement("div"); el.className = "kk-ich"; el.setAttribute("aria-label", "Du bist hier"); markerIch = new maplibregl.Marker({ element: el }); }
  markerIch.setLngLat([S.ich.lon, S.ich.lat]).addTo(karte);
}
$("#standortKnopf").onclick = async () => {
  try { const p = await standortHolen(); karte?.flyTo({ center: [p.lon, p.lat], zoom: 15, padding: randAbstand() }); }
  catch (e) { window.KW ? KW.toast(e.message) : alert(e.message); }
};
$("#verkehrKnopf").setAttribute("aria-pressed", String(S.verkehrAn));
$("#verkehrKnopf").onclick = () => { S.verkehrAn = !S.verkehrAn; merken(); $("#verkehrKnopf").setAttribute("aria-pressed", String(S.verkehrAn)); meldungenZeichnen(); };

let rechenNr = 0;
async function routeRechnen() {
  if (!S.nach || S.ansicht !== "planer") return;
  const nr = ++rechenNr;
  const erg = $("#ergebnis");
  erg.innerHTML = `<div class="kk-ergebnis"><div class="kk-laedt">Ich rechne die Route …</div></div>`;
  if ($("#startleiste")) $("#startleiste").hidden = true;
  await datenBereit;
  const fehler = t => { if (nr === rechenNr) erg.innerHTML = `<div class="kk-fehler">${esc(t)}</div>`; };
  if (!netz) return fehler("Die Straßendaten werden gerade vorbereitet. Routen gehen bald.");
  let von = S.von;
  if (!von) { try { von = { ...(await standortHolen()), name: "Mein Standort" }; } catch (e) { return fehler(e.message); } }
  if (S.runde) S.nach = { name: `Runde ${S.runde} km`, lat: von.lat, lon: von.lon, runde: true };
  if (!imGebiet(von) || !imGebiet(S.nach) || S.stopps.some(x => !imGebiet(x))) return fehler("Routen gibt es bisher nur in Südbaden (Regierungsbezirk Freiburg). Weitere Gebiete kommen später.");
  markerVon = marker(markerVon, "von", von); markerNach = marker(markerNach, "ziel", S.nach);
  const luft = Math.hypot((S.nach.lat - von.lat) * 111, (S.nach.lon - von.lon) * 74);
  if (S.modus === "fuss" && luft > 30) return fehler("Zu Fuß rechne ich Wege bis etwa 30 km Luftlinie. Nimm für weitere Strecken lieber Rad oder Auto.");
  if (S.modus === "rad" && luft > 80) return fehler("Mit dem Rad rechne ich Wege bis etwa 80 km Luftlinie.");
  const opt = { modus: S.modus, ...S.opt[S.modus], meldungen: S.modus === "auto" ? S.meldungen : [] };
  const t0 = performance.now();
  countdownStopp();
  let r, ohne = null, routen;
  try {
    if (S.runde) routen = [await netz.runde(von, S.runde, opt)];
    else if (S.stopps.length) routen = [await netz.ueber([von, ...S.stopps, S.nach], opt)];
    else routen = await netz.alternativen(von, S.nach, opt, 3);
    r = routen[0];
    if (!r.fehler && S.modus === "auto" && S.meldungen.length) ohne = await netz.route(von, S.nach, { ...opt, meldungen: [] });
  } catch (e) { console.error(e); return fehler("Beim Rechnen ist etwas schiefgegangen. Hast du Internet für die Kartendaten?"); }
  if (nr !== rechenNr) return;
  if (r.fehler) return fehler({ start: "Am Start ist keine passende Straße in der Nähe.", ziel: "Am Ziel ist keine passende Straße in der Nähe.", weg: "Ich habe keinen erlaubten Weg gefunden. Probier ein anderes Verkehrsmittel oder weniger Einstellungen." }[r.fehler]);
  r.ms = Math.round(performance.now() - t0);
  for (const x of routen) { x.anRoute = meldungenAnRoute(x, S.meldungen); x.ms = r.ms; x.wort = routen.length > 1 ? unterschied(x, r, routen) : ""; }
  try { const pois = await wahrzeichenLaden(); for (const x of routen) wahrzeichen(x.schritte, pois); } catch {}
  // Wurde wegen Meldungen umgeplant? Dann ehrlich vergleichen: die direkte Route mit ihren Verzögerungen
  if (ohne && !ohne.fehler) {
    const anOhne = meldungenAnRoute(ohne, S.meldungen);
    const gesperrt = anOhne.some(m => m.gesperrt);
    const verzug = anOhne.reduce((a, m) => a + (m.minuten || 0) * 60, 0);
    r.vergleich = gesperrt ? null : { sekunden: ohne.sekunden + verzug };
    if (Math.abs(ohne.meter - r.meter) < 50) r.vergleich = null;
  }
  S.route = r; S.routen = routen; S.routeVon = von;
  if (!S.runde) zielMerken(S.nach);
  if (!S.runde && !S.stopps.length) history.replaceState(null, "", `#route=${von.lat.toFixed(5)},${von.lon.toFixed(5)};${S.nach.lat.toFixed(5)},${S.nach.lon.toFixed(5)}&m=${S.modus}`);
  routeZeichnen();
  ergebnisZeigen();
  if (S.autoStart && !S.von) countdownStarten();
}

let poiCache = null;
function wahrzeichenLaden() {
  if (!poiCache) poiCache = Promise.all(["tankstelle", "kirche", "supermarkt", "apotheke", "rathaus", "bahnhof", "schule"]
    .filter(k => index?.kategorien?.[k]).map(k => ladenJSON(`kategorie/${k}.json.gz`).catch(() => []))).then(l => l.flat());
  return poiCache;
}

// Rad: Stücke auf der Straße orange, unbekannter Belag mit „?“
let fragenMarker = [];
function radEbenen(r) {
  if (!karte || !karte.getSource("route")) return;
  if (!karte.getSource("strasse")) {
    karte.addSource("strasse", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    karte.addLayer({ id: "strasse", type: "line", source: "strasse", layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": "#f97316", "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 16, 10] } });
  }
  fragenMarker.forEach(m => m.remove()); fragenMarker = [];
  const info = r && S.modus === "rad" ? radInfo(r) : null;
  karte.getSource("strasse").setData({ type: "FeatureCollection", features: info && S.opt.rad.abseits ? info.stuecke.map(x => ({ type: "Feature", geometry: { type: "LineString", coordinates: x.punkte.map(p => [p[1], p[0]]) } })) : [] });
  if (info && S.opt.rad.geteert) for (const p of info.fragen) {
    const el = document.createElement("div"); el.className = "kk-frage-pin"; el.textContent = "?"; el.title = "Belag unbekannt";
    fragenMarker.push(new maplibregl.Marker({ element: el }).setLngLat([p[1], p[0]]).addTo(karte));
  }
  return info;
}

function routeWaehlen(nr) {
  const r = S.routen?.[nr];
  if (!r || r === S.route) return;
  countdownStopp();
  S.route = r; routeZeichnen(false); ergebnisZeigen();
}

let countdown = null;
function countdownStarten() {
  countdownStopp();
  let rest = 10;
  const k = $("#los"); if (!k) return;
  k.textContent = `▶ Starten (${rest})`;
  countdown = setInterval(() => { rest--; const b = $("#los"); if (!b) return countdownStopp(); b.textContent = `▶ Starten (${rest})`; if (rest <= 0) { countdownStopp(); naviStarten(false); } }, 1000);
}
function countdownStopp() { if (countdown) { clearInterval(countdown); countdown = null; const b = $("#los"); if (b) b.textContent = "▶ Starten"; } }

const meldKarte = m => `<div class="kk-meldung"><span class="sym" aria-hidden="true">${SYM[m.art]}</span><div><b>${esc(m.titel)}</b><small>${esc(m.richtung)}</small>${esc(m.text.slice(0, 200))}</div></div>`;
function meldListe(l) {
  const wichtig = l.filter(m => m.art === "stau" || m.gesperrt), rest = l.filter(m => !(m.art === "stau" || m.gesperrt));
  return wichtig.map(meldKarte).join("") + (rest.length ? `<details class="kk-mehr"><summary>${rest.length} ${rest.length === 1 ? "weitere Meldung" : "weitere Meldungen"} (Baustellen, Einschränkungen)</summary>${rest.map(meldKarte).join("")}</details>` : "");
}
const BEI_TEXT = { Tankstelle: "Bei der Tankstelle", Kirche: "Bei der Kirche", Supermarkt: "Beim Supermarkt", Apotheke: "Bei der Apotheke", Rathaus: "Beim Rathaus", Bahnhof: "Beim Bahnhof", Schule: "Bei der Schule" };
function listenText(s) {
  if (s.bei && s.typ === "abbiegen" && !s.ampel && !s.ordinal && BEI_TEXT[s.bei.art]) return `${BEI_TEXT[s.bei.art]} ${s.text[0].toLowerCase() + s.text.slice(1)}`;
  return s.text;
}
function radText(r) {
  if (S.modus !== "rad") return "";
  const i = radInfo(r);
  const teile = [`${Math.round(i.ohneAutos * 100)} % ohne Autos`];
  if (i.stuecke.length) teile.push(`${i.stuecke.length} ${i.stuecke.length === 1 ? "Stück" : "Stücke"} auf der Straße${S.opt.rad.abseits ? " (orange)" : ""}`);
  if (i.schotter > 50) teile.push(`${meterText(i.schotter)} Schotter/Kies`);
  if (S.opt.rad.geteert && i.unbekannt > 100) teile.push(`${meterText(i.unbekannt)} Belag unbekannt (?)`);
  return `<p class="kk-radinfo">🚲 ${esc(teile.join(" · "))}</p>`;
}
function losUmText(r) {
  if (!S.ankunft) return "";
  const [h, m] = S.ankunft.split(":").map(Number);
  const ziel = new Date(); ziel.setHours(h, m, 0, 0);
  if (ziel < Date.now()) ziel.setDate(ziel.getDate() + 1);
  const los = new Date(ziel - r.sekunden * 1000 - (S.modus === "auto" ? 5 : 2) * 60000); // kleiner Puffer
  const t = los.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return los < Date.now() ? `→ Du bist spät dran! Am besten sofort los.` : `→ Losfahren um ${t} Uhr`;
}
const PFEIL = d => { const w = drehWort(d); return w.includes("links") ? "↰" : w.includes("rechts") ? "↱" : w === "wenden" ? "↶" : "↑"; };
function ergebnisZeigen() {
  const r = S.route, erg = $("#ergebnis");
  if (!r || !erg) return;
  const ankunft = new Date(Date.now() + r.sekunden * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const wahl = (S.routen || []).length > 1 ? `<div class="kk-wahl" role="radiogroup" aria-label="Routen zur Auswahl">${S.routen.map((x, i) => `<button role="radio" aria-checked="${x === r}" data-r="${i}"><b>${esc(zeitText(x.sekunden))}</b><span>${x === S.routen[0] ? "Schnellste" : "+" + esc(zeitText(x.sekunden - S.routen[0].sekunden))}</span><small>${esc(meterText(x.meter))} · ${esc(x === S.routen[0] ? (x.strassen[0] ? "über " + x.strassen.slice(0, 2).map(s => s.name).join(", ") : "kürzester Weg") : x.wort)}</small></button>`).join("")}</div>` : "";
  erg.innerHTML = `<div class="kk-ergebnis">
    ${wahl}
    <div class="kk-zeit"><b>${esc(zeitText(r.sekunden))}</b><span>${esc(meterText(r.meter))} · an ${ankunft} Uhr${S.stopps.length ? " · " + S.stopps.length + " Zwischenziel" + (S.stopps.length > 1 ? "e" : "") : ""}</span></div>
    ${radText(r)}
    <label class="kk-ankunft">⏰ Ankommen um <input type="time" id="ankunftZeit" value="${esc(S.ankunft)}"> <span id="losUm">${losUmText(r)}</span></label>
    <div class="kk-erklaer"><span class="wer">Warum diese Route</span>${esc(routeErklaeren(r, r.anRoute, S.modus, r.vergleich))}</div>
    ${meldListe(r.anRoute)}
    <div class="kk-reihe"><button class="btn small" id="teilen">Route teilen</button><button class="btn small" id="probe">🎬 Probefahrt</button></div>
    <h3 style="margin:14px 0 0;font-size:1rem">So geht's</h3>
    <ol class="kk-schritte">${r.schritte.map((s, i) => `<li data-i="${i}"><span class="pfeil" aria-hidden="true">${i ? pfeilVon(s) : "●"}</span><span>${esc(listenText(s))}</span><small>${esc(meterText(s.meter))}</small></li>`).join("")}
      <li><span class="pfeil" aria-hidden="true">🏁</span><span>Ziel: ${esc(name(S.nach))}</span><small></small></li></ol>
    <p class="kk-hinweis">${S.modus === "auto" ? "Staus und Baustellen kennen wir nur von den Autobahnen und rechnen sie ungefähr ein. " : ""}Achte immer auf Schilder und Verkehr – die Karte kann sich irren. Gerechnet in ${r.ms} ms auf deinem Gerät.</p></div>`;
  $("#startleiste").hidden = false;
  const einst = inhalt.querySelector(".kk-einst"); if (einst && !S.einstOffen) einst.open = false;
  erg.querySelectorAll("[data-r]").forEach(b => b.onclick = () => routeWaehlen(+b.dataset.r));
  $("#ankunftZeit").onchange = e => { S.ankunft = e.target.value; $("#losUm").textContent = losUmText(r); };
  erg.querySelectorAll(".kk-schritte li[data-i]").forEach(li => li.onclick = () => { const s = r.schritte[+li.dataset.i]; karte?.flyTo({ center: [s.punkt[1], s.punkt[0]], zoom: 17, padding: randAbstand() }); });
  $("#probe").onclick = () => { countdownStopp(); naviStarten(true); };
  $("#teilen").onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: "Route – OMNIVIA Karten", text: `Route nach ${name(S.nach)}`, url }); else { await navigator.clipboard.writeText(url); KW.toast("Link kopiert."); } } catch {}
  };
}

/* ---------- Navigation ---------- */
const N = { an: false, v: null, watch: null, gesagt: new Map(), ton: true, weg: 0, frage: null, demo: null, lock: null, f: null, tempo: 0, fertig: false };
try { N.ton = KW.load("kw-karten-ton", true) !== false; } catch {}
function sprechen(t) {
  if (!N.ton || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(t); u.lang = "de-DE"; u.rate = 1.02;
    const st = speechSynthesis.getVoices().filter(v => v.lang && v.lang.toLowerCase().startsWith("de"));
    if (st.length) u.voice = st.find(v => /Anna|Helena|Google/i.test(v.name)) || st[0];
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch {}
}
async function wachHalten(an) {
  try {
    if (an && "wakeLock" in navigator) N.lock = await navigator.wakeLock.request("screen");
    else if (!an && N.lock) { await N.lock.release(); N.lock = null; }
  } catch {}
}
document.addEventListener("visibilitychange", () => { if (N.an && document.visibilityState === "visible") wachHalten(true); });

const zeitSprechen = sek => { const min = Math.max(1, Math.round(sek / 60)), h = Math.floor(min / 60), m = min % 60;
  const hs = h ? `${h} ${h === 1 ? "Stunde" : "Stunden"}` : "", ms = m ? `${m} ${m === 1 ? "Minute" : "Minuten"}` : "";
  return [hs, ms].filter(Boolean).join(" und "); };
function naviStarten(demo) {
  if (!S.route) return;
  N.an = true; N.v = vorbereiten(S.route); N.gesagt = new Map(); N.weg = 0; N.fertig = false; N.f = null;
  document.body.classList.add("navi");
  routeZeichnen(false);
  $("#naviOben").hidden = false; $("#naviUnten").hidden = false; $("#naviFrage").hidden = true;
  $("#nTon").setAttribute("aria-pressed", String(N.ton)); $("#nTon").textContent = N.ton ? "🔊" : "🔇";
  wachHalten(true);
  const n = S.route.schritte.length > 1 ? S.route.schritte[1] : null;
  sprechen(`Los geht's. ${zeitSprechen(S.route.sekunden)} bis zum Ziel.`);
  if (demo) {
    // Probefahrt: fährt die Route im Zeitraffer ab – zum Ausprobieren ohne loszufahren
    let pos = 0;
    const tempo = { auto: 14, rad: 5, fuss: 1.5 }[S.modus] * 4;
    N.demo = setInterval(() => {
      pos = Math.min(N.v.gesamt, pos + tempo * 0.5);
      const p = punktBei(N.v, pos);
      naviPosition(p[0], p[1], tempo / 4, 5);
      if (pos >= N.v.gesamt) { clearInterval(N.demo); N.demo = null; }
    }, 500);
  } else if (navigator.geolocation) {
    N.watch = navigator.geolocation.watchPosition(
      p => naviPosition(p.coords.latitude, p.coords.longitude, p.coords.speed || 0, p.coords.accuracy || 20),
      () => KW.toast("Ich bekomme gerade keinen Standort. Ist GPS an?"),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }
  if (S.ich) naviPosition(S.ich.lat, S.ich.lon, 0, 20);
}
function punktBei(v, m) {
  let i = 1; while (i < v.d.length - 1 && v.d[i] < m) i++;
  const a = v.punkte[i - 1], b = v.punkte[i], t = v.d[i] === v.d[i - 1] ? 0 : (m - v.d[i - 1]) / (v.d[i] - v.d[i - 1]);
  return [a[0] + (b[0] - a[0]) * Math.min(1, Math.max(0, t)), a[1] + (b[1] - a[1]) * Math.min(1, Math.max(0, t))];
}
function naviPosition(lat, lon, tempo, genau) {
  if (!N.an || !N.v) return;
  S.ich = { lat, lon }; ichZeigen(); N.tempo = tempo;
  const f = fortschritt(N.v, lat, lon); N.f = f;
  { const n0 = naechste(N.v, f.entlang); N.nah = !!(n0 && n0.bis < 150 && drehWort(n0.schritt.dreh) !== "geradeaus"); }
  // Kamera folgt, Fahrtrichtung zeigt nach oben
  if (karte) karte.easeTo({ center: [lon, lat], bearing: f.neben < 60 ? f.grad : karte.getBearing(), pitch: S.modus === "auto" ? 50 : 30,
    zoom: N.nah ? (S.modus === "auto" ? 17.6 : 18.2) : S.modus === "auto" ? (tempo > 22 ? 14.8 : 16) : 17.3, padding: { top: 150, bottom: 160, left: 0, right: 0 }, duration: 900 });
  // Von der Route abgekommen? Erst fragen, nicht still umplanen
  const grenze = Math.max(S.modus === "auto" ? 50 : 30, (genau || 20) * 1.5);
  N.weg = f.neben > grenze ? N.weg + 1 : 0;
  if (N.weg >= 3 && !N.frage) {
    sprechen("Du hast die Route verlassen. Soll ich neu rechnen?");
    frage("Du hast die Route verlassen. Neue Route berechnen?", "Neu berechnen", () => neuBerechnen(), "Nein, weiter", 10);
  }
  if (f.rest < 25 && f.neben < 60) return ankommen();
  const n = naechste(N.v, f.entlang);
  const bis = n ? n.bis : f.rest;
  const danach = n ? danachVon(N.v, n.nr) : null;
  $("#nPfeil").innerHTML = esc(n ? pfeilVon(n.schritt) : "🏁") + (n && n.schritt.typ === "kreisel" ? `<sup>${n.schritt.ausfahrt}</sup>` : "");
  $("#nDanach").hidden = !danach || bis > 400;
  if (danach) $("#nDanach").textContent = `danach ${pfeilVon(danach)} ${drehWort(danach.dreh) || ""}`;
  const sp = n && n.schritt.spuren && bis < 700 ? n.schritt.spuren : null;
  $("#nSpuren").hidden = !sp;
  if (sp) $("#nSpuren").innerHTML = sp.map(x => `<span class="${x.passt ? "an" : ""}">${spurPfeil(x.pfeile)}</span>`).join("");
  abbiegeMarker(n && bis < 400 ? n.schritt : null);
  $("#nBis").textContent = meterText(bis);
  $("#nText").textContent = n ? kurzText(n.schritt) : `Ziel: ${name(S.nach)}`;
  const restSek = S.route.sekunden * (f.rest / Math.max(1, N.v.gesamt));
  $("#nZeit").textContent = zeitText(restSek);
  const schild = tempoSchild(N.v, f.entlang);
  $("#nSchild").hidden = !(S.modus === "auto" && schild);
  if (schild) $("#nSchild").textContent = schild;
  $("#nRest").textContent = `${meterText(f.rest)} · an ${new Date(Date.now() + restSek * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr`;
  const key = n ? n.nr : "ziel";
  if (!N.gesagt.has(key)) N.gesagt.set(key, new Set());
  // Geradeaus wird nicht angesagt (außer Auf- und Abfahrten) – sonst redet das Navi zu viel
  const still = n && ["abbiegen", "weiter"].includes(n.schritt.typ) && (drehWort(n.schritt.dreh) === "geradeaus" || n.schritt.nachKreisel);
  if (!still && f.neben < grenze && faellig(bis, S.modus, N.gesagt.get(key), tempo)) {
    const t = ansage(n ? n.schritt : null, bis, danach);
    const kern = t.replace(/^(In [^ ]+ [^ ]+|Jetzt) /, "");
    if (!(N.zuletzt && N.zuletzt.kern === kern && N.zuletzt.stufe === bis > 120 && Date.now() - N.zuletzt.zeit < 25000)) sprechen(t);
    N.zuletzt = { kern, stufe: bis > 120, zeit: Date.now() };
  }
}
function spurPfeil(p) {
  const t = p.split(";");
  return t.map(x => ({ left: "↰", slight_left: "↖", sharp_left: "↙", right: "↱", slight_right: "↗", sharp_right: "↘", through: "↑", reverse: "↶", merge_to_left: "↖", merge_to_right: "↗", none: "↑" }[x] || "↑")).join("");
}
let abbiegeM = null, abbiegeS = null;
function abbiegeMarker(s) {
  if (!karte || s === abbiegeS) return;
  abbiegeS = s;
  if (abbiegeM) { abbiegeM.remove(); abbiegeM = null; }
  if (!s || !s.punkt || s.typ === "zwischenziel") return;
  const el = document.createElement("div"); el.className = "kk-abbiege-pin"; el.textContent = pfeilVon(s);
  abbiegeM = new maplibregl.Marker({ element: el }).setLngLat([s.punkt[1], s.punkt[0]]).addTo(karte);
}
function ankommen() {
  if (N.fertig) return; N.fertig = true;
  sprechen(`Du bist angekommen${S.nach?.name && S.nach.name !== "Ziel" && S.nach.name !== "Punkt auf der Karte" ? ": " + S.nach.name : ""}.`);
  $("#nPfeil").textContent = "🏁"; $("#nBis").textContent = "Angekommen!"; $("#nText").textContent = name(S.nach);
  setTimeout(naviEnde, 6000);
}
function naviEnde() {
  N.an = false;
  if (N.watch !== null) { navigator.geolocation.clearWatch(N.watch); N.watch = null; }
  if (N.demo) { clearInterval(N.demo); N.demo = null; }
  frageWeg(); wachHalten(false);
  try { speechSynthesis.cancel(); } catch {}
  document.body.classList.remove("navi");
  abbiegeMarker(null);
  $("#naviOben").hidden = true; $("#naviUnten").hidden = true;
  if (karte) { karte.setPadding({ top: 0, right: 0, bottom: 0, left: 0 }); karte.easeTo({ pitch: 0, bearing: 0, duration: 400 }); }
  routeZeichnen(true);
}
$("#nEnde").onclick = naviEnde;
$("#nTon").onclick = () => { N.ton = !N.ton; try { KW.save("kw-karten-ton", N.ton); } catch {} $("#nTon").setAttribute("aria-pressed", String(N.ton)); $("#nTon").textContent = N.ton ? "🔊" : "🔇"; if (!N.ton) try { speechSynthesis.cancel(); } catch {} };

let frageUhr = null;
function frage(text, ja, beiJa, nein, autoSek = 0) {
  frageWeg();
  N.frage = true;
  const box = $("#naviFrage");
  box.innerHTML = `<p>${esc(text)}</p><div class="kk-reihe"><button class="btn primary" id="fJa">${esc(ja)}</button><button class="btn" id="fNein">${esc(nein)}</button></div>`;
  box.hidden = false;
  let rest = autoSek;
  const knopf = $("#fJa");
  if (autoSek) {
    knopf.textContent = `${ja} (${rest})`;
    frageUhr = setInterval(() => { rest--; knopf.textContent = `${ja} (${rest})`; if (rest <= 0) { frageWeg(); beiJa(); } }, 1000);
  }
  knopf.onclick = () => { frageWeg(); beiJa(); };
  $("#fNein").onclick = () => { frageWeg(); N.weg = -20; };
}
function frageWeg() { clearInterval(frageUhr); frageUhr = null; N.frage = null; const b = $("#naviFrage"); if (b) b.hidden = true; }

async function neuBerechnen(fertig = null) {
  if (!S.ich || !netz) return;
  const opt = { modus: S.modus, ...S.opt[S.modus], meldungen: S.modus === "auto" ? S.meldungen : [] };
  const r = fertig || await netz.route(S.ich, S.nach, opt);
  if (!r || r.fehler) { sprechen("Ich finde gerade keinen neuen Weg."); return; }
  r.anRoute = meldungenAnRoute(r, S.meldungen); r.ms = 0;
  S.route = r; S.routen = [r]; S.von = { ...S.ich, name: "Mein Standort" };
  N.v = vorbereiten(r); N.gesagt = new Map(); N.weg = 0;
  routeZeichnen(false);
  sprechen(`Neue Route. ${zeitSprechen(r.sekunden)} bis zum Ziel.`);
}

// Neue Verkehrsmeldungen während der Fahrt: Umweg vorschlagen, wenn er wirklich Zeit spart
async function verkehrUnterwegs() {
  if (!N.an || S.modus !== "auto" || !N.f || !netz || N.frage) return;
  const opt = { modus: "auto", ...S.opt.auto, meldungen: S.meldungen };
  const jetzt = netz.restKosten(S.route, N.f.entlang, opt);
  const alt = await netz.route(S.ich, S.nach, opt);
  if (!alt || alt.fehler) return;
  const spart = jetzt - alt.sekunden;
  if (spart > 180 && Math.abs(alt.meter - N.f.rest) > 300) {
    const min = Math.round(spart / 60);
    const grund = jetzt === Infinity ? "Auf deiner Strecke ist jetzt eine Sperrung." : `Neue Verkehrsmeldung: Ein anderer Weg spart etwa ${min} Minuten.`;
    sprechen(grund + " Soll ich umplanen?");
    frage(grund + " Umplanen?", "Ja, umplanen", () => neuBerechnen(alt), "Nein, bleiben");
  }
}

/* ---------- Eingaben ---------- */
const q = $("#q");
let tipp = 0;
q.addEventListener("input", () => { clearTimeout(tipp); tipp = setTimeout(suchen, 120); });
q.addEventListener("keydown", e => {
  const li = [...$("#treffer").querySelectorAll("li[data-i]")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault(); if (!li.length) return;
    auswahl = (auswahl + (e.key === "ArrowDown" ? 1 : -1) + li.length) % li.length;
    li.forEach((x, i) => x.setAttribute("aria-selected", String(i === auswahl)));
    q.setAttribute("aria-activedescendant", "t" + auswahl);
  } else if (e.key === "Escape") { $("#treffer").hidden = true; S.wahl = null; }
});
$("#suchForm").onsubmit = e => { e.preventDefault(); const x = letzteTreffer[Math.max(0, auswahl)]; if (x && !$("#treffer").hidden) trefferWaehlen(x); };
$("#treffer").addEventListener("click", e => { const li = e.target.closest("li[data-i]"); if (li) trefferWaehlen(letzteTreffer[+li.dataset.i]); });
$("#qWeg").onclick = () => { q.value = ""; $("#qWeg").hidden = true; $("#treffer").hidden = true; q.focus(); };
q.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== q) q.placeholder = "Wohin? Ort, Straße, Hausnummer …"; }, 200));

/* ---------- Start ---------- */
function linkLesen() {
  const m = location.hash.match(/route=([\d.-]+),([\d.-]+);([\d.-]+),([\d.-]+)(?:&m=(\w+))?/);
  if (!m) return false;
  S.von = { lat: +m[1], lon: +m[2], name: "Start" }; S.nach = { lat: +m[3], lon: +m[4], name: "Ziel" };
  if (["auto", "rad", "fuss"].includes(m[5])) S.modus = m[5];
  return true;
}
karteStarten();
if (linkLesen()) { planerZeigen(); routeRechnen(); } else zeigeStart();
datenBereit.then(() => { if (S.ansicht === "start") zeigeStart(); });
verkehrHolen();
setInterval(verkehrHolen, 10 * 60 * 1000);
window.KARTEN = S; window.KARTE = () => karte; window.NAVI = N; window.NAVI_POS = naviPosition;
