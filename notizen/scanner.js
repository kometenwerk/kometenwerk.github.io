// FIDELIA Notizen · Smart-Scanner
// Kamera an → Blatt wird gesucht → liegt es ca. 1 Sekunde ruhig, löst der Scan von selbst aus.
// Dann: grüner Scan-Strich, Blatt wird gerade gezogen (DIN A4), Schatten weg, großer Haken – und das nächste Blatt.
// Alles passiert auf dem Gerät. Die Rechnungen stehen in scan-kern.js.

import * as K from "./scan-kern.js";

const KW = window.KW, esc = KW.esc;
const KLEIN = 200; // Breite des Mini-Bilds für die Blatt-Suche

export function zeigen(A, el) {
  const F = A.einst.f.scanner;
  let strom = null, timer = null, aktiv = true, beschaeftigt = false, gesperrt = null, wegSeit = 0;
  let ecken = null, kleinW = KLEIN, kleinH = 150, ruhe = null, anzahl = 0;
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
      strom = await navigator.mediaDevices.getUserMedia({ audio: false, video: geraet ? { deviceId: { exact: geraet }, width: { ideal: 1920 }, height: { ideal: 1080 } } :
        { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
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
    const bereit = ruhe.neu(ecken, zeit), fort = ruhe.fortschritt(zeit);
    malen(ecken ? fort : 0);
    if (!ecken) sag("Blatt vor die Kamera halten");
    else if (!F.auto) sag("Blatt erkannt – tipp auf „Jetzt scannen“");
    else sag(fort < 1 ? "Ruhig halten …" : "Scanne …", fort);
    if (bereit && F.auto) scannenVonKamera();
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
    const vw = video.videoWidth, vh = video.videoHeight;
    const c = document.createElement("canvas"); c.width = vw; c.height = vh;
    c.getContext("2d").drawImage(video, 0, 0);
    const kleineEcken = ecken;
    const s = vw / kleinW;
    const q = kleineEcken ? K.einruecken(kleineEcken.map(p => ({ x: p.x * s, y: p.y * s })), 0.01) : null;
    malen(0);
    const strich = el.querySelector("#strich");
    if (F.animation) { strich.hidden = false; strich.classList.remove("los"); void strich.offsetWidth; strich.classList.add("los"); }
    piep();
    hinweis.hidden = true;
    await warte(60);
    try {
      await verarbeiten(c, q);
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

  // Zieht das Bild gerade, filtert es und legt eine neue Seite an
  async function verarbeiten(quelle, q) {
    const w = quelle.width, h = quelle.height;
    if (!q) {
      // Ecken im großen Bild suchen (für gewählte Fotos)
      const kw = KLEIN * 2, kh = Math.round(kw * h / w), kc = document.createElement("canvas");
      kc.width = kw; kc.height = kh; kc.getContext("2d").drawImage(quelle, 0, 0, kw, kh);
      const e = K.findeBlatt(K.grau(kc.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh), kw, kh);
      q = e ? K.einruecken(e.map(p => ({ x: p.x * w / kw, y: p.y * h / kh })), 0.01) : [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }];
    }
    const groesse = K.a4Groesse(q, 1754);
    const daten = quelle.getContext("2d").getImageData(0, 0, w, h).data;
    let rgba = K.geradeZiehen(daten, w, h, q, groesse.w, groesse.h);
    if (F.filter !== "aus") rgba = K.graustufenZuRgba(K.papierweiss(K.grau(rgba, groesse.w, groesse.h), groesse.w, groesse.h, F.filter));
    const ziel = document.createElement("canvas"); ziel.width = groesse.w; ziel.height = groesse.h;
    ziel.getContext("2d").putImageData(new ImageData(rgba, groesse.w, groesse.h), 0, 0);
    const blob = await new Promise(r => ziel.toBlob(r, "image/jpeg", 0.86));
    const bildId = await A.bildSpeichern(blob);
    const jetztD = new Date();
    const seite = await A.seiteNeu({ quelle: "scan", bild: bildId, raster: "leer", fach: el.querySelector("#zielFach").value,
      titel: "Scan " + jetztD.toLocaleDateString("de-DE") + " " + jetztD.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      hoehe: groesse.quer ? Math.round(210 * 210 / 297 * 10) / 10 : 297 });
    anzahl++; neue.push(seite);
    ergebnisse(blob, seite);
    A.verarbeiten(seite); // Texterkennung und Sortieren laufen im Hintergrund weiter
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
