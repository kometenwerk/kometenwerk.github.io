// FIDELIA Notizen · Lern-Center
// Die lokale KI macht aus einer Heftseite Karteikarten (Vorder-/Rückseite) und Quizfragen (4 Antworten).
// Vor dem Speichern prüft der Schüler alles (kleine KI-Modelle machen Fehler). Üben mit Karteikasten-System,
// Quiz mit Punkten – und auf Wunsch weiter an die App FIDELIA Quiz.

import * as KI from "./ki.js";
import * as Planer from "./planer.js";

const KW = window.KW, esc = KW.esc;
const ABSTAND = [0, 1, 3, 7, 14]; // Tage bis zur Wiederholung je Fach im Karteikasten

const faellig = (k) => !k.faellig || k.faellig <= KW.today();
function mischen(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Erinnerungen: Arbeit in den nächsten Tagen + Karten in diesem Fach
export function erinnerungen(A) {
  if (!A.einst.an.lernen || !A.einst.f.lernen.erinnerung) return [];
  const out = [];
  for (const t of Planer.arbeiten(Planer.daten())) {
    const n = KW.days(KW.today(), t.datum);
    if (n > 7) continue;
    const sets = A.lern.filter(s => s.fach && s.fach === t.fach);
    const karten = sets.reduce((x, s) => x + s.karten.length, 0);
    out.push({ fach: t.fach, titel: t.titel, tage: n, karten, set: sets[0] });
  }
  return out;
}

export function zeigen(A, el, param) {
  const [setId, art] = (param || "").split("/");
  const set = setId && A.lern.find(s => s.id === setId);
  if (set && art === "karten") return karteikarten(A, el, set);
  if (set && art === "quiz") return quiz(A, el, set);
  if (set) return setAnsicht(A, el, set);
  liste(A, el);
}

function liste(A, el) {
  const er = erinnerungen(A);
  let h = '<div class="kopfzeile"><h2 class="titel">🧠 Lern-Center</h2><span class="sp"></span><button type="button" class="btn primary" id="ausSeite">+ Aus einer Heftseite</button></div>';
  if (er.length) h += er.map(r => '<div class="card erinnerung" style="--f:' + esc(A.fachFarbe(r.fach)) + '">⏰ <span><b>' + esc(r.fach || "Arbeit") + ': ' + esc(r.titel) + '</b> ' + (r.tage === 0 ? "ist heute" : r.tage === 1 ? "ist morgen" : "in " + r.tage + " Tagen") +
    (r.karten ? " – " + r.karten + " Karten zum Üben" : " – noch keine Karten in diesem Fach") + '</span>' + (r.set ? '<a class="btn small primary" href="#lernen/' + r.set.id + '/karten">Üben</a>' : "") + '</div>').join("");
  if (!A.lern.length) h += '<div class="empty"><b>Noch keine Lernkarten</b>Öffne eine Seite in deinem Heft und tipp auf „⋯ Mehr → 🧠 Lernkarten & Quiz“. Oder hier oben auf „+ Aus einer Heftseite“.</div>';
  else {
    const gruppen = {};
    A.lern.forEach(s => (gruppen[s.fach || ""] = gruppen[s.fach || ""] || []).push(s));
    for (const [fach, sets] of Object.entries(gruppen)) {
      h += '<h3 class="sec">' + esc(fach || "Ohne Fach") + '</h3><div class="lern-gitter">' + sets.map(s => {
        const f = s.karten.filter(faellig).length;
        return '<a class="card lern-karte" href="#lernen/' + s.id + '" style="--f:' + esc(A.fachFarbe(s.fach)) + '"><b>' + esc(s.titel) + '</b><small>' + s.karten.length + ' Karten · ' + s.fragen.length + ' Fragen' + (f ? ' · <span class="dran">' + f + ' heute dran</span>' : "") + '</small></a>';
      }).join("") + '</div>';
    }
  }
  el.innerHTML = h;
  el.querySelector("#ausSeite").onclick = () => seiteWaehlen(A);
}

function seiteWaehlen(A) {
  const kandidaten = A.seiten.filter(s => A.seitenText(s).replace(/\s/g, "").length > 40).slice(0, 30);
  const d = document.createElement("dialog");
  d.className = "sheet";
  d.innerHTML = '<div class="sheet-in"><h2>Welche Seite?</h2>' + (kandidaten.length ? '<div class="wahl-liste">' + kandidaten.map(s => '<button type="button" class="btn" data-s="' + s.id + '"><span class="punkt" style="background:' + esc(A.fachFarbe(s.fach)) + '"></span>' + esc(s.titel || "Ohne Titel") + '</button>').join("") + '</div>'
    : '<p class="muted">Noch keine Seite mit genug Text. Tippe etwas ins Heft, scanne ein Blatt oder nimm eine Mitschrift auf.</p><p class="muted klein">Nur Gemaltes kann die KI nicht lesen – dafür das Blatt einscannen.</p>') +
    '<div class="sheet-foot"><button type="button" class="btn" id="zu">Abbrechen</button></div></div>';
  document.body.appendChild(d);
  d.querySelectorAll("[data-s]").forEach(b => b.onclick = () => { d.close(); ausSeite(A, A.seite(b.dataset.s)); });
  d.querySelector("#zu").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());
  d.showModal();
}

// KI macht Lernstoff aus einer Seite
export async function ausSeite(A, s) {
  const text = A.seitenText(s);
  if (text.replace(/\s/g, "").length < 40) { KW.toast(s.bild && !s.ocr ? "Erst den Text erkennen lassen (⋯ Mehr → 🔍)." : "Auf der Seite steht zu wenig Text."); return; }
  const d = document.createElement("dialog");
  d.className = "sheet";
  d.innerHTML = '<div class="sheet-in"><h2>🧠 Die KI liest deine Seite …</h2><div class="balken"><i id="bal"></i></div><p class="muted" id="status">Das kann je nach Laptop 10–60 Sekunden dauern.</p>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="ab">Abbrechen</button></div></div>';
  document.body.appendChild(d);
  let abgebrochen = false;
  d.querySelector("#ab").onclick = () => { abgebrochen = true; d.close(); };
  d.addEventListener("close", () => d.remove());
  d.addEventListener("cancel", () => { abgebrochen = true; });
  d.showModal();
  let stoff;
  try {
    stoff = await KI.lernstoff(A.einst.ki, text, (p, t) => { const b = d.querySelector("#bal"); if (b) b.style.width = Math.round((p || 0) * 100) + "%"; const st = d.querySelector("#status"); if (st && t) st.textContent = t; });
  } catch (e) {
    if (abgebrochen) return;
    d.querySelector("h2").textContent = "Keine KI erreichbar";
    d.querySelector("#status").innerHTML = e.message === "keine-ki" ? "Auf diesem Gerät läuft gerade keine KI. Schau unter ⚙️ Einstellungen → KI, wie du Ollama einrichtest." : "Die KI konnte nicht starten oder hat nicht geantwortet. Schau unter ⚙️ Einstellungen → KI nach – dort steht auch, wie du Ollama einrichtest.";
    d.querySelector(".balken").remove();
    d.querySelector("#ab").textContent = "OK";
    return;
  }
  if (abgebrochen) return;
  d.close();
  const F = A.einst.f.lernen;
  if (!F.karten) stoff.karten = [];
  if (!F.quiz) stoff.fragen = [];
  if (!stoff.karten.length && !stoff.fragen.length) { KW.toast("Die KI hat nichts Brauchbares gefunden. Probier eine Seite mit mehr Erklärungen."); return; }
  const set = { id: KW.id(), seiteId: s.id, fach: s.fach, titel: s.titel || "Lernkarten", erstellt: new Date().toISOString(),
    karten: stoff.karten.map(k => ({ id: KW.id(), vorne: k.vorne, hinten: k.hinten, box: 0, faellig: KW.today() })),
    fragen: stoff.fragen.map(f => Object.assign({ id: KW.id() }, f)), rekord: 0 };
  if (F.pruefen) pruefen(A, set, text); else { await A.lernSpeichern(set); A.gehe("lernen/" + set.id); KW.toast("Lernkarten gespeichert."); }
}

// Vorschläge prüfen: Haken weg = fliegt raus, Texte lassen sich direkt verbessern
function pruefen(A, set, quelltext) {
  const d = document.createElement("dialog");
  d.className = "sheet breit";
  d.innerHTML = '<form class="sheet-in" method="dialog"><h2>Passt das so?</h2><p class="muted">Die KI kann sich irren. Entferne den Haken bei allem, was falsch ist, oder verbessere es direkt.</p>' +
    (set.karten.length ? '<h3 class="sec">Karteikarten</h3>' + set.karten.map((k, i) => '<div class="pruef"><input type="checkbox" checked data-k="' + i + '" aria-label="Karte ' + (i + 1) + ' behalten">' +
      '<div><input class="inp" data-kv="' + i + '" value="' + esc(k.vorne) + '" aria-label="Vorderseite"><textarea class="inp" rows="2" data-kh="' + i + '" aria-label="Rückseite">' + esc(k.hinten) + '</textarea></div></div>').join("") : "") +
    (set.fragen.length ? '<h3 class="sec">Quizfragen</h3>' + set.fragen.map((f, i) => '<div class="pruef"><input type="checkbox" checked data-q="' + i + '" aria-label="Frage ' + (i + 1) + ' behalten">' +
      '<div><b>' + esc(f.frage) + '</b><ol class="opts">' + f.optionen.map((o, j) => '<li class="' + (j === f.richtig ? "richtig" : "") + '">' + esc(o) + (j === f.richtig ? " ✓" : "") + '</li>').join("") + '</ol></div></div>').join("") : "") +
    '<details class="klein"><summary>Text der Seite ansehen</summary><pre class="quelltext">' + esc(quelltext.slice(0, 4000)) + '</pre></details>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="ab">Verwerfen</button><span class="sp"></span><button type="submit" class="btn primary">Speichern</button></div></form>';
  document.body.appendChild(d);
  d.querySelector("#ab").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());
  d.querySelector("form").addEventListener("submit", async () => {
    set.karten = set.karten.filter((k, i) => {
      if (!d.querySelector('[data-k="' + i + '"]').checked) return false;
      k.vorne = d.querySelector('[data-kv="' + i + '"]').value.trim(); k.hinten = d.querySelector('[data-kh="' + i + '"]').value.trim();
      return k.vorne && k.hinten;
    });
    set.fragen = set.fragen.filter((f, i) => d.querySelector('[data-q="' + i + '"]').checked);
    if (!set.karten.length && !set.fragen.length) { KW.toast("Nichts behalten."); return; }
    await A.lernSpeichern(set);
    KW.toast("Gespeichert: " + set.karten.length + " Karten, " + set.fragen.length + " Fragen.");
    A.gehe("lernen/" + set.id);
  });
  d.showModal();
}

function setAnsicht(A, el, set) {
  const f = set.karten.filter(faellig).length;
  el.innerHTML = '<div class="kopfzeile"><a class="btn small" href="#lernen" aria-label="Zurück">←</a><h2 class="titel">' + esc(set.titel) + '</h2></div>' +
    '<p class="muted"><span class="punkt" style="background:' + esc(A.fachFarbe(set.fach)) + '"></span>' + esc(set.fach || "Ohne Fach") +
    (set.seiteId && A.seite(set.seiteId) ? ' · <a href="#seite/' + set.seiteId + '">Zur Heftseite</a>' : "") + '</p>' +
    '<div class="gross-knoepfe">' +
      (set.karten.length ? '<a class="btn" href="#lernen/' + set.id + '/karten">🃏 <span><b>Karteikarten üben</b><small>' + set.karten.length + ' Karten' + (f ? ' · ' + f + ' heute dran' : ' · alle gelernt ✓') + '</small></span></a>' : "") +
      (set.fragen.length ? '<a class="btn" href="#lernen/' + set.id + '/quiz">❓ <span><b>Quiz spielen</b><small>' + set.fragen.length + ' Fragen' + (set.rekord ? ' · Rekord ' + set.rekord + '/' + set.fragen.length : "") + '</small></span></a>' : "") +
    '</div>' +
    '<h3 class="sec">Karten</h3><ul class="karten-liste">' + set.karten.map(k => '<li><b>' + esc(k.vorne) + '</b><span>' + esc(k.hinten) + '</span><small class="box">Fach ' + (k.box + 1) + '/5</small></li>').join("") + '</ul>' +
    '<form class="row karte-neu" id="neu"><input class="inp" id="nV" placeholder="Vorderseite" required maxlength="160"><input class="inp" id="nH" placeholder="Rückseite" required maxlength="400"><button class="btn">+ Karte</button></form>' +
    '<div class="row" style="margin-top:16px"><button type="button" class="btn" id="anQuiz">➜ An FIDELIA Quiz schicken</button><span class="sp"></span><button type="button" class="btn danger" id="weg">Löschen</button></div>';
  el.querySelector("#neu").onsubmit = async (e) => {
    e.preventDefault();
    set.karten.push({ id: KW.id(), vorne: el.querySelector("#nV").value.trim(), hinten: el.querySelector("#nH").value.trim(), box: 0, faellig: KW.today() });
    await A.lernSpeichern(set); setAnsicht(A, el, set);
  };
  el.querySelector("#anQuiz").onclick = () => {
    const Q = KW.load("kw-quiz", null) || { stapel: [], rekorde: {} };
    if (!Array.isArray(Q.stapel)) Q.stapel = [];
    const name = (set.fach ? set.fach + " – " : "") + set.titel;
    let st = Q.stapel.find(x => x.name === name);
    if (!st) { st = { id: KW.id(), name, sprache: "de", karten: [] }; Q.stapel.push(st); }
    let neu = 0;
    for (const k of set.karten) if (!st.karten.some(x => x.v === k.vorne)) { st.karten.push({ id: KW.id(), v: k.vorne, r: k.hinten, box: 0, faellig: KW.today(), abschnitt: "Aus Notizen" }); neu++; }
    KW.save("kw-quiz", Q);
    KW.toast(neu + " Karten in FIDELIA Quiz („" + name + "“).", "Öffnen", () => location.href = "../quiz/");
  };
  el.querySelector("#weg").onclick = async () => {
    await A.lernLoeschen(set.id); A.gehe("lernen");
    KW.toast("Gelöscht.", "Rückgängig", async () => { await A.lernSpeichern(set); A.gehe("lernen/" + set.id); });
  };
}

function karteikarten(A, el, set) {
  let reihe = mischen(set.karten.filter(faellig));
  const alle = reihe.length === 0;
  if (alle) reihe = mischen(set.karten); // alles gelernt: freiwillig nochmal
  let i = 0, umgedreht = false, gewusst = 0;
  function zeichnen() {
    if (i >= reihe.length) {
      el.innerHTML = '<div class="empty"><b>🎉 Geschafft!</b>' + gewusst + ' von ' + reihe.length + ' gewusst.<br><br><a class="btn primary" href="#lernen/' + set.id + '">Fertig</a></div>';
      return;
    }
    const k = reihe[i];
    el.innerHTML = '<div class="kopfzeile"><a class="btn small" href="#lernen/' + set.id + '" aria-label="Beenden">✕</a><span class="muted">' + (i + 1) + ' / ' + reihe.length + (alle ? " · Wiederholung" : "") + '</span></div>' +
      '<button type="button" class="karteikarte' + (umgedreht ? " um" : "") + '" id="karte" aria-label="Karte umdrehen"><span class="vorne">' + esc(k.vorne) + '</span><span class="hinten">' + esc(k.hinten) + '</span></button>' +
      (umgedreht ? '<div class="row mittig"><button type="button" class="btn" id="nein">✗ Nochmal</button><button type="button" class="btn primary" id="ja">✓ Gewusst</button></div>' : '<p class="muted mittig">Tippen zum Umdrehen (oder Leertaste)</p>');
    el.querySelector("#karte").onclick = () => { umgedreht = !umgedreht; zeichnen(); };
    if (umgedreht) {
      el.querySelector("#ja").onclick = () => antwort(true);
      el.querySelector("#nein").onclick = () => antwort(false);
    }
  }
  async function antwort(ok) {
    const k = reihe[i];
    if (ok) { gewusst++; k.box = Math.min(4, (k.box || 0) + 1); } else { k.box = 0; reihe.push(k); }
    k.faellig = KW.addDays(KW.today(), ABSTAND[k.box]);
    await A.lernSpeichern(set);
    i++; umgedreht = false; zeichnen();
  }
  function tasten(e) {
    if (e.key === " ") { e.preventDefault(); umgedreht = !umgedreht; zeichnen(); }
    else if (umgedreht && (e.key === "ArrowRight" || e.key === "j")) antwort(true);
    else if (umgedreht && (e.key === "ArrowLeft" || e.key === "n")) antwort(false);
  }
  document.addEventListener("keydown", tasten);
  zeichnen();
  return () => document.removeEventListener("keydown", tasten);
}

function quiz(A, el, set) {
  const fragen = mischen(set.fragen).map(f => {
    const o = mischen(f.optionen.map((t, j) => ({ t, r: j === f.richtig })));
    return { frage: f.frage, optionen: o.map(x => x.t), richtig: o.findIndex(x => x.r) };
  });
  let i = 0, punkte = 0, gewaehlt = -1;
  function zeichnen() {
    if (i >= fragen.length) {
      const neu = punkte > (set.rekord || 0);
      if (neu) { set.rekord = punkte; A.lernSpeichern(set); }
      el.innerHTML = '<div class="empty"><b>' + (punkte === fragen.length ? "🏆 Alles richtig!" : "Ergebnis") + '</b>' + punkte + ' von ' + fragen.length + ' richtig' + (neu ? " – neuer Rekord!" : "") +
        '<br><br><a class="btn" href="#lernen/' + set.id + '/quiz" id="nochmal">Nochmal</a> <a class="btn primary" href="#lernen/' + set.id + '">Fertig</a></div>';
      el.querySelector("#nochmal").onclick = (e) => { e.preventDefault(); A.zeigen(); };
      return;
    }
    const f = fragen[i];
    el.innerHTML = '<div class="kopfzeile"><a class="btn small" href="#lernen/' + set.id + '" aria-label="Beenden">✕</a><span class="muted">Frage ' + (i + 1) + ' / ' + fragen.length + ' · ' + punkte + ' Punkte</span></div>' +
      '<div class="card quiz-frage"><p class="frage">' + esc(f.frage) + '</p>' + f.optionen.map((o, j) => {
        let k = "opt";
        if (gewaehlt >= 0) { if (j === f.richtig) k += " richtig"; else if (j === gewaehlt) k += " falsch"; }
        return '<button type="button" class="' + k + '" data-o="' + j + '"' + (gewaehlt >= 0 ? " disabled" : "") + '><b>' + "ABCD"[j] + '</b> ' + esc(o) + '</button>';
      }).join("") +
      (gewaehlt >= 0 ? '<p class="urteil">' + (gewaehlt === f.richtig ? "✓ Richtig!" : "✗ Leider falsch.") + '</p><button type="button" class="btn primary" id="weiter">Weiter</button>' : "") + '</div>';
    el.querySelectorAll("[data-o]").forEach(b => b.onclick = () => { gewaehlt = Number(b.dataset.o); if (gewaehlt === f.richtig) punkte++; zeichnen(); });
    const w = el.querySelector("#weiter");
    if (w) { w.onclick = () => { i++; gewaehlt = -1; zeichnen(); }; w.focus(); }
  }
  zeichnen();
}
