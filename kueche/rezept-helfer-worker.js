/* Kometen-Küche – Rezept-Helfer (Cloudflare Worker, kostenlos)
   Holt eine Rezeptseite und gibt NUR die Rezept-Daten zurück (Titel, Zutaten, Schritte, Bild).
   Er ist absichtlich kein allgemeiner Proxy: Er liefert nie die ganze Seite aus.
   Einrichten: siehe HELFER-EINRICHTEN.md */

const ERLAUBT = ["https://kometenwerk.github.io"]; // nur unsere Seite darf den Helfer benutzen
const MAX_HTML = 3_000_000, MAX_BILD = 4_000_000;

export default {
  async fetch(req) {
    const origin = req.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": ERLAUBT.includes(origin) ? origin : ERLAUBT[0], "Vary": "Origin" };
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...cors, "Access-Control-Allow-Methods": "GET", "Access-Control-Max-Age": "86400" } });
    if (req.method !== "GET") return antwort({ fehler: "methode" }, 405, cors);
    if (!ERLAUBT.includes(origin)) return antwort({ fehler: "nicht-erlaubt" }, 403, cors);

    const u = new URL(req.url);
    const bild = u.searchParams.get("bild"), seite = u.searchParams.get("url");
    const ziel = pruefen(bild || seite);
    if (!ziel) return antwort({ fehler: "adresse" }, 400, cors);

    try {
      const res = await fetch(ziel, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Kometen-Kueche/1.0; +https://kometenwerk.github.io/kueche/)", "Accept-Language": "de-DE,de;q=0.9,en;q=0.6" },
        redirect: "follow", cf: { cacheTtl: 3600 }
      });
      if (!res.ok) return antwort({ fehler: "seite", status: res.status }, 502, cors);

      if (bild) {
        const typ = res.headers.get("Content-Type") || "";
        if (!/^image\/(jpeg|png|webp|gif|avif)/i.test(typ)) return antwort({ fehler: "kein-bild" }, 415, cors);
        const buf = await begrenzt(res, MAX_BILD);
        if (!buf) return antwort({ fehler: "zu-gross" }, 413, cors);
        return new Response(buf, { headers: { ...cors, "Content-Type": typ, "Cache-Control": "public, max-age=86400" } });
      }

      const buf = await begrenzt(res, MAX_HTML);
      if (!buf) return antwort({ fehler: "zu-gross" }, 413, cors);
      const html = new TextDecoder("utf-8").decode(buf);
      const r = rezeptFinden(html, ziel);
      if (!r) return antwort({ fehler: "kein-rezept", titel: meta(html, "og:title") || "" }, 404, cors);
      return antwort(r, 200, cors);
    } catch (e) {
      return antwort({ fehler: "netz" }, 502, cors);
    }
  }
};

function antwort(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
}
function pruefen(adr) {
  try {
    const u = new URL(adr);
    if (!/^https?:$/.test(u.protocol)) return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)/i.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return null;
    return u.href;
  } catch (e) { return null; }
}
async function begrenzt(res, max) {
  const reader = res.body.getReader(); const teile = []; let n = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > max) { reader.cancel(); return null; } teile.push(value); }
  const out = new Uint8Array(n); let o = 0; for (const t of teile) { out.set(t, o); o += t.length; } return out;
}
function meta(html, name) {
  const m = html.match(new RegExp('<meta[^>]+(?:property|name)=["\']' + name + '["\'][^>]*content=["\']([^"\']*)', "i")) || html.match(new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + name, "i"));
  return m ? entities(m[1]) : "";
}
function entities(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16))).replace(/\s+/g, " ").trim();
}
function istRezept(o) { const t = o && o["@type"]; return t === "Recipe" || (Array.isArray(t) && t.includes("Recipe")); }
function suchen(o, tiefe = 0) {
  if (!o || tiefe > 6) return null;
  if (Array.isArray(o)) { for (const x of o) { const r = suchen(x, tiefe + 1); if (r) return r; } return null; }
  if (typeof o !== "object") return null;
  if (istRezept(o)) return o;
  for (const k of ["@graph", "mainEntity", "itemListElement"]) { const r = suchen(o[k], tiefe + 1); if (r) return r; }
  return null;
}
function text(x) {
  if (x == null) return "";
  if (typeof x === "string") return entities(x);
  if (Array.isArray(x)) return x.map(text).filter(Boolean).join(", ");
  if (typeof x === "object") return text(x.name || x.text || x["@value"] || "");
  return String(x);
}
function schritte(x) {
  const out = [];
  (function lauf(y) {
    if (!y) return;
    if (typeof y === "string") { entities(y).split(/\n+|(?<=\.)\s+(?=\d+\.\s)/).map(s => s.trim()).filter(Boolean).forEach(s => out.push(s)); return; }
    if (Array.isArray(y)) { y.forEach(lauf); return; }
    if (y["@type"] === "HowToSection" || y.itemListElement) { lauf(y.itemListElement); return; }
    if (y.text || y.name) out.push(entities(y.text || y.name));
  })(x);
  return out.filter(s => s.length > 1).slice(0, 60);
}
function bildUrl(x, basis) {
  let b = x; if (Array.isArray(b)) b = b[0]; if (b && typeof b === "object") b = b.url || b.contentUrl || "";
  try { return b ? new URL(b, basis).href : ""; } catch (e) { return ""; }
}
function minuten(iso) {
  const m = String(iso || "").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null; const n = (+(m[1] || 0)) * 1440 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)); return n || null;
}
function rezeptFinden(html, basis) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) {
    let j; try { j = JSON.parse(m[1].trim()); } catch (e) { try { j = JSON.parse(m[1].trim().replace(/[\u0000-\u001f]+/g, " ")); } catch (e2) { continue; } }
    const r = suchen(j); if (!r) continue;
    const yieldTxt = text(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield);
    return {
      titel: text(r.name).slice(0, 140),
      portionen: (yieldTxt.match(/\d+/) || [null])[0] ? +(yieldTxt.match(/\d+/)[0]) : null,
      zeit: minuten(r.totalTime) || ((minuten(r.prepTime) || 0) + (minuten(r.cookTime) || 0)) || null,
      zutaten: (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : Array.isArray(r.ingredients) ? r.ingredients : []).map(text).filter(Boolean).slice(0, 80),
      schritte: schritte(r.recipeInstructions),
      kategorien: [text(r.recipeCategory), text(r.recipeCuisine)].join(", ").split(/,\s*/).filter(Boolean).slice(0, 6),
      bild: bildUrl(r.image, basis),
      quelle: basis
    };
  }
  return null;
}
