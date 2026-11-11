// FIDELIA Notizen · Tabellen: bedingte Formatierung und Auswahllisten (Dropdowns) – wie in Excel
import * as F from "./formel.js";

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const REGEL_ARTEN = [["groesser", "größer als"], ["kleiner", "kleiner als"], ["zwischen", "zwischen"], ["gleich", "gleich"], ["enthaelt", "Text enthält"], ["skala", "Farbskala (rot → grün)"], ["balken", "Datenbalken"]];

export function imBereich(bereich, z, s) {
  const [a, b] = String(bereich).split(":"), p = F.zelleLesen(a), q = F.zelleLesen(b || a);
  if (!p || !q) return false;
  return z >= Math.min(p.z, q.z) && z <= Math.max(p.z, q.z) && s >= Math.min(p.s, q.s) && s <= Math.max(p.s, q.s);
}
function zahlenIm(bereich, blattName, rech) {
  const [a, b] = String(bereich).split(":"), p = F.zelleLesen(a), q = F.zelleLesen(b || a), aus = [];
  for (let z = Math.min(p.z, q.z); z <= Math.max(p.z, q.z); z++) for (let s = Math.min(p.s, q.s); s <= Math.max(p.s, q.s); s++) { const v = rech.wert(blattName, F.zelleName(z, s)); if (typeof v === "number") aus.push(v); }
  return aus;
}
const zahl = (v) => typeof v === "number" ? v : Number(String(v).replace(",", "."));
function mischen(a, b, t) { const h = (x) => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); }

// Ergebnis: zusätzliches CSS für die Zelle (oder "")
export function stilFuer(blatt, z, s, wert, rech) {
  let css = "";
  for (const r of blatt.regeln || []) {
    if (!imBereich(r.bereich, z, s)) continue;
    if (r.art === "skala" || r.art === "balken") {
      if (typeof wert !== "number") continue;
      const alle = zahlenIm(r.bereich, blatt.name, rech), min = Math.min(...alle), max = Math.max(...alle), t = max > min ? (wert - min) / (max - min) : 0.5;
      if (r.art === "skala") { const f = r.umkehren ? 1 - t : t; css += "background:" + (f < 0.5 ? mischen("#f8696b", "#ffeb84", f * 2) : mischen("#ffeb84", "#63be7b", (f - 0.5) * 2)) + ";"; }
      else css += "background:linear-gradient(90deg," + (r.farbe || "#9cc3ff") + " " + Math.round(t * 100) + "%,transparent " + Math.round(t * 100) + "%);";
      continue;
    }
    let ok = false; const w = zahl(wert), a = zahl(r.wert), b = zahl(r.wert2);
    if (r.art === "groesser") ok = typeof wert === "number" && w > a;
    else if (r.art === "kleiner") ok = typeof wert === "number" && w < a;
    else if (r.art === "zwischen") ok = typeof wert === "number" && w >= Math.min(a, b) && w <= Math.max(a, b);
    else if (r.art === "gleich") ok = typeof wert === "number" && !isNaN(a) ? w === a : String(wert).toLowerCase() === String(r.wert).toLowerCase();
    else if (r.art === "enthaelt") ok = String(F.anzeigen(wert)).toLowerCase().includes(String(r.wert || "").toLowerCase()) && String(r.wert || "") !== "";
    if (ok) css += (r.farbe ? "background:" + r.farbe + ";" : "") + (r.schrift ? "color:" + r.schrift + ";" : "") + (r.fett ? "font-weight:700;" : "");
  }
  return css;
}
export function auswahlFuer(blatt, z, s) { const a = (blatt.auswahl || []).find(x => imBereich(x.bereich, z, s)); return a ? a.werte : null; }

/* ---------- Fenster ---------- */
export function regelnDialog(blatt, bereichText, fertig) {
  blatt.regeln = blatt.regeln || [];
  const d = document.createElement("dialog"); d.className = "dialog";
  const zeichnen = () => {
    d.innerHTML = "<h3>🎨 Bedingte Formatierung</h3><p class=\"klein muted\">Zellen färben sich von selbst, wenn die Regel stimmt.</p>" +
      (blatt.regeln.length ? '<ul class="regel-liste">' + blatt.regeln.map((r, i) => '<li><span class="regel-farbe" style="background:' + (r.art === "skala" ? "linear-gradient(90deg,#f8696b,#ffeb84,#63be7b)" : esc(r.farbe || "#9cc3ff")) + '"></span><b>' + esc(r.bereich) + "</b> " + esc((REGEL_ARTEN.find(a => a[0] === r.art) || [, r.art])[1]) + (r.wert != null && r.art !== "skala" && r.art !== "balken" ? " " + esc(r.wert) : "") + (r.art === "zwischen" ? " und " + esc(r.wert2) : "") + '<button type="button" class="btn small" data-weg="' + i + '" aria-label="Regel löschen">🗑</button></li>').join("") + "</ul>" : "") +
      '<div class="regel-neu"><label class="klein">Bereich<input class="inp" id="rB" value="' + esc(bereichText) + '"></label>' +
      '<label class="klein">Wenn der Wert<select class="inp" id="rA">' + REGEL_ARTEN.map(a => '<option value="' + a[0] + '">' + a[1] + "</option>").join("") + "</select></label>" +
      '<label class="klein" id="rW1">Wert<input class="inp" id="rW" placeholder="z. B. 4"></label><label class="klein" id="rW2b" hidden>und<input class="inp" id="rW2" placeholder="z. B. 6"></label>' +
      '<label class="klein" id="rFb">Füllung<input type="color" id="rF" value="#ffcdd2"></label><label class="klein" id="rSb">Schrift<input type="color" id="rS" value="#b71c1c"></label></div>' +
      '<div class="zeile" style="justify-content:flex-end;margin-top:10px"><button type="button" class="btn" data-a="zu">Fertig</button><button type="button" class="btn primary" data-a="neu">+ Regel</button></div>';
    const art = d.querySelector("#rA"), upd = () => { const a = art.value; d.querySelector("#rW1").hidden = a === "skala" || a === "balken"; d.querySelector("#rW2b").hidden = a !== "zwischen"; d.querySelector("#rSb").hidden = a === "skala" || a === "balken"; d.querySelector("#rFb").hidden = a === "skala"; };
    art.onchange = upd; upd();
    d.querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { blatt.regeln.splice(Number(b.dataset.weg), 1); fertig(); zeichnen(); });
    d.querySelector('[data-a="neu"]').onclick = () => {
      const bereich = d.querySelector("#rB").value.trim().toUpperCase(), a = art.value;
      if (!/^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(bereich)) { KW.toast("Bereich wie B2:B20 eingeben."); return; }
      const r = { id: KW.id(), bereich, art: a };
      if (a !== "skala" && a !== "balken") { r.wert = d.querySelector("#rW").value.trim(); if (r.wert === "") { KW.toast("Wert eintragen."); return; } r.schrift = d.querySelector("#rS").value; }
      if (a === "zwischen") r.wert2 = d.querySelector("#rW2").value.trim();
      if (a !== "skala") r.farbe = d.querySelector("#rF").value;
      blatt.regeln.push(r); fertig(); zeichnen();
    };
    d.querySelector('[data-a="zu"]').onclick = () => d.close();
  };
  zeichnen(); document.body.appendChild(d); d.showModal(); d.addEventListener("close", () => d.remove());
}
export function auswahlDialog(blatt, bereichText, fertig) {
  blatt.auswahl = blatt.auswahl || [];
  const alt = blatt.auswahl.find(a => a.bereich === bereichText);
  const d = document.createElement("dialog"); d.className = "dialog";
  d.innerHTML = '<h3>▾ Auswahlliste</h3><p class="klein muted">In diesen Zellen kann man dann aus einer Liste wählen (wie in Excel „Datenüberprüfung“).</p>' +
    '<label class="klein">Bereich<input class="inp" id="aB" value="' + esc(bereichText) + '"></label>' +
    '<label class="klein">Einträge (durch Komma getrennt)<input class="inp" id="aW" value="' + esc(alt ? alt.werte.join(", ") : "") + '" placeholder="z. B. erledigt, offen, krank"></label>' +
    (blatt.auswahl.length ? '<p class="klein muted">Schon da: ' + blatt.auswahl.map(a => esc(a.bereich)).join(", ") + "</p>" : "") +
    '<div class="zeile" style="justify-content:flex-end;margin-top:10px">' + (alt ? '<button type="button" class="btn danger" data-a="weg">Entfernen</button>' : "") + '<button type="button" class="btn" data-a="zu">Abbrechen</button><button type="button" class="btn primary" data-a="ok">OK</button></div>';
  document.body.appendChild(d); d.showModal(); d.addEventListener("close", () => d.remove());
  d.querySelector('[data-a="zu"]').onclick = () => d.close();
  const weg = d.querySelector('[data-a="weg"]'); if (weg) weg.onclick = () => { blatt.auswahl = blatt.auswahl.filter(a => a !== alt); fertig(); d.close(); };
  d.querySelector('[data-a="ok"]').onclick = () => {
    const bereich = d.querySelector("#aB").value.trim().toUpperCase(), werte = d.querySelector("#aW").value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
    if (!/^[A-Z]+\d+(:[A-Z]+\d+)?$/.test(bereich)) { KW.toast("Bereich wie C2:C20 eingeben."); return; }
    if (!werte.length) { KW.toast("Mindestens einen Eintrag eingeben."); return; }
    blatt.auswahl = blatt.auswahl.filter(a => a.bereich !== bereich); blatt.auswahl.push({ bereich, werte: [...new Set(werte)].slice(0, 50) });
    fertig(); d.close();
  };
}
