// FIDELIA Notizen – PDFs und Bilder als Heftseiten, auf die man mit dem Stift schreiben kann.
// Alles passiert auf dem Gerät: PDFs werden mit pdf.js (lib/pdfjs, Apache-2.0) gezeichnet, nichts geht ins Internet.

const MAX_SEITEN = 60;
const LANG = 2339, KURZ = 1654; // A4 bei 200 dpi

// Bild/Canvas auf ein weißes A4-Blatt setzen (hoch oder quer, je nach Form)
async function aufA4(quelle, w, h) {
  const quer = w > h * 1.05, W = quer ? LANG : KURZ, H = quer ? KURZ : LANG;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const f = Math.min(W / w, H / h), bw = w * f, bh = h * f;
  g.imageSmoothingQuality = "high";
  g.drawImage(quelle, (W - bw) / 2, (H - bh) / 2, bw, bh);
  const blob = await new Promise(ok => c.toBlob(ok, "image/jpeg", 0.88));
  return { blob, quer };
}

async function bildLaden(datei) {
  if (window.createImageBitmap && !/svg/i.test(datei.type)) {
    try { const b = await createImageBitmap(datei); return { quelle: b, w: b.width, h: b.height }; } catch (e) { /* weiter mit <img> */ }
  }
  const url = URL.createObjectURL(datei);
  try {
    const i = await new Promise((ok, nein) => { const x = new Image(); x.onload = () => ok(x); x.onerror = nein; x.src = url; });
    return { quelle: i, w: i.naturalWidth || 1654, h: i.naturalHeight || 2339 };
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
}

async function pdfBlaetter(datei, fortschritt) {
  const pdfjs = await import("./lib/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./lib/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await datei.arrayBuffer()), isEvalSupported: false }).promise;
  const n = Math.min(doc.numPages, MAX_SEITEN), out = [];
  for (let i = 1; i <= n; i++) {
    fortschritt(i, n);
    const seite = await doc.getPage(i);
    const v1 = seite.getViewport({ scale: 1 }), f = LANG / Math.max(v1.width, v1.height), v = seite.getViewport({ scale: f });
    const c = document.createElement("canvas"); c.width = Math.round(v.width); c.height = Math.round(v.height);
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    await seite.render({ canvasContext: g, viewport: v }).promise;
    out.push(await aufA4(c, c.width, c.height));
    seite.cleanup();
  }
  const mehr = doc.numPages - n;
  doc.destroy();
  return { blaetter: out, mehr };
}

export const istPdf = (d) => /\.pdf$/i.test(d.name || "") || d.type === "application/pdf";
export const istBild = (d) => /^image\//.test(d.type || "") || /\.(png|jpe?g|gif|webp|svg|bmp|heic)$/i.test(d.name || "");

// Hauptfunktion: legt Seiten an und öffnet die erste im Stift-Modus.
export async function alsSeiten(A, datei, { fach = "" } = {}) {
  const name = (datei.name || "Eingefügt").replace(/\.[^.]+$/, "") || "Eingefügt";
  let meldung = null;
  const zeige = (t) => { if (!meldung) { meldung = document.createElement("div"); meldung.className = "kw-toast import-fortschritt"; meldung.setAttribute("role", "status"); document.body.appendChild(meldung); } meldung.textContent = t; };
  try {
    let blaetter, mehr = 0;
    if (istPdf(datei)) {
      zeige("📄 PDF wird geöffnet …");
      const r = await pdfBlaetter(datei, (i, n) => zeige("📄 Seite " + i + " von " + n + " wird geladen …"));
      blaetter = r.blaetter; mehr = r.mehr;
    } else {
      zeige("🖼️ Bild wird eingefügt …");
      const b = await bildLaden(datei);
      blaetter = [await aufA4(b.quelle, b.w, b.h)];
    }
    if (!blaetter.length) { KW.toast("In der Datei war keine Seite."); return null; }
    let erste = null;
    // rückwärts anlegen, damit Seite 1 in der Liste oben steht
    for (let i = blaetter.length - 1; i >= 0; i--) {
      const bl = blaetter[i], bild = await A.bildSpeichern(bl.blob);
      const titel = blaetter.length > 1 ? name + " – Seite " + (i + 1) : name;
      const s = await A.seiteNeu({ quelle: "import", bild, raster: "leer", quer: bl.quer, hoehe: bl.quer ? 210 : 297, titel, fach });
      if (i === 0) erste = s;
    }
    KW.save("kw-notizen-stift-modus", "stift");
    KW.toast("✓ " + (blaetter.length > 1 ? blaetter.length + " Seiten" : "Seite") + " eingefügt – schreib mit dem Stift darauf." + (mehr ? " (" + mehr + " weitere Seiten weggelassen – höchstens " + MAX_SEITEN + ")" : ""));
    A.gehe("seite/" + erste.id);
    return erste;
  } catch (e) {
    console.error(e);
    KW.toast(istPdf(datei) ? "Dieses PDF konnte ich nicht öffnen. Ist es mit einem Passwort geschützt?" : "Dieses Bild konnte ich nicht öffnen.");
    return null;
  } finally { if (meldung) meldung.remove(); }
}

// Strg+V: kopiertes Bild oder PDF als neue Seite (nur, wenn gerade kein Textfeld aktiv ist)
export function einfuegenAktivieren(A) {
  document.addEventListener("paste", (e) => {
    const ziel = document.activeElement;
    if (ziel && (ziel.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ziel.tagName))) return;
    const d = [...(e.clipboardData ? e.clipboardData.files : [])].find(f => istBild(f) || istPdf(f));
    if (!d) return;
    e.preventDefault();
    alsSeiten(A, d.name ? d : new File([d], "Eingefügt " + new Date().toLocaleDateString("de-DE") + ".png", { type: d.type }));
  });
}
