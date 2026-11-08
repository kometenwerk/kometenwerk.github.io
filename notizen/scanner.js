// FIDELIA Notizen · Smart-Scanner
// Kamera an → Blatt wird gesucht → liegt es ca. 1 Sekunde ruhig, löst der Scan von selbst aus.
// Dann: grüner Scan-Strich, Blatt wird gerade gezogen (DIN A4), Schatten weg, großer Haken – und das nächste Blatt.
// Alles passiert auf dem Gerät. Die Rechnungen stehen in scan-kern.js.

import * as K from "./scan-kern.js";

const KW = window.KW, esc = KW.esc;
const KLEIN = 240; // Breite des Mini-Bilds für die Blatt-Suche

export function zeigen(A, el) {
  const F = A.einst.f.scanner;
  let strom = null, timer = null, aktiv = true, beschaeftigt = false, gesperrt = null, wegSeit = 0;
  let ecken = null, kleinW = KLEIN, kleinH = 150, ruhe = null, anzahl = 0, schaerfen = [];
  const neue = [];

  el.innerHTML =
    '<div class="kopfzeile"><h2 class="titel">📷 Scanner</h2><span class="sp"></span>' +
      '<label class="ziel-fach"><span class="muted klein">Ablegen in</span><select class="inp" id="zielFach">' +
      '<option value="">' + (A.einst.an.kisort ? "🤖 Automatisch sortieren" : "📥 Unsortiert") + '</option>' +
      A.einst.faecher.map(f => '<option>' + esc(f.name) + '</option>').join("") + '</select></label></div>' +
    '<div class="scan-buehne" id="buehne">' +
      '<video id="video" playsinline muted autoplay aria-label="Kamerabild"></video>' +
      '<canvas id="overlay" aria-hidden="true"></canvas>' +
      '<div class="scan-strich" id="strich" hidden aria-hidden="true"></div>' +
      '<div class="scan-haken" id="haken" hidden role="status"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54"/><path d="M34 62 L52 80 L88 42"/></svg><b>Gescannt!</b></div>' +
      '<div class="scan-start" id="startBox"><p>📷</p><p>Halte ein Blatt vor die Kamera – am besten auf einem dunklen Tisch.</p><button type="button" class="btn primary" id="start">Kamera starten</button></div>' +
      '<div class="scan-hinweis" id="hinweis" hidden><span class="ring" id="ring"></span><span id="hinweisText"></span></div>' +
      '<div class="scan-zaehler" id="zaehler" hidden></div>' +
    '</div>' +
    '<div class="scan-knoepfe">' +
      '<button type="button" class="btn primary" id="jetzt" disabled>📸 Jetzt scannen</button>' +
      '<select class="inp" id="kamera" aria-label="Kamera wählen" hidden></select>' +
      '<label class="btn"><input type="file" accept="image/*" id="datei" multiple hidden>🖼️ Foto wählen</label>' +
      '<span class="sp"></span><span class="muted klein">' + (F.auto ? "Löst automatisch aus, wenn das Blatt 1 Sekunde ruhig liegt." : "Automatisch auslösen ist aus (⚙️ Einstellungen).") + '</span>' +
    '</div>' +
    '<div id="ergebnisse"></div>';

  const video = el.querySelector("#video"), overlay = el.querySelector("#overlay"), octx = overlay.getContext("2d");
  const klein = document.createElement("canvas"), kctx = klein.getContext("2d", { willReadFrequently: true });
  const hinweis = el.querySelector("#hinweis"), hinweisText = el.querySelector("#hinweisText"), ring = el.querySelector("#ring");
  const jetzt = el.querySelector("#jetzt"), kameraSel = el.querySelector("#kamera");

  function sag(text, fortschritt) {
    hinweis.hidden = false; hinweisText.textContent = text;
    ring.style.setProperty("--p", Math.round((fortschritt || 0) * 100));
    ring.hidden = !fortschritt;
  }

  /* --- Kamera --- */
  async function kameraAn(geraet) {
    stopp();
    try {
      strom = await navigator.mediaDevices.getUserMedia({ audio: false, video: geraet ? { deviceId: { exact: geraet }, width: { ideal: 3840 }, height: { ideal: 2160 } } :
        { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } } });
    } catch (e) {
      el.querySelector("#startBox").hidden = false;
      el.querySelector("#startBox p:nth-child(2)").textContent = e && e.name === "NotAllowedError" ? "Die Kamera ist nicht erlaubt. Erlaube sie oben in der Adresszeile – oder nimm „Foto wählen“." : "Keine Kamera gefunden. Du kannst stattdessen ein Foto wählen.";
      return;
    }
    if (!aktiv) { stopp(); return; }
    video.srcObject = strom;
    await video.play().catch(() => {});
    el.querySelector("#startBox").hidden = true;
    jetzt.disabled = false;
    kleinW = KLEIN; kleinH = Math.round(KLEIN * video.videoHeight / Math.max(1, video.videoWidth)) || 150;
    klein.width = kleinW; klein.height = kleinH;
    ruhe = K.ruheMesser(kleinW, kleinH, { dauer: 1000, toleranz: 0.02 });
    try {
      const liste = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
      if (liste.length > 1) {
        const akt = strom.getVideoTracks()[0].getSettings().deviceId;
        kameraSel.innerHTML = liste.map((d, i) => '<option value="' + esc(d.deviceId) + '"' + (d.deviceId === akt ? " selected" : "") + '>' + esc(d.label || "Kamera " + (i + 1)) + '</option>').join("");
        kameraSel.hidden = false;
      }
    } catch (e) {}
    schleife();
  }
  function stopp() {
    clearTimeout(timer);
    if (strom) strom.getTracks().forEach(t => t.stop());
    strom = null;
  }
  kameraSel.onchange = () => kameraAn(kameraSel.value);
  el.querySelector("#start").onclick = () => kameraAn();

  /* --- Blatt suchen, Ruhe messen --- */
  function bildRechteck() {
    const cw = overlay.clientWidth, ch = overlay.clientHeight, vw = video.videoWidth, vh = video.videoHeight;
    const f = Math.min(cw / vw, ch / vh);
    return { f, x: (cw - vw * f) / 2, y: (ch - vh * f) / 2 };
  }
  function malen(fortschritt) {
    const dpr = window.devicePixelRatio || 1;
    if (overlay.width !== overlay.clientWidth * dpr) { overlay.width = overlay.clientWidth * dpr; overlay.height = overlay.clientHeight * dpr; }
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.clearRect(0, 0, overlay.clientWidth, overlay.clientHeight);
    if (!ecken || beschaeftigt) return;
    const r = bildRechteck(), s = video.videoWidth / kleinW;
    octx.beginPath();
    ecken.forEach((p, i) => { const x = r.x + p.x * s * r.f, y = r.y + p.y * s * r.f; i ? octx.lineTo(x, y) : octx.moveTo(x, y); });
    octx.closePath();
    const gruen = gesperrt ? "rgba(255,255,255,.5)" : `rgba(${Math.round(255 - 220 * fortschritt)},${Math.round(200 + 20 * fortschritt)},${Math.round(80 - 20 * fortschritt)},.95)`;
    octx.fillStyle = gesperrt ? "rgba(255,255,255,.08)" : "rgba(34,197,94," + (0.08 + 0.18 * fortschritt) + ")";
    octx.fill();
    octx.lineWidth = 3; octx.strokeStyle = gruen; octx.stroke();
  }
  function schleife() {
    if (!aktiv || !strom) return;
    timer = setTimeout(schleife, 110);
    if (beschaeftigt || video.readyState < 2) return;
    kctx.drawImage(video, 0, 0, kleinW, kleinH);
    const g = K.grau(kctx.getImageData(0, 0, kleinW, kleinH).data, kleinW, kleinH);
    ecken = K.findeBlatt(g, kleinW, kleinH);
    const zeit = performance.now();
    if (gesperrt) {
      // Erst wenn das alte Blatt weg ist oder ein neues daliegt, wird wieder gescannt
      if (!ecken) { if (!wegSeit) wegSeit = zeit; } else wegSeit = 0;
      if ((wegSeit && zeit - wegSeit > 350) || (ecken && K.bewegung(ecken, gesperrt, kleinW, kleinH) > 0.12)) { gesperrt = null; ruhe.zuruecksetzen(); }
      sag(anzahl ? "✓ " + anzahl + " gescannt – nächstes Blatt hinlegen" : "Nächstes Blatt hinlegen");
      malen(0);
      return;
    }
    const ruhig = ruhe.neu(ecken, zeit), fort = ruhe.fortschritt(zeit);
    // Schärfe messen: erst auslösen, wenn das Bild so scharf ist wie zuletzt am schärfsten
    let scharf = true;
    if (ecken) {
      const xs = ecken.map(p => p.x), ys = ecken.map(p => p.y);
      const wert = K.schaerfe(g, kleinW, kleinH, { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
      schaerfen.push({ zeit, wert }); schaerfen = schaerfen.filter(x => zeit - x.zeit < 2500);
      const max = Math.max(...schaerfen.map(x => x.wert));
      scharf = wert >= max * 0.8 && wert > 25;
    } else schaerfen = [];
    malen(ecken ? fort : 0);
    if (!ecken) sag("Blatt vor die Kamera halten");
    else if (!F.auto) sag("Blatt erkannt – tipp auf „Jetzt scannen“");
    else if (fort >= 1 && !scharf) sag("Scharf stellen … (etwas weiter weg oder mehr Licht)", 1);
    else sag(fort < 1 ? "Ruhig halten …" : "Scanne …", fort);
    if (ruhig && scharf && F.auto) scannenVonKamera();
  }

  /* --- Scannen --- */
  function piep() {
    if (!F.ton) return;
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), v = ac.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(880, ac.currentTime); o.frequency.exponentialRampToValueAtTime(1320, ac.currentTime + 0.12);
      v.gain.setValueAtTime(0.18, ac.currentTime); v.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
      o.connect(v).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.22);
      setTimeout(() => ac.close(), 400);
    } catch (e) {}
  }
  const warte = (ms) => new Promise(r => setTimeout(r, ms));

  async function scannenVonKamera() {
    if (beschaeftigt || !strom) return;
    beschaeftigt = true;
    const kleineEcken = ecken;
    malen(0);
    const strich = el.querySelector("#strich");
    if (F.animation) { strich.hidden = false; strich.classList.remove("los"); void strich.offsetWidth; strich.classList.add("los"); }
    piep();
    hinweis.hidden = true;
    try {
      // Wenn möglich ein echtes Foto in voller Kamera-Auflösung (viel schärfer als ein Video-Bild)
      let c = null;
      try {
        const spur = strom.getVideoTracks()[0];
        if ("ImageCapture" in window && spur) {
          const ic = new ImageCapture(spur);
          const foto = await Promise.race([ic.takePhoto(), warte(2500).then(() => null)]);
          if (foto) { const bmp = await createImageBitmap(foto); c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0); }
        }
      } catch (e) { c = null; }
      let q = null;
      if (!c) {
        const vw = video.videoWidth, vh = video.videoHeight;
        c = document.createElement("canvas"); c.width = vw; c.height = vh;
        c.getContext("2d").drawImage(video, 0, 0);
      }
      // Ecken auf dem großen Bild genauer suchen; sonst die aus dem Video übernehmen (wenn das Format passt)
      q = eckenFinden(c);
      if (!q && kleineEcken && Math.abs(c.width / c.height - kleinW / kleinH) < 0.02) { const f = c.width / kleinW; q = K.einruecken(kleineEcken.map(p => ({ x: p.x * f, y: p.y * f })), 0.008); }
      await warte(40);
      await verarbeiten(c, q || null);
      if (F.animation) await warte(Math.max(0, 900 - 60));
      strich.hidden = true;
      if (F.animation) { const hk = el.querySelector("#haken"); hk.hidden = false; await warte(1500); hk.hidden = true; }
    } catch (e) {
      strich.hidden = true;
      KW.toast("Das hat nicht geklappt. Versuch es nochmal.");
    }
    gesperrt = kleineEcken || [{ x: 0, y: 0 }, { x: kleinW, y: 0 }, { x: kleinW, y: kleinH }, { x: 0, y: kleinH }];
    wegSeit = 0;
    beschaeftigt = false;
    if (!F.mehrfach && neue.length) A.gehe("seite/" + neue[neue.length - 1].id);
  }

  // Ecken auf einem mittelgroßen Bild suchen (genauer als im Mini-Video-Bild)
  function eckenFinden(quelle) {
    const w = quelle.width, h = quelle.height, kw = 640, kh = Math.round(kw * h / w), kc = document.createElement("canvas");
    kc.width = kw; kc.height = kh; kc.getContext("2d").drawImage(quelle, 0, 0, kw, kh);
    const e = K.findeBlatt(K.grau(kc.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh), kw, kh);
    return e ? K.einruecken(e.map(p => ({ x: p.x * w / kw, y: p.y * h / kh })), 0.006) : null;
  }

  // Zieht das Bild gerade, filtert es und legt eine neue Seite an
  async function verarbeiten(quelle, q) {
    const w = quelle.width, h = quelle.height;
    if (!q) q = eckenFinden(quelle) || [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
    const ziel = await geradeUndFiltern(quelle, q, F.filter);
    const bildId = await A.bildSpeichern(ziel.blob);
    // Original (verkleinert) aufheben, damit man die Ecken später noch anpassen kann
    const m = Math.min(1, 2400 / Math.max(w, h)), oc = document.createElement("canvas");
    oc.width = Math.round(w * m); oc.height = Math.round(h * m); oc.getContext("2d").drawImage(quelle, 0, 0, oc.width, oc.height);
    const originalId = await A.bildSpeichern(await new Promise(r => oc.toBlob(r, "image/jpeg", 0.85)), { ohneAbgleich: true });
    const jetztD = new Date();
    const seite = await A.seiteNeu({ quelle: "scan", bild: bildId, original: originalId, ecken: q.map(p => [p.x / w, p.y / h]), raster: "leer",
      fach: el.querySelector("#zielFach").value, quer: ziel.quer, hoehe: ziel.quer ? 210 : 297,
      titel: "Scan " + jetztD.toLocaleDateString("de-DE") + " " + jetztD.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) });
    anzahl++; neue.push(seite);
    ergebnisse(ziel.blob, seite);
    A.verarbeiten(seite); // Text erkennen, Word-Seite nachbauen, sortieren – im Hintergrund
    return seite;
  }

  const urls = [];
  function ergebnisse(blob, seite) {
    const box = el.querySelector("#ergebnisse");
    const z = el.querySelector("#zaehler");
    z.hidden = false; z.textContent = anzahl + (anzahl === 1 ? " Blatt" : " Blätter");
    if (!box.firstChild) box.innerHTML = '<div class="kopfzeile"><h3>Gerade gescannt</h3><span class="sp"></span><a class="btn small" href="#heft">Zum Heft →</a></div><div class="scan-reihe" id="reihe"></div>';
    const u = URL.createObjectURL(blob); urls.push(u);
    box.querySelector("#reihe").insertAdjacentHTML("afterbegin", '<a href="#seite/' + seite.id + '" class="scan-mini"><img src="' + u + '" alt="' + esc(seite.titel) + '"></a>');
  }

  jetzt.onclick = () => scannenVonKamera();
  el.querySelector("#datei").onchange = async (e) => {
    const dateien = Array.from(e.target.files || []);
    for (const d of dateien) {
      try {
        const bmp = await createImageBitmap(d);
        const f = Math.min(1, 3000 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
        c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        await verarbeiten(c, null);
      } catch (err) { KW.toast("Dieses Bild konnte ich nicht öffnen."); }
    }
    if (dateien.length) KW.toast("✓ " + dateien.length + (dateien.length === 1 ? " Blatt" : " Blätter") + " eingescannt.");
    e.target.value = "";
  };

  // Kamera direkt starten, wenn sie schon erlaubt ist
  (async () => {
    try {
      const p = navigator.permissions && await navigator.permissions.query({ name: "camera" });
      if (p && p.state === "granted") kameraAn();
    } catch (e) {}
  })();

  return () => { aktiv = false; stopp(); urls.forEach(u => URL.revokeObjectURL(u)); };
}

/* ---------- Gerade ziehen und filtern (auch für „Ecken anpassen“) ---------- */

export async function geradeUndFiltern(quelle, q, filter) {
  const w = quelle.width, h = quelle.height;
  // So scharf wie möglich: so viele Pixel wie das Blatt im Foto hat (max. 300 dpi = 3508 px)
  const seiteLang = Math.max(Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y), Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y));
  const lang = Math.max(1754, Math.min(3508, Math.round(seiteLang * 1.2)));
  const groesse = K.a4Groesse(q, lang);
  const daten = quelle.getContext("2d").getImageData(0, 0, w, h).data;
  let rgba = K.geradeZiehen(daten, w, h, q, groesse.w, groesse.h);
  if (filter === "farbe" || filter === undefined) rgba = K.schaerfen(K.farbeWeiss(rgba, groesse.w, groesse.h), groesse.w, groesse.h, 4, 0.5);
  else if (filter === "normal") rgba = K.graustufenZuRgba(K.schaerfen(K.papierweiss(K.grau(rgba, groesse.w, groesse.h), groesse.w, groesse.h, "normal"), groesse.w, groesse.h, 1, 0.5));
  else if (filter === "stark") rgba = K.graustufenZuRgba(K.papierweiss(K.grau(rgba, groesse.w, groesse.h), groesse.w, groesse.h, "stark"));
  const ziel = document.createElement("canvas"); ziel.width = groesse.w; ziel.height = groesse.h;
  ziel.getContext("2d").putImageData(new ImageData(rgba, groesse.w, groesse.h), 0, 0);
  const blob = await new Promise(r => ziel.toBlob(r, "image/jpeg", 0.9));
  return { blob, quer: groesse.quer };
}

// Ecken nachträglich mit dem Finger/der Maus verschieben und neu gerade ziehen
export async function eckenAnpassen(A, s) {
  const blob = await A.bildHolen(s.original);
  if (!blob) { KW.toast("Das Original-Foto ist nicht mehr da."); return; }
  const bmp = await createImageBitmap(blob);
  let ecken = (s.ecken || [[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]]).map(p => p.slice());
  const d = document.createElement("dialog");
  d.className = "sheet breit";
  d.innerHTML = '<div class="sheet-in"><h2>📐 Ecken anpassen</h2><p class="muted">Zieh die vier Punkte auf die Ecken des Blatts.</p>' +
    '<div class="ecken-buehne" id="eb"><canvas id="ec"></canvas></div>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="eAb">Abbrechen</button><button type="button" class="btn" id="eAuto">Automatisch</button><span class="sp"></span><button type="button" class="btn primary" id="eOk">Übernehmen</button></div></div>';
  document.body.appendChild(d);
  const c = d.querySelector("#ec"), g = c.getContext("2d");
  const maxB = Math.min(860, window.innerWidth - 60), f = Math.min(maxB / bmp.width, (window.innerHeight * 0.6) / bmp.height);
  c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
  function malen() {
    g.drawImage(bmp, 0, 0, c.width, c.height);
    g.fillStyle = "rgba(34,197,94,.18)"; g.strokeStyle = "#22c55e"; g.lineWidth = 2;
    g.beginPath(); ecken.forEach((p, i) => i ? g.lineTo(p[0] * c.width, p[1] * c.height) : g.moveTo(p[0] * c.width, p[1] * c.height)); g.closePath(); g.fill(); g.stroke();
    ecken.forEach(p => { g.beginPath(); g.arc(p[0] * c.width, p[1] * c.height, 11, 0, 7); g.fillStyle = "#fff"; g.fill(); g.stroke(); });
  }
  let zieh = -1;
  const pos = (e) => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  c.addEventListener("pointerdown", (e) => { const p = pos(e); let best = 0.08; ecken.forEach((q, i) => { const dd = Math.hypot((q[0] - p[0]) * c.width, (q[1] - p[1]) * c.height) / c.width; if (dd < best) { best = dd; zieh = i; } }); if (zieh >= 0) { c.setPointerCapture(e.pointerId); e.preventDefault(); } });
  c.addEventListener("pointermove", (e) => { if (zieh < 0) return; const p = pos(e); ecken[zieh] = [Math.max(0, Math.min(1, p[0])), Math.max(0, Math.min(1, p[1]))]; malen(); });
  c.addEventListener("pointerup", () => { zieh = -1; });
  c.style.touchAction = "none";
  malen();
  d.querySelector("#eAb").onclick = () => d.close();
  d.querySelector("#eAuto").onclick = () => {
    const kc = document.createElement("canvas"), kw = 640, kh = Math.round(kw * bmp.height / bmp.width); kc.width = kw; kc.height = kh;
    kc.getContext("2d").drawImage(bmp, 0, 0, kw, kh);
    const e = K.findeBlatt(K.grau(kc.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh), kw, kh);
    if (e) { ecken = e.map(p => [p.x / kw, p.y / kh]); malen(); } else KW.toast("Kein Blatt gefunden – zieh die Punkte selbst.");
  };
  d.querySelector("#eOk").onclick = async () => {
    d.querySelector("#eOk").disabled = true; d.querySelector("#eOk").textContent = "Einen Moment …";
    const q = document.createElement("canvas"); q.width = bmp.width; q.height = bmp.height; q.getContext("2d").drawImage(bmp, 0, 0);
    const ziel = await geradeUndFiltern(q, ecken.map(p => ({ x: p[0] * bmp.width, y: p[1] * bmp.height })), A.einst.f.scanner.filter);
    const alt = s.bild;
    s.bild = await A.bildSpeichern(ziel.blob); s.ecken = ecken; s.quer = ziel.quer; s.hoehe = ziel.quer ? 210 : 297;
    const neuBauen = !!s.html; s.html = neuBauen ? "" : s.html; s.ocr = "";
    await A.seiteSpeichern(s);
    if (alt) A.bildLoeschen(alt);
    d.close();
    KW.toast("✓ Neu zugeschnitten." + (neuBauen ? " Word-Seite wird neu gebaut …" : ""));
    if (neuBauen) await A.nachbauen(s);
    A.zeigen();
  };
  d.addEventListener("close", () => d.remove());
  d.showModal();
}
