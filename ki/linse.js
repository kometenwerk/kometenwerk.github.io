// AORIS KI · Ehrliche Linse
// Prüft Bilder komplett auf dem Gerät: Herkunftsdaten auslesen + KI-Erkenner.
// Das Bild verlässt nie das Gerät.

export const LINSE = {
  // Feste Version der Bibliothek und des Modells (Sicherheitskonzept Punkt 3)
  bibliothek: "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.web.min.js",
  modell: "onnx-community/Deep-Fake-Detector-v2-Model-ONNX",
  dtype: "q8",           // ca. 90 MB, läuft auch ohne WebGPU
  version: "linse-1",
  // Grenzen für das Urteil – nie „100 % sicher“
  grenzeKI: 0.80,
  grenzeEcht: 0.20
};

// ---------- 1. Herkunftsdaten (reine Funktion, ohne KI) ----------

// Sucht in den Bytes des Bildes nach bekannten Spuren.
export function herkunftLesen(bytes) {
  const n = Math.min(bytes.length, 4 * 1024 * 1024);
  let s = "";
  for (let i = 0; i < n; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(n, i + 8192)));
  const klein = s.toLowerCase();

  const funde = [];
  const hat = w => klein.includes(w);

  // Content Credentials (C2PA) – fälschungssichere Herkunftsdaten
  const c2pa = hat("c2pa") && (hat("jumb") || hat("jumd"));
  if (c2pa) funde.push({ art: "info", text: "Das Bild hat Content Credentials (C2PA). Das sind Herkunftsdaten, die Kameras oder KI-Programme hineinschreiben." });

  // IPTC-Kennzeichnung für KI-Bilder
  const kiKennung = hat("trainedalgorithmicmedia") || hat("compositesynthetic") || hat("algorithmicmedia");
  if (kiKennung) funde.push({ art: "ki", text: "Im Bild steht die offizielle Kennzeichnung „von KI erzeugt“." });

  // Bekannte KI-Programme
  const programme = [
    ["stable diffusion", "Stable Diffusion"], ["comfyui", "ComfyUI"], ["midjourney", "Midjourney"],
    ["dall-e", "DALL·E"], ["openai", "OpenAI"], ["adobe firefly", "Adobe Firefly"],
    ["leonardo.ai", "Leonardo"], ["ideogram", "Ideogram"], ["novelai", "NovelAI"], ["invokeai", "InvokeAI"],
    ["automatic1111", "Stable Diffusion"]
    // Kurze Namen wie „flux“ oder „gemini“ fehlen absichtlich: die kommen in Bilddaten auch zufällig vor.
  ];
  const gefunden = new Set();
  for (const [such, name] of programme) if (hat(such)) gefunden.add(name);
  // PNG-Textfeld „parameters“ mit Prompt-Spuren (typisch für Stable Diffusion)
  if (/parameters\0[\s\S]{0,400}(steps:|sampler:|cfg scale)/i.test(s)) gefunden.add("Stable Diffusion");
  if (gefunden.size) funde.push({ art: "ki", text: "In den Bilddaten taucht ein KI-Programm auf: " + [...gefunden].join(", ") + "." });

  // Kamera-Daten (EXIF)
  const exif = s.includes("Exif\0\0");
  if (exif && !gefunden.size && !kiKennung) funde.push({ art: "info", text: "Das Bild hat Kamera-Daten (EXIF). Das spricht eher für ein Foto – kann aber auch gefälscht sein." });

  if (!funde.length) funde.push({ art: "info", text: "Keine Herkunftsdaten gefunden. Das ist normal: WhatsApp, Instagram & Co. löschen sie meistens. Es sagt also nichts darüber, ob das Bild echt ist." });

  return { c2pa, kiKennung, programme: [...gefunden], exif, funde };
}

// ---------- 2. Urteil aus Erkenner + Herkunft (reine Funktion) ----------

export function urteilBilden(kiWert, herkunft) {
  // kiWert: Wahrscheinlichkeit 0..1 laut Erkenner, oder null wenn nicht verfügbar
  if (herkunft && (herkunft.kiKennung || herkunft.programme.length)) {
    return { stufe: "ki", titel: "Wahrscheinlich KI-Bild", grund: "Die Bilddaten sagen selbst, dass ein KI-Programm beteiligt war." };
  }
  if (kiWert == null) return { stufe: "unsicher", titel: "Keine Einschätzung möglich", grund: "Der Erkenner konnte nicht laufen. Nur die Herkunftsdaten wurden geprüft." };
  if (kiWert >= LINSE.grenzeKI) return { stufe: "ki", titel: "Wahrscheinlich gefälscht", grund: "Der Erkenner findet starke Spuren einer KI-Fälschung." };
  if (kiWert <= LINSE.grenzeEcht) return { stufe: "echt", titel: "Wahrscheinlich echt", grund: "Der Erkenner findet kaum Spuren einer KI-Fälschung." };
  return { stufe: "unsicher", titel: "Unsicher", grund: "Der Erkenner ist sich nicht sicher. Schau dir das Bild selbst genau an und prüf die Quelle." };
}

// Ermittelt aus den Ausgaben des Modells den KI-Wert. Label-Namen werden flexibel erkannt.
export function kiWertAus(ausgabe) {
  if (!Array.isArray(ausgabe) || !ausgabe.length) return null;
  const istKI = l => /deepfake|fake|artificial|\bai\b|generated|synthetic/i.test(l) && !/real/i.test(l);
  const istEcht = l => /real|human|authentic/i.test(l);
  const ki = ausgabe.find(a => istKI(a.label));
  if (ki) return clamp(ki.score);
  const echt = ausgabe.find(a => istEcht(a.label));
  if (echt) return clamp(1 - echt.score);
  return null;
}
const clamp = x => Math.max(0, Math.min(1, Number(x) || 0));

// ---------- 3. Der KI-Erkenner (lädt erst bei Bedarf) ----------

let erkenner = null, laedt = null;

export async function erkennerLaden(fortschritt) {
  if (erkenner) return erkenner;
  if (laedt) return laedt;
  laedt = (async () => {
    const t = await import(LINSE.bibliothek);
    t.env.allowLocalModels = false;
    const dateien = {};
    const pipe = await t.pipeline("image-classification", LINSE.modell, {
      dtype: LINSE.dtype,
      device: "wasm",
      progress_callback: p => {
        if (!fortschritt || !p) return;
        if (p.file && p.total) { dateien[p.file] = [p.loaded || 0, p.total]; }
        let geladen = 0, gesamt = 0;
        for (const k in dateien) { geladen += dateien[k][0]; gesamt += dateien[k][1]; }
        fortschritt(gesamt ? geladen / gesamt : 0, p.status);
      }
    });
    erkenner = pipe;
    return pipe;
  })();
  try { return await laedt; } finally { laedt = null; }
}

export async function bildPruefen(datei, fortschritt) {
  if (!datei || !/^image\//.test(datei.type)) throw new Error("Das ist kein Bild.");
  if (datei.size > 25 * 1024 * 1024) throw new Error("Das Bild ist zu groß (mehr als 25 MB).");
  const bytes = new Uint8Array(await datei.arrayBuffer());
  const herkunft = herkunftLesen(bytes);

  let kiWert = null, fehler = null;
  const url = URL.createObjectURL(datei);
  try {
    const pipe = await erkennerLaden(fortschritt);
    const aus = await pipe(url, { top_k: 5 });
    kiWert = kiWertAus(aus);
  } catch (e) {
    console.error(e);
    fehler = e && e.message ? e.message : String(e);
  } finally {
    URL.revokeObjectURL(url);
  }
  return { herkunft, kiWert, urteil: urteilBilden(kiWert, herkunft), fehler };
}
