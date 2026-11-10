// FIDELIA Notizen · Referentenansicht (Beamer) und Handy-Fernbedienung
// Laptop: aktuelle + nächste Folie, Notizen, Uhr. Der Beamer bekommt ein eigenes Fenster (beamer.html) über BroadcastChannel.
// Handy: Fernbedienung über die verschlüsselte Geräte-Verbindung (Sync.blitz) – nur wenn die Geräte verbunden sind.

import * as K from "./folien-kern.js";
import * as Sync from "./sync.js";

const KW = window.KW, esc = KW.esc;
const schritte = (f) => (f && f.el ? f.el.filter(e => e.anim).length : 0);
const titelVon = (f, i) => { const t = f && f.el && f.el.find(e => e.rolle === "titel"); return t ? String(t.html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "Folie " + (i + 1); };

// Reine Logik: einen Schritt weiter/zurück (mit Animationen) → neuer Stand
export function schrittWeiter(folien, st) {
  if (st.fi >= folien.length) return st;
  if (st.schritt < schritte(folien[st.fi])) return { fi: st.fi, schritt: st.schritt + 1 };
  return { fi: st.fi + 1, schritt: 0 };
}
export function schrittZurueck(folien, st) {
  if (st.fi >= folien.length) return { fi: folien.length - 1, schritt: schritte(folien[folien.length - 1]) };
  if (st.schritt > 0) return { fi: st.fi, schritt: st.schritt - 1 };
  if (st.fi > 0) return { fi: st.fi - 1, schritt: schritte(folien[st.fi - 1]) };
  return st;
}
export const zeitText = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* ---------- Referentenansicht ---------- */
export function referentansicht(A, s, start = 0, { katex }) {
  const kanal = new BroadcastChannel("fidelia-beamer");
  let st = { fi: start, schritt: 0 }, schwarz = false, laserAn = false, beginn = Date.now(), schrift = KW.load("kw-referent-schrift", 20), beamer = null, beamerDa = false;
  const r = document.createElement("div"); r.className = "referent"; r.tabIndex = -1; r.setAttribute("role", "dialog"); r.setAttribute("aria-label", "Referentenansicht");
  r.innerHTML = '<div class="rf-kopf"><b class="rf-zeit" id="rfZeit" title="Seit Beginn">0:00</b><button type="button" class="rf-k" id="rfNull" title="Zeit neu starten" aria-label="Zeit neu starten">↺</button><span class="rf-uhr" id="rfUhr"></span><span class="rf-nr" id="rfNr"></span><span class="sp"></span>' +
    '<span class="rf-status" id="rfBeamer"></span><button type="button" class="rf-k" id="rfFenster" title="Beamer-Fenster öffnen">🖥️ Beamer</button><button type="button" class="rf-k" id="rfSchwarz" title="Bild schwarz (B)">⬛</button><button type="button" class="rf-k" id="rfLaser" title="Laserpointer (L)">🔴</button><button type="button" class="rf-k" id="rfHandy" title="Handy als Fernbedienung">📱</button><button type="button" class="rf-k" id="rfEnde" title="Beenden (Esc)" aria-label="Beenden">✕</button></div>' +
    '<div class="rf-mitte"><div class="rf-jetzt"><div class="rf-buehne" id="rfJetzt"></div></div><div class="rf-seite"><div class="rf-naechste"><small>Als Nächstes</small><div class="rf-buehne klein" id="rfNext"></div></div>' +
    '<div class="rf-notiz"><div class="rf-notiz-kopf"><small>Notizen</small><span class="sp"></span><button type="button" class="rf-k" data-sg="-1" aria-label="Notizen kleiner">A−</button><button type="button" class="rf-k" data-sg="1" aria-label="Notizen größer">A+</button></div><div id="rfNotiz" class="rf-notiz-text"></div></div></div></div>' +
    '<div class="rf-fuss"><button type="button" class="rf-gross" id="rfZurueck" aria-label="Zurück">◀</button><div class="rf-streifen" id="rfStreifen"></div><button type="button" class="rf-gross primaer" id="rfWeiter" aria-label="Weiter">▶</button></div>';
  document.body.appendChild(r);
  const q = (x) => r.querySelector(x);
  function buehneSetzen(ziel, folie, opt = {}) {
    const box = ziel.parentElement, k = Math.min(box.clientWidth / K.W, (box.clientHeight || 9999) / K.H);
    ziel.style.width = K.W + "px"; ziel.style.height = K.H + "px"; ziel.style.transform = "scale(" + k + ")"; box.style.setProperty("--h", K.H * k + "px");
    ziel.innerHTML = folie ? K.folieHtml(folie, s.design, Object.assign({ katex }, opt)) : '<div class="folie v-ende"><p>Ende der Präsentation</p></div>';
  }
  function senden(typ, extra = {}) { kanal.postMessage(Object.assign({ id: s.id, typ }, extra)); }
  function zeigen(neu) {
    const f = s.folien[st.fi], n = st.schritt < schritte(f) ? f : s.folien[st.fi + 1];
    buehneSetzen(q("#rfJetzt"), f, { schritt: st.schritt, neu });
    buehneSetzen(q("#rfNext"), n, { schritt: n === f ? st.schritt + 1 : 0 });
    q("#rfNr").textContent = st.fi >= s.folien.length ? "Ende" : "Folie " + (st.fi + 1) + " / " + s.folien.length + (schritte(f) ? " · Schritt " + st.schritt + "/" + schritte(f) : "");
    const notiz = f ? f.notiz || "" : "";
    q("#rfNotiz").innerHTML = notiz ? esc(notiz).replace(/\n/g, "<br>") : '<span class="muted">Keine Notizen zu dieser Folie. Du kannst sie im Editor unter der Folie eintragen.</span>';
    q("#rfNotiz").style.fontSize = schrift + "px";
    q("#rfStreifen").querySelectorAll("button").forEach((b, i) => { b.classList.toggle("an", i === st.fi); if (i === st.fi) b.scrollIntoView({ block: "nearest", inline: "center" }); });
    senden("stand", { stand: st });
    fernStand();
  }
  function weiter() { if (st.fi >= s.folien.length) { ende(); return; } const neu = schrittWeiter(s.folien, st); const nurSchritt = neu.fi === st.fi; st = neu; zeigen(nurSchritt); }
  function zurueck() { st = schrittZurueck(s.folien, st); zeigen(false); }
  function springen(i) { st = { fi: i, schritt: 0 }; zeigen(false); }
  function schwarzSetzen(an) { schwarz = an; q("#rfSchwarz").classList.toggle("an", an); r.classList.toggle("ist-schwarz", an); senden("schwarz", { an }); }
  q("#rfStreifen").innerHTML = s.folien.map((f, i) => '<button type="button" title="' + esc(titelVon(f, i)) + '" aria-label="Zu Folie ' + (i + 1) + '"><span>' + (i + 1) + '</span><small>' + esc(titelVon(f, i)).slice(0, 26) + '</small></button>').join("");
  q("#rfStreifen").querySelectorAll("button").forEach((b, i) => b.onclick = () => springen(i));
  q("#rfWeiter").onclick = weiter; q("#rfZurueck").onclick = zurueck;
  q("#rfSchwarz").onclick = () => schwarzSetzen(!schwarz);
  q("#rfLaser").onclick = () => { laserAn = !laserAn; q("#rfLaser").classList.toggle("an", laserAn); r.classList.toggle("laser", laserAn); if (!laserAn) senden("laser", { an: false }); };
  q("#rfNull").onclick = () => { beginn = Date.now(); };
  r.querySelectorAll("[data-sg]").forEach(b => b.onclick = () => { schrift = Math.max(14, Math.min(40, schrift + 3 * Number(b.dataset.sg))); KW.save("kw-referent-schrift", schrift); q("#rfNotiz").style.fontSize = schrift + "px"; });
  // Laser: Maus über der großen Folie → roter Punkt auf dem Beamer
  q("#rfJetzt").parentElement.addEventListener("pointermove", (e) => {
    if (!laserAn) return;
    const b = q("#rfJetzt").getBoundingClientRect();
    senden("laser", { an: true, x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height });
  });
  q("#rfJetzt").parentElement.addEventListener("pointerleave", () => { if (laserAn) senden("laser", { an: false }); });

  /* Beamer-Fenster */
  function fensterOeffnen() {
    beamer = window.open("beamer.html#" + encodeURIComponent(s.id), "fidelia-beamer", "popup,width=1024,height=600");
    if (!beamer) KW.toast("Das Fenster wurde blockiert. Erlaube Pop-ups für diese Seite und tipp nochmal auf 🖥️ Beamer.");
    statusZeigen();
  }
  function statusZeigen() { q("#rfBeamer").textContent = beamerDa ? "🟢 Beamer verbunden" : "⚪ Beamer-Fenster nicht offen"; q("#rfBeamer").classList.toggle("ok", beamerDa); }
  kanal.onmessage = (e) => {
    const m = e.data || {}; if (m.id !== s.id) return;
    if (m.typ === "hallo") { beamerDa = true; statusZeigen(); senden("daten", { daten: { folien: s.folien, design: s.design }, stand: st }); if (schwarz) senden("schwarz", { an: true }); }
    else if (m.typ === "zu") { beamerDa = false; statusZeigen(); }
    else if (m.typ === "taste") { if (["ArrowRight", " ", "PageDown"].includes(m.taste)) weiter(); else zurueck(); }
  };
  q("#rfFenster").onclick = fensterOeffnen;

  /* Handy-Fernbedienung */
  const titel = s.titel || "Präsentation";
  function fernStand() { if (Sync.bereit()) Sync.blitz("fern-stand", { id: s.id, titel, fi: st.fi, schritt: st.schritt, n: s.folien.length, notiz: (s.folien[st.fi] || {}).notiz || "", naechste: st.fi + 1 < s.folien.length ? titelVon(s.folien[st.fi + 1], st.fi + 1) : "", schwarz, beginn }); }
  const ab = Sync.hoeren("fern-befehl", (d) => {
    if (d.id !== s.id) return;
    if (d.befehl === "weiter") weiter(); else if (d.befehl === "zurueck") zurueck(); else if (d.befehl === "schwarz") schwarzSetzen(!schwarz); else if (d.befehl === "hallo") fernStand();
    q("#rfHandy").classList.add("an");
  });
  q("#rfHandy").onclick = () => {
    if (!Sync.gekoppelt()) { KW.toast("Verbinde erst dein Handy: ⚙️ Einstellungen → Geräte verbinden. Dann hier nochmal tippen."); return; }
    if (!Sync.bereit()) { KW.toast("Die Verbindung zu deinem Handy wird gerade aufgebaut … versuch es gleich nochmal."); return; }
    Sync.blitz("fern-start", { id: s.id, titel }); fernStand();
    KW.toast("📱 Auf deinem Handy erscheint jetzt „Fernbedienung“. Tipp darauf.");
  };
  if (Sync.bereit()) Sync.blitz("fern-start", { id: s.id, titel, still: true });

  /* Tasten, Uhr, Ende */
  const taste = (e) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); weiter(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); zurueck(); }
    else if (e.key === "Escape") ende();
    else if (e.key.toLowerCase() === "b" || e.key === ".") schwarzSetzen(!schwarz);
    else if (e.key.toLowerCase() === "l") q("#rfLaser").click();
    else if (e.key === "Home") springen(0);
    else if (e.key === "End") springen(s.folien.length - 1);
  };
  document.addEventListener("keydown", taste);
  const uhr = setInterval(() => { q("#rfZeit").textContent = zeitText(Date.now() - beginn); q("#rfUhr").textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); }, 1000);
  const groesse = () => zeigen(false);
  addEventListener("resize", groesse);
  function ende() {
    clearInterval(uhr); document.removeEventListener("keydown", taste); removeEventListener("resize", groesse); ab();
    senden("ende"); kanal.close(); if (Sync.bereit()) Sync.blitz("fern-ende", { id: s.id });
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    r.remove();
  }
  q("#rfEnde").onclick = ende;
  zeigen(false); r.focus(); fensterOeffnen();
  q("#rfUhr").textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

/* ---------- Handy: Fernbedienung (#fern/<id>) ---------- */
export function fernbedienung(A, el, id) {
  let stand = null;
  el.innerHTML = '<div class="fern"><div class="kopfzeile"><a class="btn small" href="#folien" aria-label="Zurück">←</a><h2 class="titel" id="fTitel">📱 Fernbedienung</h2></div>' +
    '<div class="fern-info card" id="fInfo" aria-live="polite"><p class="muted">Warte auf die Präsentation auf deinem anderen Gerät …</p></div>' +
    '<div class="fern-knoepfe"><button type="button" class="fern-k" id="fZurueck" aria-label="Zurück">◀</button><button type="button" class="fern-k primaer" id="fWeiter" aria-label="Weiter">▶</button></div>' +
    '<button type="button" class="btn" id="fSchwarz">⬛ Bild schwarz / zurück</button>' +
    '<div class="fern-notiz card"><small class="muted">Notizen</small><div id="fNotiz"></div></div></div>';
  const q = (x) => el.querySelector(x);
  const befehl = (b) => { if (!Sync.blitz("fern-befehl", { id, befehl: b })) KW.toast("Keine Verbindung zum anderen Gerät."); else if (navigator.vibrate) navigator.vibrate(15); };
  q("#fWeiter").onclick = () => befehl("weiter"); q("#fZurueck").onclick = () => befehl("zurueck"); q("#fSchwarz").onclick = () => befehl("schwarz");
  function zeichnen() {
    if (!stand) return;
    q("#fTitel").textContent = "📱 " + (stand.titel || "Präsentation");
    q("#fInfo").innerHTML = stand.fi >= stand.n ? '<b>Ende der Präsentation</b>' : '<div class="fern-nr">' + (stand.fi + 1) + ' <small>/ ' + stand.n + '</small></div><div class="muted">' + (stand.naechste ? "Als Nächstes: " + esc(stand.naechste) : "Letzte Folie") + '</div><div class="fern-zeit" id="fZeit">' + zeitText(Date.now() - stand.beginn) + '</div>' + (stand.schwarz ? '<div class="fern-schwarz">⬛ Bild ist schwarz</div>' : "");
    q("#fNotiz").innerHTML = stand.notiz ? esc(stand.notiz).replace(/\n/g, "<br>") : '<span class="muted">Keine Notizen.</span>';
  }
  const ab1 = Sync.hoeren("fern-stand", (d) => { if (d.id !== id) return; stand = d; zeichnen(); });
  const ab2 = Sync.hoeren("fern-ende", (d) => { if (d.id === id) { q("#fInfo").innerHTML = "<b>Präsentation beendet 👏</b>"; } });
  const uhr = setInterval(() => { const z = el.querySelector("#fZeit"); if (z && stand) z.textContent = zeitText(Date.now() - stand.beginn); }, 1000);
  const taste = (e) => { if (e.key === "ArrowRight" || e.key === " ") befehl("weiter"); if (e.key === "ArrowLeft") befehl("zurueck"); };
  document.addEventListener("keydown", taste);
  Sync.blitz("fern-befehl", { id, befehl: "hallo" });
  return () => { ab1(); ab2(); clearInterval(uhr); document.removeEventListener("keydown", taste); };
}
