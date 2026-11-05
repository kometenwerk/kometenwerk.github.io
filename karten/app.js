// OMNIVIA Karten – Oberfläche
import { Netz, meterText, drehWort } from "./netz.js";
import { Suche } from "./suche.js";
import { meldungenLaden, meldungenAnRoute, routeErklaeren, zeitText } from "./verkehr.js";

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
  von: null, nach: null, route: null, wahl: null, verkehrAn: gespeichert.verkehrAn !== false,
  meldungen: [], meldStand: null, meldLive: false, ich: null, ansicht: "start", ort: null,
};
function merken() { window.KW && KW.save("kw-karten", { modus: S.modus, opt: S.opt, verkehrAn: S.verkehrAn }); }

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
    suche = new Suche(ladenJSON, index.suche, await ladenJSON("orte.json"));
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
  karte.on("click", e => punktGewaehlt({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
}
function routeEbenen() {
  if (karte.getSource("route")) return;
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
function routeZeichnen() {
  if (!karte || !karte.getSource("route")) return;
  const r = S.route;
  karte.getSource("route").setData(r ? { type: "Feature", geometry: { type: "LineString", coordinates: r.punkte.map(p => [p[1], p[0]]) } } : { type: "FeatureCollection", features: [] });
  if (r) {
    const b = new maplibregl.LngLatBounds();
    r.punkte.forEach(p => b.extend([p[1], p[0]]));
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
  inhalt.innerHTML = `<h2>Wohin geht's?</h2><p class="unter">${esc(daten)} ${esc(verkehr)}</p>
    <div class="kk-reihe"><button class="btn primary" id="planen">🧭 Route planen</button></div>
    <p class="kk-hinweis">Kein Tracking, keine Werbung. Deine Suche und deine Route werden auf deinem Gerät berechnet. Kartendaten: © OpenStreetMap-Mitwirkende.</p>`;
  $("#planen").onclick = () => { planerZeigen(); };
  blattGroesse("klein");
}

async function ortZeigen(p) {
  S.ansicht = "ort"; S.ort = p;
  if (karte) { markerNach = marker(markerNach, "ziel", p); }
  inhalt.innerHTML = `<h2>${esc(p.name || "Punkt auf der Karte")}</h2><p class="unter" id="ortUnter">${esc(p.unter || "")}</p>
    <div class="kk-reihe"><button class="btn primary" id="hin">🧭 Route hierher</button><button class="btn" id="ab">Von hier starten</button></div>
    <div class="kk-reihe"><button class="btn small" id="zurueck">← Zurück</button></div>`;
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

function punktGewaehlt(p) {
  $("#treffer").hidden = true;
  if (S.wahl) { S[S.wahl] = { ...p, name: "Punkt auf der Karte" }; S.wahl = null; planerZeigen(); routeRechnen(); return; }
  ortZeigen(p);
}

const MODI = [["auto", "🚗", "Auto"], ["rad", "🚲", "Rad"], ["fuss", "🚶", "Zu Fuß"]];
const OPTIONEN = {
  auto: [["keineSchleichwege", "Keine Schleichwege durch Wohngebiete"], ["keineEngen", "Keine engen Feld- und Waldwege"], ["keineAutobahn", "Keine Autobahn"]],
  rad: [["ruhig", "Ruhige Wege statt großer Straßen"]],
  fuss: [["hell", "Lieber beleuchtete Wege (nachts)"], ["barrierefrei", "Ohne Treppen (Kinderwagen, Rollstuhl)"]],
};
function name(p, leer) { return p ? (p.name || "Punkt auf der Karte") : leer; }
function planerZeigen() {
  S.ansicht = "planer";
  inhalt.innerHTML = `<h2>Route planen</h2>
    <div class="kk-punkte">
      <span class="pkt" aria-hidden="true"></span><button class="inp" id="feldVon" style="text-align:left">${esc(name(S.von, "📍 Mein Standort"))}</button>
      <button class="tausch" id="tausch" aria-label="Start und Ziel tauschen">⇅</button>
      <span class="pkt ziel" aria-hidden="true"></span><button class="inp" id="feldNach" style="text-align:left">${esc(name(S.nach, "Ziel wählen …"))}</button>
    </div>
    <div class="kk-modi" role="group" aria-label="Wie bist du unterwegs?">${MODI.map(([m, s, t]) => `<button data-m="${m}" aria-pressed="${S.modus === m}"><span aria-hidden="true">${s}</span>${t}</button>`).join("")}</div>
    <div class="kk-optionen">${OPTIONEN[S.modus].map(([k, t]) => `<label><input type="checkbox" data-o="${k}" ${S.opt[S.modus][k] ? "checked" : ""}>${esc(t)}</label>`).join("")}</div>
    <div id="ergebnis"></div>
    <div class="kk-reihe"><button class="btn small" id="zurueck">← Zurück</button></div>`;
  const waehle = was => { S.wahl = was; $("#q").placeholder = was === "von" ? "Start suchen oder auf die Karte tippen …" : "Ziel suchen oder auf die Karte tippen …"; $("#q").focus(); blattGroesse("klein"); };
  $("#feldVon").onclick = () => waehle("von");
  $("#feldNach").onclick = () => waehle("nach");
  $("#tausch").onclick = () => { [S.von, S.nach] = [S.nach, S.von]; if (!S.nach && S.von === null) {} planerZeigen(); routeRechnen(); };
  inhalt.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { S.modus = b.dataset.m; merken(); planerZeigen(); routeRechnen(); });
  inhalt.querySelectorAll("[data-o]").forEach(c => c.onchange = () => { S.opt[S.modus][c.dataset.o] = c.checked; merken(); routeRechnen(); });
  $("#zurueck").onclick = () => { S.route = null; S.von = S.nach = null; routeZeichnen(); markerVon = marker(markerVon, "von", null); markerNach = marker(markerNach, "ziel", null); history.replaceState(null, "", location.pathname); zeigeStart(); };
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
  await datenBereit;
  const fehler = t => { if (nr === rechenNr) erg.innerHTML = `<div class="kk-fehler">${esc(t)}</div>`; };
  if (!netz) return fehler("Die Straßendaten werden gerade vorbereitet. Routen gehen bald.");
  let von = S.von;
  if (!von) { try { von = { ...(await standortHolen()), name: "Mein Standort" }; } catch (e) { return fehler(e.message); } }
  if (!imGebiet(von) || !imGebiet(S.nach)) return fehler("Routen gibt es bisher nur in Südbaden (Regierungsbezirk Freiburg). Weitere Gebiete kommen später.");
  markerVon = marker(markerVon, "von", von); markerNach = marker(markerNach, "ziel", S.nach);
  const luft = Math.hypot((S.nach.lat - von.lat) * 111, (S.nach.lon - von.lon) * 74);
  if (S.modus === "fuss" && luft > 30) return fehler("Zu Fuß rechne ich Wege bis etwa 30 km Luftlinie. Nimm für weitere Strecken lieber Rad oder Auto.");
  if (S.modus === "rad" && luft > 80) return fehler("Mit dem Rad rechne ich Wege bis etwa 80 km Luftlinie.");
  const opt = { modus: S.modus, ...S.opt[S.modus], meldungen: S.modus === "auto" ? S.meldungen : [] };
  const t0 = performance.now();
  let r, ohne = null;
  try {
    r = await netz.route(von, S.nach, opt);
    if (!r.fehler && S.modus === "auto" && S.meldungen.length) ohne = await netz.route(von, S.nach, { ...opt, meldungen: [] });
  } catch (e) { console.error(e); return fehler("Beim Rechnen ist etwas schiefgegangen. Hast du Internet für die Kartendaten?"); }
  if (nr !== rechenNr) return;
  if (r.fehler) return fehler({ start: "Am Start ist keine passende Straße in der Nähe.", ziel: "Am Ziel ist keine passende Straße in der Nähe.", weg: "Ich habe keinen erlaubten Weg gefunden. Probier ein anderes Verkehrsmittel oder weniger Einstellungen." }[r.fehler]);
  r.ms = Math.round(performance.now() - t0);
  r.anRoute = meldungenAnRoute(r, S.meldungen);
  // Wurde wegen Meldungen umgeplant? Dann ehrlich vergleichen: die direkte Route mit ihren Verzögerungen
  if (ohne && !ohne.fehler) {
    const anOhne = meldungenAnRoute(ohne, S.meldungen);
    const gesperrt = anOhne.some(m => m.gesperrt);
    const verzug = anOhne.reduce((a, m) => a + (m.minuten || 0) * 60, 0);
    r.vergleich = gesperrt ? null : { sekunden: ohne.sekunden + verzug };
    if (Math.abs(ohne.meter - r.meter) < 50) r.vergleich = null;
  }
  S.route = r; S.routeVon = von;
  history.replaceState(null, "", `#route=${von.lat.toFixed(5)},${von.lon.toFixed(5)};${S.nach.lat.toFixed(5)},${S.nach.lon.toFixed(5)}&m=${S.modus}`);
  routeZeichnen();
  ergebnisZeigen();
}

const meldKarte = m => `<div class="kk-meldung"><span class="sym" aria-hidden="true">${SYM[m.art]}</span><div><b>${esc(m.titel)}</b><small>${esc(m.richtung)}</small>${esc(m.text.slice(0, 200))}</div></div>`;
function meldListe(l) {
  const wichtig = l.filter(m => m.art === "stau" || m.gesperrt), rest = l.filter(m => !(m.art === "stau" || m.gesperrt));
  return wichtig.map(meldKarte).join("") + (rest.length ? `<details class="kk-mehr"><summary>${rest.length} ${rest.length === 1 ? "weitere Meldung" : "weitere Meldungen"} (Baustellen, Einschränkungen)</summary>${rest.map(meldKarte).join("")}</details>` : "");
}
const PFEIL = d => { const w = drehWort(d); return w.includes("links") ? "↰" : w.includes("rechts") ? "↱" : w === "wenden" ? "↶" : "↑"; };
function ergebnisZeigen() {
  const r = S.route, erg = $("#ergebnis");
  if (!r || !erg) return;
  const ankunft = new Date(Date.now() + r.sekunden * 1000).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  erg.innerHTML = `<div class="kk-ergebnis">
    <div class="kk-zeit"><b>${esc(zeitText(r.sekunden))}</b><span>${esc(meterText(r.meter))} · an ${ankunft} Uhr</span></div>
    <div class="kk-erklaer"><span class="wer">Warum diese Route</span>${esc(routeErklaeren(r, r.anRoute, S.modus, r.vergleich))}</div>
    ${meldListe(r.anRoute)}
    <div class="kk-reihe"><button class="btn small" id="teilen">Route teilen</button></div>
    <h3 style="margin:14px 0 0;font-size:1rem">So geht's</h3>
    <ol class="kk-schritte">${r.schritte.map((s, i) => `<li data-i="${i}"><span class="pfeil" aria-hidden="true">${i ? PFEIL(s.dreh) : "●"}</span><span>${esc(s.text)}</span><small>${esc(meterText(s.meter))}</small></li>`).join("")}
      <li><span class="pfeil" aria-hidden="true">🏁</span><span>Ziel: ${esc(name(S.nach))}</span><small></small></li></ol>
    <p class="kk-hinweis">${S.modus === "auto" ? "Staus und Baustellen kennen wir nur von den Autobahnen und rechnen sie ungefähr ein. " : ""}Achte immer auf Schilder und Verkehr – die Karte kann sich irren. Gerechnet in ${r.ms} ms auf deinem Gerät.</p></div>`;
  erg.querySelectorAll(".kk-schritte li[data-i]").forEach(li => li.onclick = () => { const s = r.schritte[+li.dataset.i]; karte?.flyTo({ center: [s.punkt[1], s.punkt[0]], zoom: 17, padding: randAbstand() }); });
  $("#teilen").onclick = async () => {
    const url = location.href;
    try { if (navigator.share) await navigator.share({ title: "Route – OMNIVIA Karten", text: `Route nach ${name(S.nach)}`, url }); else { await navigator.clipboard.writeText(url); KW.toast("Link kopiert."); } } catch {}
  };
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
window.KARTEN = S; window.KARTE = () => karte;
