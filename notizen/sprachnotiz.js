// FIDELIA Notizen · Sprachnotiz an einer Stelle im Text
// Aufnehmen → als kleiner 🎙️-Knopf im Text. Antippen spielt ab (Tempo wie beim Vorlesen). Der Ton bleibt auf dem Gerät.

export const dauerText = (s) => Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
export const notizHtml = (id, sekunden) => '<span class="sprachnotiz" contenteditable="false" data-audio="' + String(id).replace(/"/g, "") + '" data-dauer="' + Math.round(sekunden) + '" role="button" tabindex="0" aria-label="Sprachnotiz abspielen, ' + dauerText(sekunden) + '">🎙️ ' + dauerText(sekunden) + '</span>';

// Aufnahme-Fenster → { blob, sekunden } oder null
export function aufnehmen() {
  const KW = window.KW;
  return new Promise(async (fertig) => {
    let strom;
    try { strom = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { KW.toast("Das Mikrofon ist nicht erlaubt."); fertig(null); return; }
    const typ = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    const rec = new MediaRecorder(strom, typ ? { mimeType: typ, audioBitsPerSecond: 32000 } : undefined), teile = [];
    const d = document.createElement("dialog"); d.className = "sheet";
    d.innerHTML = '<div class="sheet-in sn-auf"><h2>🎙️ Sprachnotiz</h2><div class="sn-punkt" aria-hidden="true"></div><div class="sn-zeit" id="snZ" role="timer">0:00</div><p class="muted klein">Höchstens 5 Minuten. Der Ton bleibt auf deinem Gerät.</p>' +
      '<div class="sheet-foot"><button type="button" class="btn" id="snAb">Verwerfen</button><span class="sp"></span><button type="button" class="btn primary" id="snOk">⏹ Fertig</button></div></div>';
    document.body.appendChild(d);
    const start = Date.now(); let ergebnis = null, abbruch = false;
    const uhr = setInterval(() => { const s = (Date.now() - start) / 1000; d.querySelector("#snZ").textContent = dauerText(s); if (s >= 300) d.querySelector("#snOk").click(); }, 250);
    rec.ondataavailable = (e) => { if (e.data.size) teile.push(e.data); };
    rec.onstop = () => { strom.getTracks().forEach(t => t.stop()); clearInterval(uhr); if (!abbruch && teile.length) ergebnis = { blob: new Blob(teile, { type: rec.mimeType || "audio/webm" }), sekunden: (Date.now() - start) / 1000 }; d.close(); };
    d.querySelector("#snAb").onclick = () => { abbruch = true; rec.stop(); };
    d.querySelector("#snOk").onclick = () => rec.stop();
    d.addEventListener("cancel", (e) => { e.preventDefault(); abbruch = true; rec.stop(); });
    d.addEventListener("close", () => { d.remove(); fertig(ergebnis); });
    rec.start(500); d.showModal();
  });
}

// Klick auf eine Sprachnotiz im Text → abspielen/anhalten
export function anbinden(wurzel, holen) {
  let aktuell = null;
  const KW = window.KW;
  async function spielen(el) {
    if (aktuell && aktuell.el === el) { if (aktuell.audio.paused) aktuell.audio.play(); else aktuell.audio.pause(); return; }
    stopp();
    const blob = await holen(el.dataset.audio);
    if (!blob) { KW.toast("Diese Sprachnotiz ist auf diesem Gerät nicht da."); return; }
    const url = URL.createObjectURL(blob), audio = new Audio(url);
    audio.playbackRate = KW.load("kw-vorlesen-tempo", 1);
    aktuell = { el, audio, url };
    el.classList.add("spielt");
    audio.ontimeupdate = () => { const d = audio.duration && isFinite(audio.duration) ? audio.duration : Number(el.dataset.dauer) || 1; el.style.setProperty("--p", Math.min(100, audio.currentTime / d * 100) + "%"); };
    audio.onpause = () => el.classList.remove("spielt"); audio.onplay = () => el.classList.add("spielt");
    audio.onended = stopp;
    audio.play().catch(() => { KW.toast("Abspielen geht gerade nicht."); stopp(); });
  }
  function stopp() { if (!aktuell) return; aktuell.audio.pause(); URL.revokeObjectURL(aktuell.url); aktuell.el.classList.remove("spielt"); aktuell.el.style.removeProperty("--p"); aktuell = null; }
  const klick = (e) => { const el = e.target.closest && e.target.closest(".sprachnotiz"); if (!el || !wurzel.contains(el)) return; e.preventDefault(); spielen(el); };
  const taste = (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("sprachnotiz")) { e.preventDefault(); spielen(e.target); } };
  wurzel.addEventListener("click", klick); wurzel.addEventListener("keydown", taste);
  return () => { stopp(); wurzel.removeEventListener("click", klick); wurzel.removeEventListener("keydown", taste); };
}
