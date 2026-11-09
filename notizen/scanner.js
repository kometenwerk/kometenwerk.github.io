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
  let ecken = null, kleinW = KLEIN, kleinH = 150, ruhe = null, anzahl = 0, schaerfen = [], spiegel = false, modus = "blatt";
  let ampelStand = null, ampelZaehler = 0, rotSeit = 0, puzzle = null;
  const mess = document.createElement("canvas"), mctx = mess.getContext("2d", { willReadFrequently: true });
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
      '<div class="scan-ampel" id="ampel" hidden aria-live="polite"></div>' +
      '<button type="button" class="btn small scan-puzzle-ab" id="puzzleAb" hidden>✕ Puzzle abbrechen</button>' +
    '</div>' +
    '<div class="scan-knoepfe">' +
      '<button type="button" class="btn primary" id="jetzt" disabled>📸 Jetzt scannen</button>' +
      '<div class="modus scan-modus" role="radiogroup" aria-label="Was scannen?"><button type="button" role="radio" data-sm="blatt" aria-checked="true" class="an">📄 Blatt</button><button type="button" role="radio" data-sm="tafel" aria-checked="false">🧑‍🏫 Tafel</button></div>' +
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
    // Laptop-/Frontkamera: Bild spiegeln, dann kann man das Blatt leichter ausrichten (wie im Spiegel)
    const einst = strom.getVideoTracks()[0].getSettings ? strom.getVideoTracks()[0].getSettings() : {};
    spiegel = einst.facingMode ? einst.facingMode === "user" : !/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    el.querySelector("#buehne").classList.toggle("spiegel", spiegel);
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
  el.querySelectorAll("[data-sm]").forEach(b => b.onclick = () => {
    modus = b.dataset.sm;
    el.querySelectorAll("[data-sm]").forEach(x => { x.classList.toggle("an", x === b); x.setAttribute("aria-checked", x === b); });
    el.querySelector("#buehne").classList.toggle("tafel", modus === "tafel");
    ecken = null; gesperrt = null; if (ruhe) ruhe.zuruecksetzen();
    KW.toast(modus === "tafel" ? "Tafel-Modus: ganze Tafel ins Bild nehmen, dann „Jetzt scannen“." : "Blatt-Modus.");
  });
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
    if (modus === "tafel") { ecken = null; malen(0); ampelZeigen(null); sag("Tafel ganz ins Bild nehmen – dann „📸 Jetzt scannen“"); return; }
    if (puzzle) { puzzleSchritt(); return; }
    kctx.drawImage(video, 0, 0, kleinW, kleinH);
    const roh = kctx.getImageData(0, 0, kleinW, kleinH).data, g = K.grau(roh, kleinW, kleinH);
    const ana = K.analysiereBlatt(roh, kleinW, kleinH);
    ecken = ana.ecken;
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
    // Ampel: kann man die Schrift lesen? (alle 3 Durchläufe, im echten Video-Bild gemessen)
    if (ecken && (++ampelZaehler % 3 === 0 || !ampelStand)) ampelStand = ampelMessen(ecken);
    if (!ecken) { ampelStand = null; rotSeit = 0; }
    ampelZeigen(ampelStand);
    if (ecken && ampelStand && ampelStand.farbe === "rot") {
      if (!rotSeit) rotSeit = zeit;
      // Blatt ist im Ganzen zu klein für die Kamera → selbst auf Puzzle-Scan umschalten
      if (ampelStand.grund === "klein" && F.puzzle !== false) {
        malen(fort);
        if (fort >= 1 && zeit - rotSeit > 800) { puzzleStart(); return; }
        sag("🔴 Die Schrift ist für deine Kamera zu klein – ruhig halten, ich scanne gleich in zwei Teilen", fort); return;
      }
    } else rotSeit = 0;
    malen(ecken ? fort : 0);
    if (ecken && ampelStand && ampelStand.farbe === "rot" && ampelStand.grund !== "klein") { sag(ampelStand.grund === "kontrast" ? "🔴 Zu dunkel – mehr Licht, Blatt auf dunklen Tisch" : "🔴 Zu unscharf – Blatt etwas weiter weg halten oder mehr Licht", fort); if (zeit - rotSeit < 6000) return; }
    if (!ecken) sag(ana.hinweis === "rand" ? "Das Blatt ragt raus – ganzes Blatt mit allen 4 Ecken zeigen" : ana.hinweis === "klein" ? "Näher ran – das Blatt ist zu klein" : spiegel ? "Blatt nicht gefunden – alle 4 Ecken zeigen, Finger weg von den Ecken" : "Blatt vor die Kamera halten (dunkler Untergrund hilft)");
    else if (ana.hinweis === "klein") sag("Etwas näher ran …", fort);
    else if (!F.auto) sag("Blatt erkannt – tipp auf „Jetzt scannen“");
    else if (fort >= 1 && !scharf) sag("Scharf stellen … (etwas weiter weg oder mehr Licht)", 1);
    else sag(fort < 1 ? "Ruhig halten …" : "Scanne …", fort);
    if (ruhig && scharf && F.auto) scannenVonKamera();
  }

  /* --- Schärfe-Ampel --- */
  function ampelMessen(e) {
    const vw = video.videoWidth, vh = video.videoHeight, f = vw / kleinW;
    const xs = e.map(p => p.x * f), ys = e.map(p => p.y * f);
    const x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys)), bw = Math.min(vw, Math.max(...xs)) - x0, bh = Math.min(vh, Math.max(...ys)) - y0;
    if (bw < 20 || bh < 20) return null;
    // Pixel pro mm: lange Blattseite / 297 mm
    const lang = Math.max(Math.hypot(xs[1] - xs[0], ys[1] - ys[0]), Math.hypot(xs[3] - xs[0], ys[3] - ys[0])), dichte = lang / 297;
    // Mitte des Blatts in Originalgröße messen (höchstens 700 px breit, sonst zu langsam)
    const mw = Math.min(700, Math.round(bw * 0.6)), mh = Math.min(500, Math.round(bh * 0.6));
    mess.width = mw; mess.height = mh;
    mctx.drawImage(video, x0 + bw * 0.2, y0 + bh * 0.2, mw, mh, 0, 0, mw, mh);
    const k = K.lesbarkeit(K.grau(mctx.getImageData(0, 0, mw, mh).data, mw, mh), mw, mh);
    return Object.assign(K.ampel(dichte, k), { dichte, kante: k.kante });
  }
  function ampelZeigen(a) {
    const el2 = el.querySelector("#ampel");
    if (!a) { el2.hidden = true; return; }
    el2.hidden = false; el2.className = "scan-ampel " + a.farbe;
    el2.textContent = a.farbe === "gruen" ? "🟢 Scharf" : a.farbe === "gelb" ? "🟡 Geht so" : a.grund === "klein" ? "🔴 Schrift zu klein" : a.grund === "kontrast" ? "🔴 Zu dunkel" : "🔴 Unscharf";
  }

  /* --- Puzzle-Scan: obere und untere Hälfte nah aufnehmen und zusammensetzen --- */
  let vorher = null;
  function puzzleStart() {
    puzzle = { schritt: 1, teile: [], ruhigSeit: 0, start: performance.now(), wegBewegt: false };
    el.querySelector("#puzzleAb").hidden = false; el.querySelector("#buehne").classList.add("puzzle");
    ecken = null; malen(0); vorher = null;
    KW.toast("🧩 Das Blatt ist für deine Kamera zu klein zum Lesen – ich scanne es in zwei Teilen.");
  }
  function puzzleEnde(text) {
    puzzle = null; el.querySelector("#puzzleAb").hidden = true; el.querySelector("#buehne").classList.remove("puzzle");
    if (text) KW.toast(text);
    gesperrt = [{ x: 0, y: 0 }, { x: kleinW, y: 0 }, { x: kleinW, y: kleinH }, { x: 0, y: kleinH }]; wegSeit = 0; rotSeit = 0;
  }
  el.querySelector("#puzzleAb").onclick = () => puzzleEnde("Puzzle-Scan abgebrochen.");
  async function puzzleSchritt() {
    const zeit = performance.now(), p = puzzle;
    kctx.drawImage(video, 0, 0, kleinW, kleinH);
    const g = K.grau(kctx.getImageData(0, 0, kleinW, kleinH).data, kleinW, kleinH);
    // Bewegung zum letzten Bild
    let diff = 99; if (vorher) { let s = 0; for (let i = 0; i < g.length; i += 3) s += Math.abs(g[i] - vorher[i]); diff = s / (g.length / 3); }
    vorher = g;
    // Ist vor allem Papier im Bild?
    const schw = K.otsu(g); let hell = 0; for (let i = 0; i < g.length; i++) if (g[i] > schw) hell++;
    const papier = hell / g.length;
    const vw = video.videoWidth, vh = video.videoHeight, mw = Math.min(700, Math.round(vw * 0.6)), mh = Math.min(500, Math.round(vh * 0.6));
    mess.width = mw; mess.height = mh; mctx.drawImage(video, vw * 0.2, vh * 0.2, mw, mh, 0, 0, mw, mh);
    const k = K.lesbarkeit(K.grau(mctx.getImageData(0, 0, mw, mh).data, mw, mh), mw, mh);
    ampelZeigen(k.kante >= 0.3 ? { farbe: "gruen" } : k.kante >= 0.2 ? { farbe: "gelb" } : { farbe: "rot", grund: "unscharf" });
    if (p.schritt === 2 && !p.wegBewegt) { if (p.ref) { let s2 = 0; for (let i = 0; i < g.length; i += 3) s2 += Math.abs(g[i] - p.ref[i]); if (s2 / (g.length / 3) > 14) p.wegBewegt = true; } sag("🧩 Teil 2 von 2: Jetzt die UNTERE Hälfte nah zeigen (etwas Überlappung mit oben)"); return; }
    const ruhig = diff < 4 && papier > 0.45;
    if (!ruhig) p.ruhigSeit = 0; else if (!p.ruhigSeit) p.ruhigSeit = zeit;
    const fort = p.ruhigSeit ? Math.min(1, (zeit - p.ruhigSeit) / 900) : 0;
    sag((p.schritt === 1 ? "🧩 Teil 1 von 2: Halte die OBERE Hälfte des Blatts nah vor die Kamera" : "🧩 Teil 2 von 2: UNTERE Hälfte") + (k.kante < 0.2 ? " – noch unscharf" : " – ruhig halten …"), fort);
    // Kamera wird nah nicht scharf (fester Fokus)? Ehrlich sagen
    if (zeit - p.start > 12000 && k.kante < 0.2) { puzzleEnde("Deine Kamera wird nah nicht schärfer (fester Fokus). Nimm mehr Licht – oder scanne mit dem Handy."); return; }
    if (fort < 1 || k.kante < 0.2 || beschaeftigt) return;
    beschaeftigt = true; piep();
    const bild = await videoGemittelt(F.mehrbild === false ? 1 : 5);
    p.teile.push(bild); p.schritt++; p.ruhigSeit = 0; p.start = performance.now(); p.ref = g; p.wegBewegt = false;
    beschaeftigt = false;
    if (p.teile.length < 2) return;
    // Zusammensetzen
    beschaeftigt = true; sag("🧩 Setze die Teile zusammen …");
    try {
      const zusammen = await puzzleZusammen(p.teile[0], p.teile[1]);
      if (!zusammen) { beschaeftigt = false; puzzle.teile = []; puzzle.schritt = 1; KW.toast("Die Teile passen nicht zusammen – nochmal: zuerst oben, dann unten, mit etwas Überlappung."); return; }
      puzzleEnde();
      const q = eckenFinden(zusammen);
      await verarbeiten(zusammen, q);
    } catch (e) { puzzleEnde("Das Zusammensetzen hat nicht geklappt."); }
    beschaeftigt = false;
  }
  async function puzzleZusammen(a, b) {
    const w = 640, h = Math.round(w * a.height / a.width), c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(a, 0, 0, w, h); const ga = K.grau(g.getImageData(0, 0, w, h).data, w, h);
    g.drawImage(b, 0, 0, w, h); const gb = K.grau(g.getImageData(0, 0, w, h).data, w, h);
    const r = K.versatzFinden(ga, gb, w, h);
    // Passt nicht – oder zweimal dasselbe Stück fotografiert?
    if (!r || r.guete < 0.35 || r.dy < h * 0.12) return null;
    const f = a.width / w, s = r.s, dx = r.dx * f, dy = r.dy * f;
    const links = Math.min(0, dx), rechts = Math.max(a.width, dx + b.width * s);
    // Mit dunklem Rand drumherum, damit die Blatt-Suche die Ecken findet, auch wenn das Blatt bis an den Bildrand ging
    const rand = Math.round(a.width * 0.05);
    const z = document.createElement("canvas"); z.width = Math.round(rechts - links) + 2 * rand; z.height = Math.round(Math.max(a.height, dy + b.height * s)) + 2 * rand;
    const zg = z.getContext("2d"); zg.fillStyle = "#1a1a1a"; zg.fillRect(0, 0, z.width, z.height);
    zg.drawImage(a, rand - links, rand);
    // Untere Hälfte erst ab der Mitte der Überlappung (dort ist die Naht am wenigsten zu sehen)
    const naht = rand + (dy + a.height) / 2;
    zg.save(); zg.beginPath(); zg.rect(0, naht, z.width, z.height - naht); zg.clip();
    zg.drawImage(b, rand + dx - links, rand + dy, b.width * s, b.height * s); zg.restore();
    return z;
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
      // Wenn möglich ein echtes Foto in voller Kamera-Auflösung (viel schärfer als ein Video-Bild).
      // Laptop-Kameras liefern nur kleine Bilder → dann mehrere Video-Bilder zusammenrechnen (weniger Rauschen).
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
      if (!c || (c.width * c.height <= video.videoWidth * video.videoHeight * 1.2 && F.mehrbild !== false)) {
        if (F.mehrbild !== false) sag("Ruhig halten … ich nehme ein paar Bilder auf");
        c = await videoGemittelt(F.mehrbild === false ? 1 : 7) || c;
      }
      if (modus === "tafel") {
        const w = c.width, h = c.height, r = 0.01;
        await verarbeiten(c, [{ x: w * r, y: h * r }, { x: w * (1 - r), y: h * r }, { x: w * (1 - r), y: h * (1 - r) }, { x: w * r, y: h * (1 - r) }], { tafel: true });
        throw new Error("fertig");
      }
      // Ecken auf dem großen Bild genauer suchen; sonst die aus dem Video übernehmen (wenn das Format passt)
      q = eckenFinden(c);
      if (!q && kleineEcken && Math.abs(c.width / c.height - kleinW / kleinH) < 0.02) { const f = c.width / kleinW; q = K.einruecken(kleineEcken.map(p => ({ x: p.x * f, y: p.y * f })), 0.008); }
      if (!q) {
        // Foto passt nicht? Dann das Video-Bild nehmen
        const vw = video.videoWidth, vh = video.videoHeight, v = document.createElement("canvas"); v.width = vw; v.height = vh; v.getContext("2d").drawImage(video, 0, 0);
        q = eckenFinden(v) || (kleineEcken ? K.einruecken(kleineEcken.map(p => ({ x: p.x * vw / kleinW, y: p.y * vh / kleinH })), 0.008) : null); if (q) c = v;
      }
      if (!q) throw new Error("kein-blatt");
      await warte(40);
      const s = await verarbeiten(c, q);
      if (!s) throw new Error("verworfen");
      if (F.animation) await warte(Math.max(0, 900 - 60));
      strich.hidden = true;
      if (F.animation) { const hk = el.querySelector("#haken"); hk.hidden = false; await warte(1500); hk.hidden = true; }
    } catch (e) {
      strich.hidden = true;
      if (e && (e.message === "fertig" || e.message === "verworfen")) { /* alles gut */ }
      else KW.toast(e && e.message === "kein-blatt" ? "Blatt nicht sicher erkannt – nichts gespeichert. Ganzes Blatt zeigen und ruhig halten." : "Das hat nicht geklappt. Versuch es nochmal.");
    }
    gesperrt = kleineEcken || [{ x: 0, y: 0 }, { x: kleinW, y: 0 }, { x: kleinW, y: kleinH }, { x: 0, y: kleinH }];
    wegSeit = 0;
    beschaeftigt = false;
    if (!F.mehrfach && neue.length) A.gehe("seite/" + neue[neue.length - 1].id);
  }

  // n Video-Bilder hintereinander aufnehmen und mitteln
  async function videoGemittelt(n) {
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return null;
    const c = document.createElement("canvas"); c.width = vw; c.height = vh;
    const g = c.getContext("2d", { willReadFrequently: true }), bilder = [];
    for (let i = 0; i < n; i++) {
      if (i) await new Promise(r => video.requestVideoFrameCallback ? video.requestVideoFrameCallback(() => r()) : setTimeout(r, 70));
      g.drawImage(video, 0, 0); bilder.push(g.getImageData(0, 0, vw, vh).data);
    }
    const m = n > 1 ? K.bilderMitteln(bilder, vw, vh) : { daten: bilder[0], anzahl: 1 };
    g.putImageData(new ImageData(m.daten, vw, vh), 0, 0);
    return c;
  }

  // Ecken auf einem mittelgroßen Bild suchen (genauer als im Mini-Video-Bild)
  function eckenFinden(quelle) {
    const w = quelle.width, h = quelle.height, kw = 480, kh = Math.round(kw * h / w), kc = document.createElement("canvas");
    kc.width = kw; kc.height = kh; kc.getContext("2d").drawImage(quelle, 0, 0, kw, kh);
    const e = K.analysiereBlatt(kc.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh).ecken;
    return e ? K.einruecken(e.map(p => ({ x: p.x * w / kw, y: p.y * h / kh })), 0.006) : null;
  }

  // Zieht das Bild gerade, filtert es, dreht richtig herum, zeigt die Vorschau und legt eine neue Seite an
  async function verarbeiten(quelle, q, { tafel = false, ohneVorschau = false } = {}) {
    const w = quelle.width, h = quelle.height;
    let ohneEcken = false;
    if (!q) q = eckenFinden(quelle);
    if (!q) { ohneEcken = true; q = [{ x: 0, y: 0 }, { x: w - 1, y: 0 }, { x: w - 1, y: h - 1 }, { x: 0, y: h - 1 }]; }
    let ziel = await geradeUndFiltern(quelle, q, tafel ? "tafel" : F.filter, { tafel });
    let drehung = 0;
    if (F.drehen !== false && !tafel) { sag("Richte das Blatt aus …"); drehung = await ausrichtung(A, ziel.canvas); }
    if (F.vorschau !== false && !ohneVorschau) {
      const wahl = await vorschau(ziel.canvas, drehung);
      if (!wahl) { KW.toast("Verworfen – nichts gespeichert."); return null; }
      drehung = wahl.drehung;
    }
    if (drehung) ziel = await gedreht(ziel.canvas, drehung);
    const bildId = await A.bildSpeichern(ziel.blob);
    // Original (verkleinert) aufheben, damit man die Ecken später noch anpassen kann
    const m = Math.min(1, 2400 / Math.max(w, h)), oc = document.createElement("canvas");
    oc.width = Math.round(w * m); oc.height = Math.round(h * m); oc.getContext("2d").drawImage(quelle, 0, 0, oc.width, oc.height);
    const originalId = await A.bildSpeichern(await new Promise(r => oc.toBlob(r, "image/jpeg", 0.85)), { ohneAbgleich: true });
    const jetztD = new Date();
    const seite = await A.seiteNeu({ quelle: "scan", bild: bildId, original: originalId, ecken: q.map(p => [p.x / w, p.y / h]), raster: "leer", drehung, tafel: tafel || undefined,
      fach: el.querySelector("#zielFach").value, quer: ziel.quer, hoehe: ziel.quer ? 210 : 297,
      titel: (tafel ? "Tafelbild " : "Scan ") + jetztD.toLocaleDateString("de-DE") + " " + jetztD.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) });
    anzahl++; neue.push(seite);
    ergebnisse(ziel.blob, seite);
    seite.ohneEcken = ohneEcken;
    if (!ohneEcken) A.verarbeiten(seite); // Text erkennen, Word-Seite nachbauen, sortieren – im Hintergrund
    return seite;
  }

  // Vorschau: Passt / Drehen / Nochmal
  function vorschau(canvas, drehung) {
    return new Promise(fertig => {
      const d = document.createElement("dialog"); d.className = "sheet scan-vorschau";
      d.innerHTML = '<div class="sheet-in"><h2>So sieht dein Scan aus</h2><div class="vs-bild"><canvas id="vsImg" role="img" aria-label="Vorschau des Scans"></canvas></div>' +
        '<p class="muted klein" id="vsInfo">' + (drehung ? "↻ Ich habe das Blatt automatisch gedreht." : "") + '</p>' +
        '<div class="sheet-foot"><button type="button" class="btn" id="vsNoch">🔄 Nochmal</button><button type="button" class="btn" id="vsL" aria-label="Nach links drehen">⟲</button><button type="button" class="btn" id="vsR" aria-label="Nach rechts drehen">⟳</button><span class="sp"></span><button type="button" class="btn primary" id="vsOk">✓ Passt</button></div></div>';
      document.body.appendChild(d);
      const img = d.querySelector("#vsImg"), f = Math.min(1, 1000 / Math.max(canvas.width, canvas.height));
      const klein = document.createElement("canvas"); klein.width = Math.round(canvas.width * f); klein.height = Math.round(canvas.height * f); klein.getContext("2d").drawImage(canvas, 0, 0, klein.width, klein.height);
      const zeigen = () => {
        const seitlich = drehung % 180 !== 0; img.width = seitlich ? klein.height : klein.width; img.height = seitlich ? klein.width : klein.height;
        const g = img.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.translate(img.width / 2, img.height / 2); g.rotate(drehung * Math.PI / 180); g.drawImage(klein, -klein.width / 2, -klein.height / 2);
      };
      zeigen();
      let ergebnis = null;
      d.querySelector("#vsL").onclick = () => { drehung = (drehung + 270) % 360; zeigen(); };
      d.querySelector("#vsR").onclick = () => { drehung = (drehung + 90) % 360; zeigen(); };
      d.querySelector("#vsNoch").onclick = () => d.close();
      d.querySelector("#vsOk").onclick = () => { ergebnis = { drehung }; d.close(); };
      d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
      d.showModal();
      d.querySelector("#vsOk").focus();
    });
  }

  const urls = [];
  function ergebnisse(blob, seite) {
    const box = el.querySelector("#ergebnisse");
    const z = el.querySelector("#zaehler");
    z.hidden = false; z.textContent = anzahl + (anzahl === 1 ? " Blatt" : " Blätter");
    if (!box.firstChild) box.innerHTML = '<div class="kopfzeile"><h3>Gerade gescannt</h3><span class="sp"></span><a class="btn small" href="#heft">Zum Heft →</a></div><div class="scan-reihe" id="reihe"></div>';
    const u = URL.createObjectURL(blob); urls.push(u);
    box.querySelector("#reihe").insertAdjacentHTML("afterbegin", '<span class="scan-mini"><a href="#seite/' + seite.id + '"><img src="' + u + '" alt="' + esc(seite.titel) + '"></a><span class="mini-knoepfe"><button type="button" class="btn small" data-dreh="' + seite.id + '" title="Drehen" aria-label="Drehen">⟳</button><button type="button" class="btn small" data-ecken="' + seite.id + '" title="Ecken anpassen" aria-label="Ecken anpassen">📐</button></span></span>');
    box.querySelector('[data-ecken="' + seite.id + '"]').onclick = () => A.eckenAnpassen(A.seite(seite.id));
    box.querySelector('[data-dreh="' + seite.id + '"]').onclick = async (e) => { const s = A.seite(seite.id); await scanDrehen(A, s, 90); const b = await A.bildHolen(s.bild); if (b) e.target.closest(".scan-mini").querySelector("img").src = URL.createObjectURL(b); };
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
        const s = await verarbeiten(c, null, { ohneVorschau: dateien.length > 1 });
        if (!s) continue;
        if (s.ohneEcken) {
          delete s.ohneEcken;
          // Blatt nicht sicher gefunden: lieber selbst die Ecken setzen lassen statt Salat zu bauen
          if (dateien.length === 1) { KW.toast("Blatt nicht sicher gefunden – zieh die 4 Ecken auf die Blatt-Ecken."); await A.eckenAnpassen(s); A.verarbeiten(s, { ocr: true }); }
          else { s.unsicher = true; await A.seiteSpeichern(s); }
        }
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

export async function geradeUndFiltern(quelle, q, filter, { tafel = false } = {}) {
  const w = quelle.width, h = quelle.height;
  // So scharf wie möglich: so viele Pixel wie das Blatt im Foto hat (max. 300 dpi = 3508 px)
  const seiteLang = Math.max(Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y), Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y));
  let groesse;
  if (tafel) {
    // Tafel: Seitenverhältnis vom Foto behalten (nicht A4)
    const bw = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y), bh = Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y), f = Math.min(2.5, 2800 / Math.max(bw, bh));
    groesse = { w: Math.round(bw * f), h: Math.round(bh * f), quer: bw > bh };
  } else groesse = K.a4Groesse(q, Math.max(1754, Math.min(3508, Math.round(seiteLang * 1.2))));
  const daten = quelle.getContext("2d").getImageData(0, 0, w, h).data;
  let rgba = K.geradeZiehen(daten, w, h, q, groesse.w, groesse.h);
  if (filter === "tafel") rgba = K.schaerfen(K.tafelWeiss(rgba, groesse.w, groesse.h), groesse.w, groesse.h, 4, 0.4);
  else if (filter === "farbe" || filter === undefined) rgba = K.schaerfen(K.farbeWeiss(rgba, groesse.w, groesse.h), groesse.w, groesse.h, 4, 0.5);
  else if (filter === "normal") rgba = K.graustufenZuRgba(K.schaerfen(K.papierweiss(K.grau(rgba, groesse.w, groesse.h), groesse.w, groesse.h, "normal"), groesse.w, groesse.h, 1, 0.5));
  else if (filter === "stark") rgba = K.graustufenZuRgba(K.papierweiss(K.grau(rgba, groesse.w, groesse.h), groesse.w, groesse.h, "stark"));
  let ziel = document.createElement("canvas"); ziel.width = groesse.w; ziel.height = groesse.h;
  ziel.getContext("2d").putImageData(new ImageData(rgba, groesse.w, groesse.h), 0, 0);
  if (tafel) {
    // auf A4-Format (quer oder hoch) mit weißem Rand bringen, damit es als Heftseite passt
    const quer = groesse.w >= groesse.h, A4 = Math.SQRT2, zw = quer ? Math.max(groesse.w, Math.round(groesse.h * A4)) : Math.max(groesse.w, Math.round(groesse.h / A4)), zh = quer ? Math.round(zw / A4) : Math.round(zw * A4);
    const p = document.createElement("canvas"); p.width = zw; p.height = Math.max(zh, groesse.h);
    const g = p.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, p.width, p.height); g.drawImage(ziel, (p.width - groesse.w) / 2, (p.height - groesse.h) / 2);
    ziel = p; groesse.quer = quer;
  }
  const blob = await new Promise(r => ziel.toBlob(r, "image/jpeg", 0.9));
  return { blob, quer: groesse.quer, canvas: ziel };
}

// Canvas drehen (90/180/270 im Uhrzeigersinn) → { blob, quer, canvas }
export async function gedreht(c, grad) {
  grad = ((grad % 360) + 360) % 360;
  const d = document.createElement("canvas"), seitlich = grad % 180 !== 0;
  d.width = seitlich ? c.height : c.width; d.height = seitlich ? c.width : c.height;
  const g = d.getContext("2d"); g.translate(d.width / 2, d.height / 2); g.rotate(grad * Math.PI / 180); g.drawImage(c, -c.width / 2, -c.height / 2);
  const blob = await new Promise(r => d.toBlob(r, "image/jpeg", 0.9));
  return { blob, quer: d.width > d.height, canvas: d };
}

// Wie herum liegt das Blatt? Erst die Zeilenrichtung messen, dann (wenn die Texterkennung da ist) die zwei möglichen Drehungen vergleichen
export async function ausrichtung(A, canvas) {
  try {
    const kw = 700, kh = Math.round(kw * canvas.height / canvas.width), k = document.createElement("canvas"); k.width = kw; k.height = kh;
    k.getContext("2d").drawImage(canvas, 0, 0, kw, kh);
    const richtung = K.textRichtung(K.grau(k.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh), kw, kh);
    if (!richtung) return 0;
    const kandidaten = richtung === "waag" ? [0, 180] : [90, 270];
    if (!(A.einst.f.scanner.ocr !== false)) return kandidaten[0];
    await A.ocrLaden();
    if (!window.KWOCR || !window.KWOCR.vertrauen) return kandidaten[0];
    // Mittleres Stück nehmen (geht schneller als das ganze Blatt)
    const quelle = document.createElement("canvas"), m = 1100, f = Math.min(1, m / Math.max(canvas.width, canvas.height));
    quelle.width = Math.round(canvas.width * f); quelle.height = Math.round(canvas.height * f); quelle.getContext("2d").drawImage(canvas, 0, 0, quelle.width, quelle.height);
    let best = kandidaten[0], bestWert = -1;
    const pruefen = async (liste) => {
      for (const g of liste) {
        const r = (await gedreht(quelle, g)).canvas;
        const wert = await Promise.race([window.KWOCR.vertrauen(r, "deu+eng"), new Promise(ok => setTimeout(() => ok(-1), 12000))]);
        if (wert > bestWert) { bestWert = wert; best = g; }
      }
    };
    await pruefen(kandidaten);
    // Unsicher? Dann auch die anderen beiden Richtungen probieren
    if (bestWert < 35) await pruefen([0, 90, 180, 270].filter(g => !kandidaten.includes(g)));
    return bestWert < 8 ? 0 : best;
  } catch (e) { return 0; }
}

// Fertigen Scan drehen (auch aus dem Heft-Menü)
export async function scanDrehen(A, s, grad) {
  const blob = await A.bildHolen(s.bild); if (!blob) return;
  const bmp = await createImageBitmap(blob), c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0);
  const z = await gedreht(c, grad), alt = s.bild;
  s.bild = await A.bildSpeichern(z.blob); A.bildLoeschen(alt);
  s.drehung = ((s.drehung || 0) + grad) % 360; s.quer = z.quer; s.hoehe = z.quer ? 210 : 297;
  const neuBauen = !!s.html || s.unsicher; if (neuBauen) { s.html = ""; s.ocr = ""; }
  await A.seiteSpeichern(s);
  if (neuBauen) A.verarbeiten(s, { zwingen: true });
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
    const e = K.analysiereBlatt(kc.getContext("2d").getImageData(0, 0, kw, kh).data, kw, kh).ecken;
    if (e) { ecken = e.map(p => [p.x / kw, p.y / kh]); malen(); } else KW.toast("Kein Blatt gefunden – zieh die Punkte selbst.");
  };
  d.querySelector("#eOk").onclick = async () => {
    d.querySelector("#eOk").disabled = true; d.querySelector("#eOk").textContent = "Einen Moment …";
    const q = document.createElement("canvas"); q.width = bmp.width; q.height = bmp.height; q.getContext("2d").drawImage(bmp, 0, 0);
    let ziel = await geradeUndFiltern(q, ecken.map(p => ({ x: p[0] * bmp.width, y: p[1] * bmp.height })), s.tafel ? "tafel" : A.einst.f.scanner.filter, { tafel: !!s.tafel });
    if (s.drehung) ziel = await gedreht(ziel.canvas, s.drehung);
    const alt = s.bild;
    s.bild = await A.bildSpeichern(ziel.blob); s.ecken = ecken; s.quer = ziel.quer; s.hoehe = ziel.quer ? 210 : 297;
    const neuBauen = !!s.html || !!s.unsicher; s.html = neuBauen ? "" : s.html; s.ocr = "";
    await A.seiteSpeichern(s);
    if (alt) A.bildLoeschen(alt);
    d.close();
    KW.toast("✓ Neu zugeschnitten." + (neuBauen ? " Word-Seite wird neu gebaut …" : ""));
    if (neuBauen) await A.nachbauen(s);
    A.zeigen();
  };
  d.addEventListener("close", () => d.remove());
  d.showModal();
  return new Promise(r => d.addEventListener("close", r));
}
