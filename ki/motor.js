// AORIS KI · Motor
// Eine Schnittstelle für alle Gehirne der KI: Gemini Nano (in Chrome eingebaut) oder ein
// offenes Modell über WebLLM. Alles läuft auf dem Gerät.

export const WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.84/lib/index.js";

export const MODELLE = [
  { id: "nano", art: "nano", name: "Gemini Nano von Google",
    text: "Googles KI, die in Chrome eingebaut ist. Läuft auf deinem Gerät, kein Extra-Download, wenn Chrome sie schon hat." },
  { id: "gemma-2-2b-it-q4f16_1-MLC", f32: "gemma-2-2b-it-q4f32_1-MLC", art: "webllm", name: "Google Gemma",
    text: "Offenes Modell von Google. Deutlich schlauer als „Klein“. Download: rund 1,5 GB.", vram: 1900 },
  { id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-3B-Instruct-q4f32_1-MLC", art: "webllm", name: "Groß – für starke PCs",
    text: "Das schlauste Modell hier. Braucht einen PC mit guter Grafikkarte. Download: rund 2 GB.", vram: 2500 },
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", f32: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC", art: "webllm", name: "Klein und schnell",
    text: "Für schwächere Handys. Download: einige hundert MB. Macht deutlich öfter Fehler.", vram: 950 }
];

// Welches Modell passt zu diesem Gerät? (reine Funktion, testbar)
// g = { nano: bool, gpu: bool, speicherGB: Zahl|null, handy: bool }
export function empfehlung(g) {
  if (g.nano) return "nano";
  if (!g.gpu) return null;
  const sp = g.speicherGB || 4;
  if (!g.handy && sp >= 8) return "gemma-2-2b-it-q4f16_1-MLC";
  if (g.handy && sp >= 8) return "gemma-2-2b-it-q4f16_1-MLC";
  return "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
}

// Ist ein Modell auf diesem Gerät überhaupt möglich? (reine Funktion)
export function moeglich(modell, g) {
  return modell.art === "nano" ? !!g.nano : !!g.gpu;
}

// Wandelt Teilstücke aus einem Stream in neuen Text um – egal ob das Stück nur das Neue
// oder den ganzen bisherigen Text enthält (reine Funktion)
export function neuerText(bisher, stueck) {
  stueck = String(stueck || "");
  if (bisher && stueck.length > bisher.length && stueck.startsWith(bisher)) return stueck.slice(bisher.length);
  return stueck;
}

// Entfernt Denk-Blöcke, die manche Modelle ausgeben (reine Funktion)
export function ohneDenken(text) {
  return String(text).replace(/<think>[\s\S]*?(<\/think>|$)/g, "").replace(/^\s+/, "");
}

const NANO_OPT = { expectedInputs: [{ type: "text", languages: ["de"] }], expectedOutputs: [{ type: "text", languages: ["de"] }] };

export async function geraetPruefen() {
  const g = { nano: false, gpu: false, f16: false, speicherGB: navigator.deviceMemory || null,
    handy: /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) };
  try {
    if (typeof LanguageModel !== "undefined" && LanguageModel.availability) {
      const a = await LanguageModel.availability(NANO_OPT);
      g.nano = a && a !== "unavailable";
      g.nanoStatus = a;
    }
  } catch (e) { g.nano = false; }
  try {
    if ("gpu" in navigator) {
      const ad = await navigator.gpu.requestAdapter();
      g.gpu = !!ad;
      g.f16 = !!(ad && ad.features && ad.features.has("shader-f16"));
    }
  } catch (e) { g.gpu = false; }
  return g;
}

// Startet das gewählte Gehirn. Gibt ein einheitliches Objekt zurück:
// { name, async *antworte(nachrichten, {signal}), async neu() }
export async function starten(modellId, g, fortschritt) {
  const m = MODELLE.find(x => x.id === modellId);
  if (!m) throw new Error("Unbekanntes Modell");

  if (m.art === "nano") {
    // Erster Aufruf startet bei Bedarf den Download in Chrome
    const probe = await LanguageModel.create({ ...NANO_OPT,
      monitor(mon) { mon.addEventListener("downloadprogress", e => fortschritt && fortschritt(e.loaded || 0, "Chrome lädt Gemini Nano …")); } });
    probe.destroy();
    fortschritt && fortschritt(1, "Gemini Nano ist bereit.");
    return {
      name: m.name,
      async *antworte(nachrichten, opt = {}) {
        const letzte = nachrichten[nachrichten.length - 1];
        const s = await LanguageModel.create({ ...NANO_OPT, initialPrompts: nachrichten.slice(0, -1), signal: opt.signal });
        try {
          let bisher = "";
          for await (const stueck of s.promptStreaming(letzte.content, { signal: opt.signal })) {
            const neu = neuerText(bisher, stueck);
            bisher += neu;
            yield neu;
          }
        } finally { try { s.destroy(); } catch (e) {} }
      },
      async neu() {}
    };
  }

  const id = g.f16 || !m.f32 ? m.id : m.f32;
  const webllm = await import(WEBLLM);
  const engine = await webllm.CreateMLCEngine(id, {
    initProgressCallback: r => fortschritt && fortschritt(r.progress || 0, r.text || "")
  });
  return {
    name: m.name,
    async *antworte(nachrichten, opt = {}) {
      const stream = await engine.chat.completions.create({ messages: nachrichten, stream: true, temperature: 0.4, max_tokens: 700 });
      for await (const teil of stream) {
        if (opt.signal && opt.signal.aborted) { try { engine.interruptGenerate(); } catch (e) {} return; }
        yield (teil.choices[0] && teil.choices[0].delta && teil.choices[0].delta.content) || "";
      }
    },
    async neu() { try { await engine.resetChat(); } catch (e) {} }
  };
}
