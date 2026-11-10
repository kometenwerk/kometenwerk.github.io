// FIDELIA Notizen · Schul-Helfer: Klassenarbeits-Modus (Lernplan), „Jetzt“-Anzeige, Wunschnote,
// Hausaufgaben aus Fotos erkennen, Lern-Statistik mit Lern-Serie.
// Die reinen Rechen-Teile (ohne Browser) stehen oben und werden mit node getestet.

/* ---------- Reine Rechnungen ---------- */

const TAGE = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const plusTage = (datum, n) => { const [j, m, t] = datum.split("-").map(Number); return ymd(new Date(j, m - 1, t + n)); };
export const tageBis = (von, bis) => { const a = von.split("-").map(Number), b = bis.split("-").map(Number); return Math.round((new Date(b[0], b[1] - 1, b[2]) - new Date(a[0], a[1] - 1, a[2])) / 864e5); };

// Lernplan bis zur Arbeit: Heftseiten auf die Tage verteilen, jeden Tag Karten üben, am Tag davor Probetest
// seiten: [{ id, titel }], sets: [{ id, titel, karten: n }], heute/datum: "JJJJ-MM-TT"
export function lernplanBauen({ heute, datum, seiten, sets, fach }) {
  const tage = Math.max(0, tageBis(heute, datum));
  if (tage <= 0) return [{ datum: heute, aufgaben: [{ text: "Viel Erfolg heute! Kurz nochmal die wichtigsten Punkte anschauen.", art: "tipp" }] }];
  const lernTage = Math.max(1, tage - 1), plan = [];
  for (let i = 0; i < tage; i++) plan.push({ datum: plusTage(heute, i), aufgaben: [] });
  // Seiten gleichmäßig verteilen (aber nicht auf den letzten Tag)
  seiten.forEach((s, i) => { const t = Math.min(lernTage - 1, Math.floor(i * lernTage / Math.max(1, seiten.length))); plan[t].aufgaben.push({ text: "„" + (s.titel || "Seite") + "“ durcharbeiten", art: "seite", ziel: s.id }); });
  if (!seiten.length) plan[0].aufgaben.push({ text: "Heft und Arbeitsblätter zu " + (fach || "dem Thema") + " zusammensuchen (scannen, falls nötig)", art: "tipp" });
  // Karten
  const set = sets[0];
  if (!set) plan[0].aufgaben.push({ text: "Lernkarten aus deinen Seiten machen", art: "karten-machen" });
  for (let i = set ? 0 : 1; i < tage; i++) if (set || i > 0) plan[i].aufgaben.push({ text: "10 Minuten Lernkarten üben", art: "karten", ziel: set ? set.id : null });
  // Tag vor der Arbeit
  const letzter = plan[tage - 1];
  letzter.aufgaben.push({ text: "Probetest machen", art: "quiz", ziel: set ? set.id : null });
  if (tage > 1) letzter.aufgaben.push({ text: "Fehler vom Probetest nochmal anschauen, früh schlafen 😴", art: "tipp" });
  plan.forEach((t, i) => t.aufgaben.forEach((a, j) => { a.id = t.datum + "-" + j; }));
  return plan;
}

// Deutsche Noten mit Tendenz: „2-“ = 2,3 · „2+“ = 1,7 · „2,5“ = 2,5
export function note(text) {
  const t = String(text).trim().replace(",", ".");
  const m = /^([1-6])([+-]?)$/.exec(t);
  if (m) return Number(m[1]) + (m[2] === "-" ? 0.3 : m[2] === "+" ? -0.3 : 0);
  const z = Number(t); return z >= 0.7 && z <= 6 ? z : null;
}
// Welche Note brauche ich in der nächsten Arbeit? noten: [{ wert, gewicht }], ziel: Durchschnitt, gewichtNeu: Gewicht der nächsten Note
export function wunschnote(noten, ziel, gewichtNeu = 1) {
  const sw = noten.reduce((s, n) => s + n.gewicht, 0), sn = noten.reduce((s, n) => s + n.wert * n.gewicht, 0);
  const jetzt = sw ? sn / sw : null;
  const noetig = (ziel * (sw + gewichtNeu) - sn) / gewichtNeu;
  return { jetzt, noetig, moeglich: noetig >= 1, sicher: noetig >= 6 };
}

// Hausaufgabe in einem Text (z. B. Tafelfoto) finden: „bis Montag S. 45 Nr. 3“
export function hausaufgabenErkennen(text, heute = ymd(new Date())) {
  const t = String(text || "").replace(/\s+/g, " ");
  if (!t.trim()) return null;
  const liste = String.raw`\d+[a-z]?(?!\d)(?:\s*(?:,|und|\+|-|bis)\s*\d+[a-z]?(?!\d|\.\d))*`;
  const was = new RegExp("(" + [
    String.raw`(?:\bBuch\s*)?\bS(?:eite\b|\.)\s*\d+[^.!\n]{0,40}?(?:\bNr\.?|\bAufgaben?\b|\bA\.?)\s*` + liste,
    String.raw`\bAB\b\s*\d*[^.!\n]{0,30}`,
    String.raw`\bArbeitsblatt[^.!\n]{0,40}`,
    String.raw`(?:\bNr\.?|\bAufgaben?\b)\s*` + liste + String.raw`(?:\s*(?:auf|S\.)\s*S?\.?\s*\d+)?`
  ].join("|") + ")", "i").exec(t);
  const haWort = /(hausaufgabe|hausaufgaben|\bha\b|bis\s+(?:zum\s+)?(?:montag|dienstag|mittwoch|donnerstag|freitag|morgen|übermorgen|\d{1,2}\.\d{1,2}))/i.test(t);
  if (!was && !haWort) return null;
  let datum = null;
  const tagM = /bis\s+(?:zum\s+|nächsten\s+|kommenden\s+)?(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|morgen|übermorgen)/i.exec(t);
  const datM = /(?:bis|zum|am)\s+(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?/i.exec(t);
  if (tagM) {
    const w = tagM[1].toLowerCase();
    if (w === "morgen") datum = plusTage(heute, 1); else if (w === "übermorgen") datum = plusTage(heute, 2);
    else { const ziel = TAGE.indexOf(w), [j, m, d] = heute.split("-").map(Number), wd = new Date(j, m - 1, d).getDay(); datum = plusTage(heute, ((ziel - wd + 7) % 7) || 7); }
  } else if (datM) {
    const [j0] = heute.split("-").map(Number); let j = datM[3] ? Number(datM[3]) : j0; if (j < 100) j += 2000;
    datum = j + "-" + String(datM[2]).padStart(2, "0") + "-" + String(datM[1]).padStart(2, "0");
    if (!datM[3] && datum < heute) datum = (j + 1) + datum.slice(4);
  }
  const titel = was ? was[1].trim().replace(/\s+/g, " ").replace(/[,;:]$/, "") : (/(?:hausaufgaben?|ha)\s*:?\s*([^.!\n]{4,80})/i.exec(t) || [])[1];
  if (!titel) return null;
  return { titel: titel.trim().slice(0, 100), datum };
}

// Lern-Serie: wie viele Tage am Stück (bis heute oder gestern) wurde gelernt? zeiten: { "JJJJ-MM-TT": { fach: minuten } }
export function serie(zeiten, heute = ymd(new Date())) {
  const gelernt = (d) => Object.values(zeiten[d] || {}).reduce((a, b) => a + b, 0) >= 5;
  let d = gelernt(heute) ? heute : plusTage(heute, -1), n = 0;
  while (gelernt(d)) { n++; d = plusTage(d, -1); }
  return n;
}
export function woche(zeiten, heute = ymd(new Date())) {
  const proFach = {}, proTag = [];
  for (let i = 6; i >= 0; i--) { const d = plusTage(heute, -i), z = zeiten[d] || {}; let summe = 0; for (const [f, m] of Object.entries(z)) { proFach[f] = (proFach[f] || 0) + m; summe += m; } proTag.push({ datum: d, minuten: summe }); }
  return { proFach, proTag, gesamt: proTag.reduce((a, b) => a + b.minuten, 0) };
}

// Übliche Schulstunden (Beginn/Ende) – wird genommen, wenn im Planer keine Zeiten stehen
export const STUNDEN = [["07:45", "08:30"], ["08:35", "09:20"], ["09:40", "10:25"], ["10:30", "11:15"], ["11:35", "12:20"], ["12:25", "13:10"], ["13:30", "14:15"], ["14:15", "15:00"], ["15:05", "15:50"], ["15:50", "16:35"]];
export function jetztStunde(stunden, uhr) {
  // stunden: [{ stunde, fach }] von heute; uhr: "HH:MM"
  for (const st of stunden) { const z = STUNDEN[st.stunde - 1]; if (z && uhr >= z[0] && uhr < z[1]) return { ...st, bis: z[1], jetzt: true }; }
  for (const st of stunden) { const z = STUNDEN[st.stunde - 1]; if (z && uhr < z[0]) return { ...st, ab: z[0], jetzt: false }; }
  return null;
}

/* ---------- Im Browser ---------- */

const KWb = () => window.KW;
const uhrJetzt = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };

// Lernzeit: { "JJJJ-MM-TT": { fach: minuten } } – nur die letzten 60 Tage werden behalten
export const lernzeiten = () => KWb().load("kw-lernzeit", {});
export function lernzeitPlus(fach, minuten = 1) {
  const z = lernzeiten(), d = ymd(new Date()), f = fach || "Ohne Fach";
  z[d] = z[d] || {}; z[d][f] = (z[d][f] || 0) + minuten;
  const grenze = plusTage(d, -60);
  for (const k of Object.keys(z)) if (k < grenze) delete z[k];
  KWb().save("kw-lernzeit", z);
}

// Kachel „Jetzt“ für die Startseite: welche Stunde läuft / kommt als Nächstes
export function jetztKachel(A, stundenHeute) {
  const esc = A.esc, j = jetztStunde(stundenHeute, uhrJetzt());
  if (!j) return "";
  const hatOrdner = A.einst.faecher.some(f => f.name === j.fach);
  return '<section class="card kachel jetzt-kachel" style="--f:' + esc(A.fachFarbe(j.fach)) + '"><h3>' + (j.jetzt ? "🔴 Jetzt" : "⏭️ Gleich") + '</h3>' +
    '<div class="jetzt-fach">' + esc(j.fach) + '</div><p class="muted">' + j.stunde + '. Stunde · ' + (j.jetzt ? "bis " + j.bis : "ab " + j.ab) + (j.raum ? " · " + esc(j.raum) : "") + '</p>' +
    '<div class="row">' + (hatOrdner ? '<a class="btn small" href="#heft/' + encodeURIComponent(j.fach) + '">📓 Ordner</a><button type="button" class="btn small primary" data-jetzt-seite="' + esc(j.fach) + '">✏️ Neue Seite</button>' : "") + '</div></section>';
}

// Kachel Lern-Statistik: Serie + Balken der letzten 7 Tage
export function statistikKachel(A) {
  const z = lernzeiten(), w = woche(z), s = serie(z), esc = A.esc;
  if (!w.gesamt && !s) return "";
  const max = Math.max(30, ...w.proTag.map(t => t.minuten));
  const tagKurz = (d) => ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(d + "T12:00").getDay()];
  const faecher = Object.entries(w.proFach).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return '<section class="card kachel statistik-kachel"><h3>📈 Deine Lernwoche</h3>' +
    '<div class="serie">' + (s ? "🔥 <b>" + s + (s === 1 ? " Tag" : " Tage") + "</b> am Stück gelernt" : "Lern heute 5 Minuten – dann startet deine Serie 🔥") + '</div>' +
    '<div class="lw-balken" role="img" aria-label="Lernminuten der letzten 7 Tage: ' + w.proTag.map(t => tagKurz(t.datum) + " " + t.minuten).join(", ") + '">' +
    w.proTag.map(t => '<span class="b"><i style="height:' + Math.round(t.minuten / max * 100) + '%"></i><small>' + tagKurz(t.datum) + '</small></span>').join("") + '</div>' +
    '<p class="muted klein">' + w.gesamt + ' Minuten diese Woche' + (faecher.length ? " · " + faecher.map(([f, m]) => esc(f) + " " + m).join(" · ") : "") + '</p></section>';
}

/* --- Klassenarbeits-Modus: #arbeit/<id> --- */
export function arbeitSeite(A, el, id, Planer) {
  const KW = KWb(), esc = A.esc, D = Planer.daten();
  const t = D.eintraege.find(e => e.id === id && e.typ === "test");
  if (!t) { el.innerHTML = '<div class="empty"><b>Diese Arbeit gibt es nicht mehr</b><a class="btn" href="#start">Zum Start</a></div>'; return; }
  const key = "kw-arbeit-" + id, M = KW.load(key, {});
  const heute = ymd(new Date());
  if (!M.start || M.datum !== t.datum) { M.start = heute; M.datum = t.datum; M.ok = M.ok || {}; KW.save(key, M); }
  const seiten = A.aktiv().filter(s => t.fach && s.fach === t.fach).sort((a, b) => String(a.erstellt).localeCompare(String(b.erstellt))).slice(-12);
  const sets = A.lern.filter(s => t.fach && s.fach === t.fach);
  const plan = lernplanBauen({ heute: M.start, datum: t.datum, seiten: seiten.map(s => ({ id: s.id, titel: s.titel })), sets, fach: t.fach });
  const n = tageBis(heute, t.datum);
  const ziel = (a) => a.art === "seite" ? "#seite/" + a.ziel : a.art === "karten" && a.ziel ? "#lernen/" + a.ziel + "/karten" : a.art === "quiz" && a.ziel ? "#lernen/" + a.ziel + "/quiz" : a.art === "karten-machen" || a.art === "karten" || a.art === "quiz" ? "#lernen" : "";
  function zeichnen() {
    const alle = plan.flatMap(p => p.aufgaben), fertig = alle.filter(a => M.ok[a.id]).length;
    let h = '<div class="kopfzeile"><a class="btn small" href="#start" aria-label="Zurück">←</a><h2 class="titel">✏️ ' + esc(t.fach ? t.fach + ": " : "") + esc(t.titel) + '</h2></div>' +
      '<div class="arbeit-kopf card" style="--f:' + esc(A.fachFarbe(t.fach)) + '"><div class="gross-zahl">' + (n < 0 ? "Vorbei" : n === 0 ? "Heute" : n + (n === 1 ? " Tag" : " Tage")) + '</div>' +
      '<div><b>' + KW.parse(t.datum).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) + '</b><div class="fortschritt" role="progressbar" aria-valuemin="0" aria-valuemax="' + alle.length + '" aria-valuenow="' + fertig + '"><i style="width:' + (alle.length ? Math.round(fertig / alle.length * 100) : 0) + '%"></i></div>' +
      '<small class="muted">' + fertig + ' von ' + alle.length + ' Schritten erledigt</small></div></div>';
    if (!t.fach) h += '<p class="muted">Tipp: Gib der Arbeit im Planer ein Fach – dann kommen deine Heftseiten und Lernkarten automatisch in den Plan.</p>';
    h += '<ol class="lernplan">' + plan.map(p => {
      const vorbei = p.datum < heute, istHeute = p.datum === heute;
      return '<li class="lp-tag' + (istHeute ? " heute" : "") + (vorbei ? " vorbei" : "") + '"><h3>' + (istHeute ? "Heute" : KW.parse(p.datum).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" })) + '</h3><ul>' +
        p.aufgaben.map(a => { const z = ziel(a); return '<li><label><input type="checkbox" data-a="' + a.id + '"' + (M.ok[a.id] ? " checked" : "") + '><span>' + esc(a.text) + '</span></label>' + (z ? '<a class="btn small" href="' + z + '">Los</a>' : "") + '</li>'; }).join("") + '</ul></li>';
    }).join("") + '</ol>' +
      '<div class="row"><button type="button" class="btn" id="neuPlan">🔄 Plan ab heute neu verteilen</button></div>';
    el.innerHTML = h;
    el.querySelectorAll("[data-a]").forEach(c => c.onchange = () => { M.ok[c.dataset.a] = c.checked; KW.save(key, M); if (c.checked && plan.flatMap(p => p.aufgaben).every(a => M.ok[a.id])) KW.toast("🎉 Alles geschafft – du bist bereit!"); zeichnen(); });
    el.querySelector("#neuPlan").onclick = () => { KW.save(key, { start: heute, datum: t.datum, ok: {} }); arbeitSeite(A, el, id, Planer); };
  }
  zeichnen();
}

/* --- Wunschnote (Reiter in der Werkzeug-Leiste) --- */
export function wunschnoteAufbauen(box, A) {
  const KW = KWb(), esc = KW.esc;
  const N = KW.load("kw-noten", {}); // { fach: [{ text, wert, gewicht }] }
  let fach = KW.load("kw-noten-fach", "") || (A.einst.faecher[0] || {}).name || "";
  function zeichnen() {
    const liste = N[fach] || [];
    const zielEl = box.querySelector("#wnZiel"), gwEl = box.querySelector("#wnGw");
    const zielAlt = zielEl ? zielEl.value : "2", gwAlt = gwEl ? gwEl.value : "2";
    box.innerHTML = '<div class="wn">' +
      '<label class="field"><span>Fach</span><select class="inp" id="wnFach">' + A.einst.faecher.map(f => '<option' + (f.name === fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></label>' +
      '<div class="wn-noten">' + (liste.length ? liste.map((n, i) => '<span class="wn-note" title="' + (n.gewicht === 2 ? "Arbeit (zählt doppelt)" : "Kleine Note") + '">' + esc(n.text) + (n.gewicht === 2 ? "<sup>×2</sup>" : "") + '<button type="button" data-weg="' + i + '" aria-label="Note ' + esc(n.text) + ' löschen">✕</button></span>').join("") : '<span class="muted klein">Noch keine Noten in diesem Fach.</span>') + '</div>' +
      '<div class="row wn-neu"><input class="inp" id="wnNote" placeholder="z. B. 2-" maxlength="4" aria-label="Neue Note"><select class="inp" id="wnArt" aria-label="Art der Note"><option value="2">Arbeit ×2</option><option value="1">Klein ×1</option></select><button type="button" class="btn small" id="wnPlus">+ Note</button></div>' +
      '<label class="field"><span>Welchen Schnitt willst du?</span><input class="inp" id="wnZiel" inputmode="decimal" value="' + esc(zielAlt) + '"></label>' +
      '<label class="field"><span>Die nächste Note ist …</span><select class="inp" id="wnGw"><option value="2"' + (gwAlt === "2" ? " selected" : "") + '>eine Arbeit (×2)</option><option value="1"' + (gwAlt === "1" ? " selected" : "") + '>eine kleine Note (×1)</option></select></label>' +
      '<div class="wn-ergebnis" id="wnErg" aria-live="polite"></div>' +
      '<p class="muted klein">Jede Schule rechnet etwas anders – frag deine Lehrkraft, wie sie gewichtet.</p></div>';
    const q = (s) => box.querySelector(s);
    q("#wnFach").onchange = () => { fach = q("#wnFach").value; KW.save("kw-noten-fach", fach); zeichnen(); };
    q("#wnPlus").onclick = () => {
      const w = note(q("#wnNote").value); if (w == null) { KW.toast("Gib eine Note wie 2, 2- oder 2,5 ein."); return; }
      (N[fach] = N[fach] || []).push({ text: q("#wnNote").value.trim(), wert: w, gewicht: Number(q("#wnArt").value) }); KW.save("kw-noten", N); zeichnen(); box.querySelector("#wnNote").focus();
    };
    q("#wnNote").onkeydown = (e) => { if (e.key === "Enter") q("#wnPlus").click(); };
    box.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { N[fach].splice(Number(b.dataset.weg), 1); KW.save("kw-noten", N); zeichnen(); });
    const rechnen = () => {
      const ziel = note(q("#wnZiel").value), erg = q("#wnErg");
      if (!liste.length) { erg.innerHTML = '<span class="muted">Trag erst deine Noten ein.</span>'; return; }
      const r = wunschnote(liste, ziel || 2, Number(q("#wnGw").value)), f = (x) => x.toFixed(2).replace(".", ",");
      let t = 'Jetzt: <b>' + f(r.jetzt) + '</b><br>';
      if (!ziel) t += "Gib einen Wunsch-Schnitt ein.";
      else if (r.sicher) t += "🎉 Den Schnitt " + f(ziel) + " hast du sicher – egal, was kommt.";
      else if (!r.moeglich) { const gw = Number(q("#wnGw").value), best = (liste.reduce((s, n) => s + n.wert * n.gewicht, 0) + gw) / (liste.reduce((s, n) => s + n.gewicht, 0) + gw); t += "😬 " + f(ziel) + " schaffst du mit einer Note nicht mehr. Mit einer 1 kämst du auf <b>" + f(best) + "</b>."; }
      else t += "Für " + f(ziel) + " brauchst du mindestens eine <b class=\"gross\">" + f(Math.floor(r.noetig * 10) / 10) + "</b>";
      erg.innerHTML = t;
    };
    q("#wnZiel").oninput = rechnen; q("#wnGw").onchange = rechnen; rechnen();
  }
  if (!A.einst.faecher.length) { box.innerHTML = '<p class="muted">Leg erst Fächer an (⚙️ Einstellungen).</p>'; return { fokus() {} }; }
  if (!A.einst.faecher.some(f => f.name === fach)) fach = A.einst.faecher[0].name;
  zeichnen();
  return { fokus: () => { const n = box.querySelector("#wnNote"); n && n.focus(); } };
}
