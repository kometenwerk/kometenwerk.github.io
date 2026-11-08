// FIDELIA Notizen · Spracherkennung (Whisper) direkt im Browser
// Das Modell wird einmal geladen und dann vom Browser gespeichert. Ton geht nie ins Internet.

const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.web.min.js";
const MODELLE = { tiny: "onnx-community/whisper-tiny", base: "onnx-community/whisper-base", small: "onnx-community/whisper-small" };
export const GROESSE = { tiny: "ca. 75 MB", base: "ca. 150 MB", small: "ca. 500 MB" };

export const istHandy = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

// "auto" → auf dem Handy das kleine, sonst das normale Modell
export function modellName(wahl) {
  if (wahl === "tiny" || wahl === "base" || wahl === "small") return wahl;
  return istHandy() ? "tiny" : "base";
}

let whisper = null, whisperName = "", laden = null;

export async function laden_(wahl, fortschritt) {
  const name = modellName(wahl);
  if (whisper && whisperName === name) return whisper;
  if (laden && laden.name === name) return laden.p;
  const p = (async () => {
    const T = await import(TRANSFORMERS);
    const gpu = "gpu" in navigator && !!(await navigator.gpu.requestAdapter().catch(() => null));
    const dateien = {};
    const w = await T.pipeline("automatic-speech-recognition", MODELLE[name], {
      device: gpu ? "webgpu" : "wasm",
      dtype: gpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
      progress_callback: (p) => {
        if (fortschritt && p && p.file && typeof p.loaded === "number" && p.total) {
          dateien[p.file] = [p.loaded, p.total];
          const l = Object.values(dateien).reduce((a, x) => a + x[0], 0), t = Object.values(dateien).reduce((a, x) => a + x[1], 0);
          fortschritt(l / t, "Spracherkennung wird geladen … " + Math.round(l / 1048576) + " MB");
        }
      }
    });
    whisper = w; whisperName = name;
    return w;
  })();
  laden = { name, p };
  p.catch(() => { laden = null; });
  return p;
}
export { laden_ as laden };
