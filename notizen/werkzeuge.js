// FIDELIA Notizen · Werkzeug-Seitenleiste (überall aufklappbar): Taschenrechner, Aufgaben-Helfer, Wunschnote
// Merkt sich, wo dein Cursor zuletzt war (Heft, Tabelle, Folie), damit „→ einfügen“ genau dort landet.

import * as Rechner from "./rechner.js";
import * as Schule from "./schule.js";
import * as KIH from "./ki-helfer.js";

const KW = window.KW;

const REITER = [["rechner", "🧮 Rechner"], ["hilfe", "💡 Aufgabe"], ["note", "🎯 Wunschnote"]];

export function start(A) {
  if (document.getElementById("wzLeiste")) return;
  const knopf = document.createElement("button");
  knopf.type = "button"; knopf.id = "wzKnopf"; knopf.className = "wz-knopf"; knopf.title = "Werkzeuge: Rechner, Aufgaben-Helfer, Wunschnote (Strg+K)"; knopf.setAttribute("aria-label", "Werkzeuge öffnen"); knopf.setAttribute("aria-expanded", "false");
  knopf.textContent = "🧮";
  const leiste = document.createElement("aside");
  leiste.id = "wzLeiste"; leiste.className = "wz-leiste"; leiste.hidden = true; leiste.setAttribute("aria-label", "Werkzeuge");
  leiste.innerHTML = '<div class="wz-kopf"><div class="wz-reiter" role="tablist">' + REITER.map(r => '<button type="button" role="tab" data-reiter="' + r[0] + '" aria-controls="wz-' + r[0] + '">' + r[1] + '</button>').join("") + '</div><span class="sp"></span><button type="button" class="btn small" id="wzZu" aria-label="Werkzeuge schließen">✕</button></div>' + REITER.map(r => '<div class="wz-inhalt" role="tabpanel" id="wz-' + r[0] + '" hidden></div>').join("");
  document.body.append(knopf, leiste);

  /* Wo war der Cursor zuletzt? */
  let ziel = null, bereich = null, auswahlFeld = null;
  document.addEventListener("focusin", (e) => { if (!leiste.contains(e.target) && e.target !== knopf) ziel = e.target; });
  document.addEventListener("selectionchange", () => {
    const s = getSelection(); if (!s.rangeCount) return;
    const n = s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement);
    if (n && !leiste.contains(n) && n.closest && n.closest("[contenteditable=true]")) { bereich = s.getRangeAt(0).cloneRange(); ziel = n.closest("[contenteditable=true]"); }
  });
  document.addEventListener("focusout", (e) => { const t = e.target; if ((t.tagName === "INPUT" || t.tagName === "TEXTAREA") && !leiste.contains(t)) auswahlFeld = { el: t, a: t.selectionStart, b: t.selectionEnd }; });

  function einfuegen(text, extra = {}) {
    // 1. Textfeld (z. B. Zelle in der Tabelle beim Bearbeiten)
    if (auswahlFeld && document.body.contains(auswahlFeld.el) && (ziel === auswahlFeld.el)) {
      const f = auswahlFeld.el, a = auswahlFeld.a ?? f.value.length, b = auswahlFeld.b ?? a;
      f.focus(); f.setRangeText(text, a, b, "end"); f.dispatchEvent(new Event("input", { bubbles: true }));
      auswahlFeld = { el: f, a: a + text.length, b: a + text.length };
      KW.toast("✓ Eingefügt."); return;
    }
    // 2. Text wie in Word (Heft, Folien-Textfeld)
    if (ziel && document.body.contains(ziel) && ziel.isContentEditable) {
      ziel.focus({ preventScroll: true });
      const s = getSelection();
      if (bereich && ziel.contains(bereich.startContainer)) { s.removeAllRanges(); s.addRange(bereich); }
      if (extra.tabelle) document.execCommand("insertHTML", false, '<table class="tab mit-kopf"><tbody>' + extra.tabelle.map(r => "<tr>" + r.map(c => "<td>" + KW.esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table><p><br></p>");
      else document.execCommand("insertText", false, text);
      KW.toast("✓ Eingefügt."); return;
    }
    // 3. Andere Bereiche (Tabellen-Gitter) dürfen es selbst übernehmen
    const ev = new CustomEvent("fidelia-einfuegen", { detail: { text, ziel, tabelle: extra.tabelle }, cancelable: true });
    window.dispatchEvent(ev);
    if (ev.defaultPrevented) { KW.toast("✓ Eingefügt."); return; }
    // 4. Sonst: in die Zwischenablage
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => KW.toast("In die Zwischenablage kopiert – tipp erst ins Heft, dann wird direkt eingefügt.")).catch(() => KW.toast("Tipp erst ins Heft oder in eine Zelle, dann nochmal."));
  }

  const teile = {};
  const bauen = { rechner: (box) => Rechner.aufbauen(box, { einfuegen }), note: (box) => Schule.wunschnoteAufbauen(box, A),
    hilfe: (box) => KIH.aufgabenHelferAufbauen(box, A, { auswahlText: () => (bereich && bereich.toString().trim()) || (auswahlFeld && document.body.contains(auswahlFeld.el) ? auswahlFeld.el.value.slice(auswahlFeld.a, auswahlFeld.b).trim() : "") }) };
  let reiter = KW.load("kw-werkzeuge-reiter", "rechner");
  if (!bauen[reiter]) reiter = "rechner";
  function reiterZeigen(id, fokus) {
    reiter = id; KW.save("kw-werkzeuge-reiter", id);
    leiste.querySelectorAll("[data-reiter]").forEach(b => { const an = b.dataset.reiter === id; b.classList.toggle("an", an); b.setAttribute("aria-selected", an); b.tabIndex = an ? 0 : -1; });
    leiste.querySelectorAll(".wz-inhalt").forEach(p => { p.hidden = p.id !== "wz-" + id; });
    if (!teile[id]) teile[id] = bauen[id](leiste.querySelector("#wz-" + id));
    if (fokus) setTimeout(() => teile[id].fokus && teile[id].fokus(), 30);
  }
  leiste.querySelectorAll("[data-reiter]").forEach(b => b.onclick = () => reiterZeigen(b.dataset.reiter, true));
  reiterZeigen(reiter, false);
  const auf = (an) => {
    leiste.hidden = !an; knopf.setAttribute("aria-expanded", an); document.body.classList.toggle("wz-offen", an);
    knopf.classList.toggle("an", an);
    if (an) reiterZeigen(reiter, true);
    KW.save("kw-werkzeuge-offen", an);
  };
  knopf.onclick = () => auf(leiste.hidden);
  leiste.querySelector("#wzZu").onclick = () => auf(false);
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); auf(leiste.hidden); }
    else if (e.key === "Escape" && !leiste.hidden && leiste.contains(document.activeElement) && !leiste.querySelector(".re-menue:not([hidden])")) auf(false);
  });
  // Knöpfe in der Leiste nehmen dem Heft nicht den Cursor weg (außer Eingabefelder in Menüs)
  leiste.addEventListener("mousedown", (e) => { if (e.target.closest("button") && e.target.closest(".re") && !e.target.closest(".re-menue")) { e.preventDefault(); leiste.querySelector(".re").focus({ preventScroll: true }); } });
  if (KW.load("kw-werkzeuge-offen", false) && window.innerWidth >= 1100) auf(true);
}
