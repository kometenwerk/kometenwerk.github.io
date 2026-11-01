// AORIS KI · Nachschlagen bei Wikipedia
// Nur wenn der Nutzer es eingeschaltet hat. Es geht nur der Suchbegriff an Wikipedia,
// nichts sonst (kein Verlauf, keine Bilder, keine Kennung).

const STOPP = new Set(("was wer wie wo wann warum wieso weshalb welche welcher welches wieviel wieviele " +
  "ist sind war waren wird werden wurde wurden hat haben hatte hatten kann können konnte gibt es " +
  "der die das den dem des ein eine einen einem einer eines im in ins am an auf aus bei mit nach von vom zu zum zur über unter für " +
  "und oder aber denn doch auch noch schon nur sehr mal bitte erkläre erklär erklären sag sage mir mich mein meine du dein ich wir ihr sie er " +
  "eigentlich genau ungefähr heißt heisst nennt man bedeutet bedeutung").split(" "));

// Macht aus einer Frage kurze Suchbegriffe (reine Funktion)
export function suchbegriffe(frage) {
  const woerter = String(frage || "").toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/).filter(w => w && w.length > 1 && !STOPP.has(w));
  return woerter.slice(0, 8).join(" ");
}

// Lohnt sich Nachschlagen? Bei reinen Plaudereien oder Aufgaben eher nicht (reine Funktion)
export function lohntNachschlagen(frage) {
  const f = String(frage || "").trim().toLowerCase();
  if (f.length < 6) return false;
  if (/^(hallo|hi|hey|danke|ok|okay|super|cool|tschüss|guten (morgen|tag|abend))\b/.test(f)) return false;
  if (/(schreib|dichte|erfinde|stell mir|quizfragen|gliedern|übersetz|formulier)/.test(f)) return false;
  return suchbegriffe(f).length > 2;
}

// Baut den Text, den die KI als Quelle bekommt – kurz, damit auch kleine Modelle damit klarkommen (reine Funktion)
export function kontextBauen(treffer, maxZeichen = 1600) {
  let rest = maxZeichen, teile = [];
  treffer.forEach((t, i) => {
    if (rest < 120) return;
    const text = t.text.replace(/\s+/g, " ").trim().slice(0, Math.min(700, rest));
    teile.push("[" + (i + 1) + "] " + t.titel + ": " + text);
    rest -= text.length + t.titel.length + 6;
  });
  return teile.join("\n");
}

// Filtert unbrauchbare Seiten (Begriffsklärungen) aus der Wikipedia-Antwort (reine Funktion)
export function trefferAus(daten, max = 3) {
  const seiten = (daten && daten.query && daten.query.pages) || {};
  return Object.keys(seiten).map(k => seiten[k])
    .filter(x => x && x.title && x.extract && !/Begriffsklärung/.test(x.title) && !/bezeichnet:?$/.test(x.extract.trim()))
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .slice(0, max)
    .map(x => ({ titel: x.title, text: x.extract, url: x.fullurl || ("https://de.wikipedia.org/wiki/" + encodeURIComponent(x.title.replace(/ /g, "_"))) }));
}

export async function nachschlagen(frage) {
  const q = suchbegriffe(frage);
  if (!q) return [];
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw new Error("offline");
  const url = "https://de.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&generator=search&gsrnamespace=0&gsrlimit=5" +
    "&gsrsearch=" + encodeURIComponent(q) + "&prop=extracts%7Cinfo&exintro=1&explaintext=1&exsentences=5&exlimit=5&inprop=url";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!r.ok) throw new Error("Wikipedia antwortet nicht");
    return trefferAus(await r.json());
  } finally { clearTimeout(t); }
}
