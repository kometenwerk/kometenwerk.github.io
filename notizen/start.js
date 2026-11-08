// FIDELIA Notizen · Start (Schul-Cockpit)
// Auf einen Blick: Stundenplan von heute, was morgen fällig ist, nächste Arbeit, Lern-Erinnerung,
// zuletzt bearbeitete Seiten und Schnell-Knöpfe.

import * as Planer from "./planer.js";
import * as Lernen from "./lernen.js";

const KW = window.KW, esc = KW.esc;

export function zeigen(A, el) {
  const an = A.einst.an, P = A.einst.f.planer, D = Planer.daten(), heute = KW.today(), morgen = KW.addDays(heute, 1);
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? "Guten Morgen" : stunde < 17 ? "Hallo" : "Guten Abend";
  let h = '<div class="hallo"><h2>' + gruss + ' 👋</h2><p class="muted">' + new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" }) + '</p></div>';

  h += '<div class="schnell">' +
    '<button type="button" class="schnell-knopf" data-tun="seite"><span>✏️</span>Neue Seite</button>' +
    (an.scanner ? '<a class="schnell-knopf" href="#scanner"><span>📷</span>Scannen</a>' : "") +
    (an.planer && P.hausaufgaben ? '<button type="button" class="schnell-knopf" data-tun="ha"><span>📝</span>Hausaufgabe</button>' : "") +
    (an.audio ? '<a class="schnell-knopf" href="#audio"><span>🎙️</span>Mitschrift</a>' : "") +
    (an.lernen ? '<a class="schnell-knopf" href="#lernen"><span>🧠</span>Lernen</a>' : "") + '</div>';

  h += '<div class="cockpit">';
  if (an.planer) {
    if (P.stundenplan) {
      const st = Planer.stundenFuer(D, heute);
      if (st.length) h += '<section class="card kachel"><h3>Heute</h3><div class="stunden">' + st.map(z => '<span class="stunde" style="--f:' + esc(A.fachFarbe(z.fach)) + '"><small>' + z.stunde + '.</small> ' + esc(z.fach) + '</span>').join("") + '</div></section>';
    }
    const offen = Planer.offen(D);
    const bald = offen.filter(e => e.datum <= morgen);
    if (P.vortag && bald.length) h += '<section class="card kachel wichtig"><h3>⏰ Bis morgen</h3><ul class="ha-liste">' + bald.map(e => Planer.eintragZeile(A, e)).join("") + '</ul></section>';
    const spaeter = offen.filter(e => !P.vortag || e.datum > morgen).slice(0, 5);
    if (spaeter.length) h += '<section class="card kachel"><h3>📝 Hausaufgaben</h3><ul class="ha-liste">' + spaeter.map(e => Planer.eintragZeile(A, e)).join("") + '</ul>' +
      (offen.length > spaeter.length + bald.length ? '<a href="#planer" class="mehr">Alle ansehen →</a>' : "") + '</section>';
    if (!offen.length) h += '<section class="card kachel"><h3>📝 Hausaufgaben</h3><p class="muted">Alles erledigt 🎉</p></section>';
    if (P.countdown) {
      const t = Planer.arbeiten(D)[0];
      if (t) { const n = KW.days(heute, t.datum); h += '<section class="card kachel countdown" style="--f:' + esc(A.fachFarbe(t.fach)) + '"><h3>✏️ Nächste Arbeit</h3><div class="gross-zahl">' + (n === 0 ? "Heute" : n + (n === 1 ? " Tag" : " Tage")) + '</div><p><b>' + esc(t.fach || "") + '</b> ' + esc(t.titel) + '</p></section>'; }
    }
  }
  for (const r of Lernen.erinnerungen(A)) {
    h += '<section class="card kachel" style="--f:' + esc(A.fachFarbe(r.fach)) + '"><h3>🧠 Lernen für ' + esc(r.fach || "die Arbeit") + '</h3><p>' + (r.karten ? r.karten + " Karten warten auf dich." : "Mach aus deinen Heftseiten Karteikarten.") + '</p>' +
      (r.set ? '<a class="btn small primary" href="#lernen/' + r.set.id + '/karten">Jetzt üben</a>' : '<a class="btn small" href="#heft/' + encodeURIComponent(r.fach) + '">Zum ' + esc(r.fach) + '-Ordner</a>') + '</section>';
  }
  const vorschlaege = A.seiten.filter(s => !s.fach && s.vorschlag && s.vorschlag.fach).length;
  if (vorschlaege) h += '<section class="card kachel"><h3>🤖 Sortieren</h3><p>' + vorschlaege + (vorschlaege === 1 ? " Seite wartet" : " Seiten warten") + ' auf dein OK.</p><a class="btn small" href="#heft/*unsortiert">Ansehen</a></section>';
  h += '</div>';

  const letzte = A.seiten.slice().sort((a, b) => String(b.geaendert).localeCompare(String(a.geaendert))).slice(0, 6);
  h += '<h3 class="sec">Zuletzt bearbeitet</h3>' + (letzte.length ? '<div class="zuletzt">' + letzte.map(s =>
    '<a class="card zuletzt-karte" href="#seite/' + s.id + '" style="--f:' + esc(A.fachFarbe(s.fach)) + '"><b>' + esc(s.titel || "Ohne Titel") + '</b><small>' + esc(s.fach || "Unsortiert") + '</small></a>').join("") + '</div>'
    : '<div class="empty"><b>Dein Heft ist noch leer</b>Fang mit „✏️ Neue Seite“ an oder scanne ein Arbeitsblatt.</div>');

  el.innerHTML = h;
  el.querySelectorAll("[data-tun]").forEach(b => b.onclick = async () => {
    if (b.dataset.tun === "ha") { Planer.eintragen(A, { fertig: () => A.zeigen() }); return; }
    const naechstes = Planer.stundenFuer(D, heute).find(z => z.stunde >= Math.max(1, stunde - 7));
    const s = await A.seiteNeu({ titel: "Neue Seite " + new Date().toLocaleDateString("de-DE"), fach: naechstes && A.einst.faecher.some(f => f.name === naechstes.fach) ? naechstes.fach : "" });
    A.gehe("seite/" + s.id);
  });
  Planer.abhakenBinden(A, el, () => A.zeigen());
}
