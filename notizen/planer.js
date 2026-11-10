// FIDELIA Notizen · Planer-Verbindung
// Liest und schreibt direkt in den FIDELIA Planer (gleiches Gerät, gleicher Speicher „kw-planer“).
// Was hier eingetragen wird, steht also auch in der Planer-App – und umgekehrt.
// Gruppenarbeit: danach Knöpfe für ein Treffen in OMNIVIA Events und eine Gruppe im FIDELIA Chat.

import * as Schule from "./schule.js";

const KW = window.KW, esc = KW.esc;
const KEY = "kw-planer";

export function daten() {
  let D = KW.load(KEY, null);
  if (!D || !Array.isArray(D.eintraege)) D = { eintraege: [] };
  if (!D.plan) D.plan = { stunden: 8, zellen: {} };
  return D;
}
function speichern(D) { KW.save(KEY, D); }

// Stundenplan für einen Tag: Liste von { stunde, fach, raum }
export function stundenFuer(D, datum) {
  const wd = KW.parse(datum).getDay(), out = [];
  if (wd === 0 || wd === 6) return out;
  for (let s = 1; s <= (D.plan.stunden || 8); s++) { const z = D.plan.zellen[wd + "-" + s]; if (z && z.fach) out.push({ stunde: s, fach: z.fach, raum: z.raum || "" }); }
  return out;
}

// Wann ist das Fach das nächste Mal? (für „Bis wann?“)
export function naechsteStunde(D, fach) {
  if (fach) for (let i = 1; i <= 14; i++) { const t = KW.addDays(KW.today(), i); if (stundenFuer(D, t).some(z => z.fach === fach)) return t; }
  return KW.addDays(KW.today(), 1);
}

export const offen = (D) => D.eintraege.filter(e => !e.erledigt && e.typ === "hausaufgabe").sort((a, b) => a.datum.localeCompare(b.datum));
export const arbeiten = (D) => D.eintraege.filter(e => e.typ === "test" && e.datum >= KW.today()).sort((a, b) => a.datum.localeCompare(b.datum));

function tageText(datum) {
  const n = KW.days(KW.today(), datum);
  if (n < 0) return "überfällig";
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  return "in " + n + " Tagen";
}

export function eintragZeile(A, e) {
  const n = KW.days(KW.today(), e.datum);
  return '<li class="ha' + (n < 0 ? " ueber" : n <= 1 ? " bald" : "") + '"><label><input type="checkbox" data-ok="' + esc(e.id) + '"' + (e.erledigt ? " checked" : "") + '>' +
    '<span class="punkt" style="background:' + esc(A.fachFarbe(e.fach)) + '"></span><span class="ha-text">' + (e.fach ? '<b>' + esc(e.fach) + ':</b> ' : "") + esc(e.titel) +
    '<small>' + tageText(e.datum) + ' · ' + KW.parse(e.datum).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" }) + '</small></span></label>' +
    (e.gruppe ? '<span class="gruppe-knoepfe"><a class="btn small" href="../events/" data-kopie="' + esc(e.titel) + '" title="Treffen planen">🎉</a><a class="btn small" href="../chat/" title="Gruppe im Chat">💬</a></span>' : "") + '</li>';
}

export function abhakenBinden(A, el, nachher) {
  el.querySelectorAll("[data-ok]").forEach(c => c.onchange = () => {
    const D = daten(), e = D.eintraege.find(x => x.id === c.dataset.ok);
    if (!e) return;
    e.erledigt = c.checked; speichern(D);
    if (c.checked) KW.toast("Erledigt ✓", "Rückgängig", () => { const D2 = daten(), e2 = D2.eintraege.find(x => x.id === e.id); if (e2) { e2.erledigt = false; speichern(D2); } nachher && nachher(); });
    nachher && setTimeout(nachher, 350);
  });
  el.querySelectorAll("[data-kopie]").forEach(a => a.onclick = () => { try { navigator.clipboard.writeText(a.dataset.kopie.replace(/^👥\s*/, "")); KW.toast("Titel kopiert – in Events einfügen."); } catch (e) {} });
}

export function zeigen(A, el) {
  const F = A.einst.f.planer;
  function zeichnen() {
    const D = daten(), heute = KW.today();
    let h = '<div class="kopfzeile"><h2 class="titel">📅 Planer</h2><span class="sp"></span><a class="btn small" href="../planer/">Ganzer Planer ↗</a></div>';
    if (F.hausaufgaben) h += '<div class="row knopf-reihe"><button type="button" class="btn primary" data-neu="hausaufgabe">📝 Hausaufgabe</button><button type="button" class="btn" data-neu="test">✏️ Klassenarbeit</button><button type="button" class="btn" data-neu="gruppe">👥 Gruppenarbeit</button></div>';
    if (F.stundenplan) {
      const st = stundenFuer(D, heute);
      h += '<section class="card abschnitt"><h3>Heute</h3>' + (st.length ? Schule.heuteHtml(A, st)
        : '<p class="muted">' + (Object.keys(D.plan.zellen).length ? "Heute keine Schule 🎉" : 'Noch kein Stundenplan. <a href="../planer/">Im Planer eintragen ↗</a>') + '</p>') + '</section>';
    }
    if (F.countdown) {
      const t = arbeiten(D);
      if (t.length) h += '<section class="card abschnitt"><h3>Klassenarbeiten</h3><ul class="countdowns">' + t.slice(0, 5).map(e => {
        const n = KW.days(heute, e.datum);
        return '<li style="--f:' + esc(A.fachFarbe(e.fach)) + '"><span class="zahl">' + (n === 0 ? "Heute" : n) + '</span><span><b>' + esc(e.fach || "") + '</b> ' + esc(e.titel) + '<small>' + (n === 0 ? "Viel Erfolg! 🍀" : n === 1 ? "Morgen!" : "Tage") + '</small></span>' +
          '<a class="btn small" href="#arbeit/' + esc(e.id) + '">Lernplan</a>' + '</li>';
      }).join("") + '</ul></section>';
    }
    const o = offen(D);
    h += '<section class="card abschnitt"><h3>Hausaufgaben</h3>' + (o.length ? '<ul class="ha-liste">' + o.map(e => eintragZeile(A, e)).join("") + '</ul>' : '<p class="muted">Alles erledigt 🎉</p>') + '</section>';
    el.innerHTML = h;
    el.querySelectorAll("[data-neu]").forEach(b => b.onclick = () => eintragen(A, { art: b.dataset.neu, fertig: zeichnen }));
    abhakenBinden(A, el, zeichnen);
  }
  zeichnen();
}

// Dialog zum Eintragen. art: "hausaufgabe" | "test" | "gruppe"
export function eintragen(A, { fach = "", art = "hausaufgabe", titel = "", datum: datumVor = "", fertig } = {}) {
  const D = daten();
  const d = document.createElement("dialog");
  d.className = "sheet";
  const faecher = A.einst.faecher;
  d.innerHTML = '<form class="sheet-in" method="dialog"><h2>Eintragen</h2>' +
    '<div class="tabs" role="radiogroup" aria-label="Art">' + [["hausaufgabe", "📝 Hausaufgabe"], ["test", "✏️ Arbeit/Test"], ["gruppe", "👥 Gruppenarbeit"]].map(a => '<button type="button" role="radio" data-art="' + a[0] + '" aria-selected="' + (a[0] === art) + '" aria-checked="' + (a[0] === art) + '">' + a[1] + '</button>').join("") + '</div>' +
    '<div class="row" style="margin-top:12px"><label class="field"><span>Fach</span><select class="inp" id="pFach"><option value="">Kein Fach</option>' + faecher.map(f => '<option' + (f.name === fach ? " selected" : "") + '>' + esc(f.name) + '</option>').join("") + '</select></label>' +
    '<label class="field"><span>Bis wann?</span><input class="inp" type="date" id="pDatum" required value="' + (datumVor || naechsteStunde(D, fach)) + '"></label></div>' +
    '<label class="field"><span>Was?</span><input class="inp" id="pTitel" maxlength="120" required placeholder="z. B. Buch S. 42 Nr. 3" value="' + esc(titel) + '"></label>' +
    '<div id="pGruppe" hidden><label class="field"><span>Wer ist in deiner Gruppe?</span><input class="inp" id="pWer" maxlength="160" placeholder="z. B. Lea, Tim, Noah"></label>' +
    '<label class="field"><span>Wer bringt was mit? (eine Zeile pro Sache)</span><textarea class="inp" id="pMit" rows="3" placeholder="Plakat – Lea&#10;Kleber – Tim"></textarea></label></div>' +
    '<label class="field"><span>Notiz (freiwillig)</span><input class="inp" id="pNotiz" maxlength="200"></label>' +
    '<p class="muted klein">Landet direkt im FIDELIA Planer.</p>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="pAb">Abbrechen</button><span class="sp"></span><button type="submit" class="btn primary">Eintragen</button></div></form>';
  document.body.appendChild(d);
  const q = (s) => d.querySelector(s);
  function artSetzen(a) {
    art = a;
    d.querySelectorAll("[data-art]").forEach(b => { b.setAttribute("aria-selected", b.dataset.art === a); b.setAttribute("aria-checked", b.dataset.art === a); });
    q("#pGruppe").hidden = a !== "gruppe";
    q("#pTitel").placeholder = a === "test" ? "z. B. Klassenarbeit Bruchrechnung" : a === "gruppe" ? "z. B. Plakat über Vulkane" : "z. B. Buch S. 42 Nr. 3";
  }
  artSetzen(art);
  d.querySelectorAll("[data-art]").forEach(b => b.onclick = () => artSetzen(b.dataset.art));
  q("#pFach").onchange = () => { q("#pDatum").value = naechsteStunde(daten(), q("#pFach").value); };
  q("#pAb").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());
  q("form").addEventListener("submit", (ev) => {
    const t = q("#pTitel").value.trim(), datum = q("#pDatum").value;
    if (!t || !datum) { ev.preventDefault(); return; }
    const D2 = daten();
    let notiz = q("#pNotiz").value.trim();
    const e = { id: KW.id(), erledigt: false, erstellt: new Date().toISOString(), typ: art === "test" ? "test" : "hausaufgabe", fach: q("#pFach").value,
      titel: (art === "gruppe" ? "👥 " : "") + t, datum, zeit: "", notiz: "", quelle: "notizen-" + KW.id() };
    if (art === "gruppe") {
      e.gruppe = true;
      const wer = q("#pWer").value.trim(), mit = q("#pMit").value.trim();
      notiz = [wer ? "Gruppe: " + wer : "", mit ? "Mitbringen: " + mit.split("\n").map(x => x.trim()).filter(Boolean).join(", ") : "", notiz].filter(Boolean).join(" · ");
    }
    e.notiz = notiz.slice(0, 300);
    D2.eintraege.push(e);
    speichern(D2);
    KW.toast((art === "test" ? "Arbeit" : art === "gruppe" ? "Gruppenarbeit" : "Hausaufgabe") + " im Planer eingetragen.");
    if (art === "gruppe") setTimeout(() => gruppeWeiter(e, q("#pMit").value), 50);
    fertig && fertig();
  });
  d.showModal();
  setTimeout(() => q("#pTitel").focus(), 50);
}

// Nach einer Gruppenarbeit: Treffen planen und Gruppe im Chat öffnen (den letzten Klick macht man selbst)
function gruppeWeiter(e, mitbringen) {
  const d = document.createElement("dialog");
  d.className = "sheet";
  const text = e.titel.replace(/^👥\s*/, "") + (mitbringen.trim() ? "\nWer bringt was mit:\n" + mitbringen.trim() : "");
  d.innerHTML = '<div class="sheet-in"><h2>👥 Gruppenarbeit eingetragen!</h2><p>Willst du gleich noch …</p>' +
    '<div class="gross-knoepfe"><a class="btn" href="../events/" id="gEvent">🎉 <span><b>Treffen planen</b><small>in OMNIVIA Events – mit „Wer bringt was mit“. Die Liste ist schon kopiert.</small></span></a>' +
    '<a class="btn" href="../chat/" id="gChat">💬 <span><b>Gruppe im FIDELIA Chat</b><small>Dort auf „Neue Gruppe“ tippen und deine Leute hinzufügen.</small></span></a></div>' +
    '<p class="muted klein">Der Chat ist verschlüsselt – darum legst du die Gruppe selbst an. So bleiben deine Schlüssel sicher.</p>' +
    '<div class="sheet-foot"><button type="button" class="btn" id="gZu">Später</button></div></div>';
  document.body.appendChild(d);
  d.querySelector("#gEvent").onclick = () => { try { navigator.clipboard.writeText(text); } catch (x) {} };
  d.querySelector("#gChat").onclick = () => { try { navigator.clipboard.writeText(e.titel.replace(/^👥\s*/, "")); } catch (x) {} };
  d.querySelector("#gZu").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());
  d.showModal();
}
