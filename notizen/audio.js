// FIDELIA Notizen · Audio-Scribe
// Nimmt den Unterricht auf (nur mit Erlaubnis der Lehrkraft!) oder dich selbst, macht daraus Text
// (Whisper, läuft im Browser auf deinem Gerät) und lässt die lokale KI eine Heftseite schreiben.
// Die Tonaufnahme wird danach sofort gelöscht – sie wird nie gespeichert und nie verschickt.

import * as KI from "./ki.js";
import * as Planer from "./planer.js";
import * as Sprache from "./sprache.js";

const KW = window.KW, esc = KW.esc;
const MAX_MIN = 60;

// Aufnahme → 16 kHz Mono (das braucht Whisper)
async function zu16k(blob) {
  const roh = await blob.arrayBuffer();
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const buf = await ac.decodeAudioData(roh);
  ac.close();
  const off = new OfflineAudioContext(1, Math.ceil(buf.duration * 16000), 16000);
  const q = off.createBufferSource(); q.buffer = buf; q.connect(off.destination); q.start();
  const r = await off.startRendering();
  return r.getChannelData(0);
}

// „Hausaufgabe: …“ aus der Zusammenfassung holen
export function hausaufgabeFinden(text) {
  const m = String(text || "").match(/Hausaufgabe[n]?\s*:\s*(.+)/i);
  if (!m) return "";
  const h = m[1].trim().replace(/^[-–•]\s*/, "");
  return /^(keine|–|-|nichts)\b/i.test(h) ? "" : h.slice(0, 120);
}

export function zeigen(A, el) {
  const F = A.einst.f.audio;
  let rec = null, strom = null, stuecke = [], start = 0, uhr = null, ac = null, analyser = null, sperre = null, wer = "lehrer", laeuft = true;

  el.innerHTML = '<div class="kopfzeile"><h2 class="titel">🎙️ Audio-Scribe</h2></div>' +
    '<div class="card abschnitt hinweis-box"><b>So funktioniert es</b><p>Aufnehmen → die App macht Text daraus → die KI schreibt eine Heftseite mit den wichtigsten Punkten. ' +
    'Alles passiert auf diesem Laptop. Die Tonaufnahme wird danach sofort gelöscht.</p>' +
    '<p class="warn">⚖️ Andere Menschen darfst du nur aufnehmen, wenn sie <b>vorher Ja gesagt</b> haben. Frag deine Lehrkraft vor der Stunde.</p></div>' +
    '<div class="card abschnitt" id="vorher">' +
      '<div class="field"><span>Wer spricht?</span><div class="tabs" role="radiogroup">' +
        '<button type="button" role="radio" data-wer="lehrer" aria-checked="true" aria-selected="true">👩‍🏫 Lehrkraft (mit Erlaubnis)</button>' +
        '<button type="button" role="radio" data-wer="ich" aria-checked="false" aria-selected="false">🙋 Ich fasse selbst zusammen</button></div></div>' +
      '<div class="row"><label class="field"><span>Fach</span><select class="inp" id="aFach"><option value="">' + (A.einst.an.kisort ? "🤖 Automatisch" : "Unsortiert") + '</option>' +
        A.einst.faecher.map(f => '<option>' + esc(f.name) + '</option>').join("") + '</select></label>' +
      '<label class="field"><span>Thema (freiwillig)</span><input class="inp" id="aThema" maxlength="80" placeholder="z. B. Photosynthese"></label></div>' +
      '<button type="button" class="aufnahme-knopf" id="los" aria-label="Aufnahme starten"><span></span></button><p class="mittig muted">Tippen zum Starten · höchstens ' + MAX_MIN + ' Minuten</p>' +
    '</div>' +
    '<div class="card abschnitt" id="waehrend" hidden><div class="aufnahme-an"><span class="roter-punkt" aria-hidden="true"></span><b id="zeit">0:00</b><canvas id="pegel" width="240" height="40" aria-hidden="true"></canvas></div>' +
      '<div class="row mittig"><button type="button" class="btn" id="pause">⏸ Pause</button><button type="button" class="btn primary" id="stopp">⏹ Fertig – Heftseite machen</button><button type="button" class="btn danger" id="verwerfen">Verwerfen</button></div>' +
      '<p class="muted klein mittig">Lass den Bildschirm an. Die Aufnahme bleibt nur im Arbeitsspeicher.</p></div>' +
    '<div class="card abschnitt" id="danach" hidden><h3 id="dTitel">Wird verarbeitet …</h3><div class="balken"><i id="bal"></i></div><p class="muted" id="dText"></p></div>';

  el.querySelectorAll("[data-wer]").forEach(b => b.onclick = () => {
    wer = b.dataset.wer;
    el.querySelectorAll("[data-wer]").forEach(x => { x.setAttribute("aria-checked", x === b); x.setAttribute("aria-selected", x === b); });
  });

  function erlaubnis() {
    if (wer === "ich") return Promise.resolve(true);
    return new Promise(ok => {
      const d = document.createElement("dialog");
      d.className = "sheet";
      d.innerHTML = '<form class="sheet-in" method="dialog"><h2>Erst fragen ✋</h2><p>Die Stimme der Lehrkraft gehört ihr. Ohne ihr Ja ist Aufnehmen in Deutschland <b>verboten</b> – auch nur für dich.</p>' +
        '<label class="pruef-zeile"><input type="checkbox" id="ja1"> Meine Lehrkraft hat mir erlaubt, diese Stunde aufzunehmen.</label>' +
        '<label class="pruef-zeile"><input type="checkbox" id="ja2"> Ich nehme nur für mich auf und gebe nichts weiter.</label>' +
        '<p class="muted klein">Tipp: Sag der Lehrkraft, dass alles auf deinem Laptop bleibt und die Aufnahme danach gelöscht wird.</p>' +
        '<div class="sheet-foot"><button type="button" class="btn" id="nein">Abbrechen</button><span class="sp"></span><button class="btn primary" id="okBtn" disabled>Aufnahme starten</button></div></form>';
      document.body.appendChild(d);
      const pruefen = () => { d.querySelector("#okBtn").disabled = !(d.querySelector("#ja1").checked && d.querySelector("#ja2").checked); };
      d.querySelector("#ja1").onchange = pruefen; d.querySelector("#ja2").onchange = pruefen;
      let antwort = false;
      d.querySelector("#nein").onclick = () => d.close();
      d.querySelector("form").onsubmit = () => { antwort = true; };
      d.addEventListener("close", () => { d.remove(); ok(antwort); });
      d.showModal();
    });
  }

  function pegelMalen() {
    if (!analyser || !laeuft) return;
    const c = el.querySelector("#pegel"); if (!c) return;
    const x = c.getContext("2d"), d = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(d);
    x.clearRect(0, 0, c.width, c.height);
    const n = 24, bw = c.width / n;
    for (let i = 0; i < n; i++) {
      const v = d[Math.floor(i * d.length / n / 2)] / 255, h = Math.max(2, v * c.height);
      x.fillStyle = "#ff8a3c"; x.fillRect(i * bw + 2, (c.height - h) / 2, bw - 4, h);
    }
    requestAnimationFrame(pegelMalen);
  }

  function aufraeumen() {
    clearInterval(uhr);
    if (strom) strom.getTracks().forEach(t => t.stop());
    if (ac) ac.close().catch(() => {});
    if (sperre) sperre.release().catch(() => {});
    strom = null; ac = null; analyser = null; sperre = null;
  }

  el.querySelector("#los").onclick = async () => {
    if (!(await erlaubnis())) return;
    try { strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { KW.toast("Das Mikrofon ist nicht erlaubt. Erlaube es oben in der Adresszeile."); return; }
    stuecke = [];
    rec = new MediaRecorder(strom);
    rec.ondataavailable = (e) => { if (e.data && e.data.size) stuecke.push(e.data); };
    rec.start(1000);
    start = Date.now();
    ac = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ac.createAnalyser(); analyser.fftSize = 256;
    ac.createMediaStreamSource(strom).connect(analyser);
    try { sperre = await navigator.wakeLock.request("screen"); } catch (e) {}
    el.querySelector("#vorher").hidden = true; el.querySelector("#waehrend").hidden = false;
    let pausiert = 0, pauseStart = 0;
    uhr = setInterval(() => {
      if (rec.state !== "recording") return;
      const s = Math.floor((Date.now() - start - pausiert) / 1000);
      el.querySelector("#zeit").textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
      if (s >= MAX_MIN * 60) { KW.toast("60 Minuten erreicht – ich höre auf."); el.querySelector("#stopp").click(); }
    }, 500);
    el.querySelector("#pause").onclick = () => {
      if (rec.state === "recording") { rec.pause(); pauseStart = Date.now(); el.querySelector("#pause").textContent = "▶ Weiter"; }
      else { rec.resume(); pausiert += Date.now() - pauseStart; el.querySelector("#pause").textContent = "⏸ Pause"; }
    };
    pegelMalen();
  };

  el.querySelector("#verwerfen").onclick = () => {
    if (!confirm("Aufnahme wirklich wegwerfen?")) return;
    if (rec && rec.state !== "inactive") rec.stop();
    stuecke = []; aufraeumen();
    el.querySelector("#waehrend").hidden = true; el.querySelector("#vorher").hidden = false;
    KW.toast("Aufnahme gelöscht.");
  };

  el.querySelector("#stopp").onclick = async () => {
    await new Promise(r => { rec.onstop = r; rec.stop(); });
    aufraeumen();
    let blob = new Blob(stuecke, { type: rec.mimeType || "audio/webm" });
    stuecke = [];
    el.querySelector("#waehrend").hidden = true; el.querySelector("#danach").hidden = false;
    const titelEl = el.querySelector("#dTitel"), textEl = el.querySelector("#dText"), bal = el.querySelector("#bal");
    const zeig = (p, t) => { bal.style.width = Math.round(p * 100) + "%"; if (t) textEl.textContent = t; };
    try {
      titelEl.textContent = "1/3 · Ton vorbereiten …";
      let ton = await zu16k(blob);
      blob = null; // Aufnahme weg
      titelEl.textContent = "2/3 · Sprache wird zu Text …";
      const w = await Sprache.laden(F.modell, zeig);
      zeig(0.05, "Ich höre zu … (bei einer langen Stunde ein paar Minuten)");
      let tick = 0.05; const t = setInterval(() => { tick = Math.min(0.95, tick + 0.01); bal.style.width = Math.round(tick * 100) + "%"; }, 1500);
      const erg = await w(ton, { language: "german", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
      clearInterval(t);
      ton = null; // auch die umgewandelte Aufnahme weg
      const roh = String((erg && erg.text) || "").trim();
      if (!laeuft) return;
      if (roh.length < 10) { titelEl.textContent = "Ich habe nichts verstanden 🙉"; textEl.textContent = "Die Aufnahme war zu leise oder zu kurz. Die Aufnahme ist gelöscht."; return; }
      titelEl.textContent = "3/3 · Die KI schreibt deine Heftseite …";
      zeig(0, "Die Aufnahme ist schon gelöscht ✓");
      let zusammen = "", ki = true;
      try { zusammen = await KI.zusammenfassen(A.einst.ki, roh, F.laenge, zeig); } catch (e) { ki = false; }
      const fach = el.querySelector("#aFach").value, thema = el.querySelector("#aThema").value.trim();
      const text = (ki ? zusammen : roh) + (ki && F.volltext ? "\n\n— Ganzer Text —\n" + roh : "") + (ki ? "" : "\n\n(Keine KI erreichbar – hier steht der ganze Text. Unter ⚙️ Einstellungen → KI kannst du Ollama einrichten.)");
      const s = await A.seiteNeu({ quelle: "audio", fach, raster: "linien", text,
        titel: thema || "Mitschrift " + (fach ? fach + " " : "") + new Date().toLocaleDateString("de-DE") });
      if (!fach) A.verarbeiten(s, { ocr: false });
      const ha = hausaufgabeFinden(zusammen);
      if (ha && A.einst.an.planer && A.einst.f.planer.hausaufgaben) {
        KW.toast("Hausaufgabe gefunden: „" + ha.slice(0, 40) + "“", "Eintragen", () => Planer.eintragen(A, { fach, titel: ha }));
      } else KW.toast("✓ Heftseite fertig. Die Aufnahme ist gelöscht.");
      A.gehe("seite/" + s.id);
    } catch (e) {
      titelEl.textContent = "Das hat nicht geklappt";
      textEl.textContent = "Die Spracherkennung konnte nicht starten (zu wenig Speicher oder keine Verbindung beim ersten Laden). Die Aufnahme ist gelöscht.";
      bal.style.width = "0";
    }
  };

  return () => {
    laeuft = false;
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch (e) {} }
    stuecke = []; aufraeumen();
  };
}
