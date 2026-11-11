// Kometenwerk Code · Code-Editor (Farben, Zeilennummern, Einrücken, Klammern, Vorschläge, Erklärungen)
import * as C from "./code-kern.js";

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export function editor(box, { wert = C.LEER, beiAenderung = () => {}, beiCursor = () => {}, schrift = 15, zusatz = () => [], filter = () => true, beiEingabe = () => {} } = {}) {
  box.classList.add("ed");
  box.innerHTML = '<div class="ed-nr" aria-hidden="true"></div><div class="ed-feld"><pre class="ed-farbe" aria-hidden="true"></pre><textarea class="ed-text" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" aria-label="Arduino-Code"></textarea></div><div class="ed-vor" role="listbox" hidden></div>';
  const ta = box.querySelector(".ed-text"), farbe = box.querySelector(".ed-farbe"), nr = box.querySelector(".ed-nr"), vor = box.querySelector(".ed-vor");
  let basis = [], meldungen = [], vorschlag = null, vAktiv = 0;
  const mischen = () => { const z = zusatz(ta.value) || []; meldungen = [...basis, ...z.filter(m => !basis.some(b => b.z === m.z && b.text === m.text))]; };
  ta.value = wert; box.style.setProperty("--ed-schrift", schrift + "px");

  function malen() {
    farbe.innerHTML = C.faerben(ta.value) + "\n";
    const n = ta.value.split("\n").length, fz = new Map(); meldungen.forEach(m => { if (!fz.has(m.z) || m.art === "fehler") fz.set(m.z, m.art); });
    let h = ""; for (let i = 1; i <= n; i++) h += '<div class="' + (fz.get(i) === "fehler" ? "f" : fz.get(i) ? "h" : "") + '" data-z="' + i + '">' + i + "</div>";
    nr.innerHTML = h; scrollen();
  }
  function scrollen() { farbe.scrollTop = ta.scrollTop; farbe.scrollLeft = ta.scrollLeft; nr.scrollTop = ta.scrollTop; }
  ta.addEventListener("scroll", scrollen);
  const zeileSpalte = () => { const v = ta.value.slice(0, ta.selectionStart).split("\n"); return { z: v.length, sp: v[v.length - 1].length + 1 }; };
  function wortAmCursor() {
    const v = ta.value, i = ta.selectionStart;
    let a = i; while (a > 0 && /[\w.]/.test(v[a - 1])) a--;
    let b = i; while (b < v.length && /\w/.test(v[b])) b++;
    return { a, b, wort: v.slice(a, b), vorher: v.slice(a, i) };
  }
  function cursorMelden() {
    const { z, sp } = zeileSpalte(), w = wortAmCursor().wort;
    beiCursor({ z, sp, erklaerung: C.erklaeren(w) || C.erklaeren(w.split(".").pop()), meldungen: meldungen.filter(m => m.z === z) });
  }
  function einsetzen(text) { ta.focus(); document.execCommand("insertText", false, text); }

  function vorschlagZeigen() {
    const { vorher } = wortAmCursor(), p = vorher.split(".").pop(), punkt = vorher.includes(".");
    const liste = punkt ? (vorher.startsWith("Serial.") ? Object.keys(C.WISSEN).filter(n => n.startsWith("Serial.") && n.slice(7).toLowerCase().startsWith(p.toLowerCase()) && n.slice(7) !== p).map(n => ({ name: n.slice(7), aufbau: C.WISSEN[n][0], info: C.WISSEN[n][1] })) : []) : C.vorschlaege(p, ta.value);
    const liste2 = liste.filter(v => filter(punkt && vorher.startsWith("Serial.") ? "Serial." + v.name : v.name));
    liste.length = 0; liste.push(...liste2);
    if (!liste.length || (!punkt && p.length < 2)) { vor.hidden = true; vorschlag = null; return; }
    vorschlag = liste; vAktiv = Math.min(vAktiv, liste.length - 1);
    vor.innerHTML = liste.map((v, i) => '<button type="button" role="option" aria-selected="' + (i === vAktiv) + '" data-i="' + i + '"><b>' + esc(v.name) + "</b>" + (v.aufbau ? "<code>" + esc(v.aufbau) + "</code>" : "") + (v.info ? "<small>" + esc(v.info) + "</small>" : "") + "</button>").join("");
    const { z, sp } = zeileSpalte(), cs = getComputedStyle(ta), lh = parseFloat(cs.lineHeight) || 22, cw = parseFloat(cs.fontSize) * 0.6;
    vor.style.left = Math.max(4, Math.min(box.clientWidth - 340, nr.offsetWidth + 14 + (sp - 1) * cw - ta.scrollLeft)) + "px";
    let top = 12 + z * lh - ta.scrollTop + 4; if (top + 220 > box.clientHeight) top = Math.max(4, top - lh - 230);
    vor.style.top = top + "px"; vor.hidden = false;
    vor.querySelectorAll("[data-i]").forEach(b => { b.onmousedown = (e) => e.preventDefault(); b.onclick = () => uebernehmen(liste[b.dataset.i]); });
  }
  function uebernehmen(v) {
    const { a, b, vorher } = wortAmCursor(), start = vorher.includes(".") ? a + vorher.lastIndexOf(".") + 1 : a;
    ta.setSelectionRange(start, b);
    const fn = C.WISSEN[v.name] || C.WISSEN["Serial." + v.name];
    if (fn && ta.value[b] !== "(") {
      const semi = /^(pinMode|digitalWrite|delay|tone|noTone|analogWrite|randomSeed|begin|print|println|write)$/.test(v.name);
      einsetzen(v.name + "()" + (semi ? ";" : ""));
      const p = ta.selectionStart - (semi ? 2 : 1); ta.setSelectionRange(p, p);
    } else einsetzen(v.name);
    vor.hidden = true; vorschlag = null; geaendert(false);
  }
  function geaendert(mitVorschlag = true) {
    if (basis.length) basis = C.pruefen(ta.value);
    mischen();
    malen(); beiAenderung(ta.value); if (mitVorschlag) vorschlagZeigen(); cursorMelden();
  }
  ta.addEventListener("keydown", (e) => {
    if (vorschlag && !vor.hidden) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); vAktiv = (vAktiv + (e.key === "ArrowDown" ? 1 : -1) + vorschlag.length) % vorschlag.length; vorschlagZeigen(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); uebernehmen(vorschlag[vAktiv]); return; }
      if (e.key === "Escape") { e.preventDefault(); vor.hidden = true; vorschlag = null; return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      const v = ta.value, a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1, be = v.indexOf("\n", ta.selectionEnd), b = be < 0 ? v.length : be;
      const zeilen = v.slice(a, b).split("\n"), alle = zeilen.every(z => /^\s*\/\//.test(z) || !z.trim());
      const neu = zeilen.map(z => !z.trim() ? z : alle ? z.replace(/^(\s*)\/\/ ?/, "$1") : z.replace(/^(\s*)/, "$1// ")).join("\n");
      ta.setSelectionRange(a, b); einsetzen(neu); ta.setSelectionRange(a, a + neu.length); return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      if (ta.selectionStart !== ta.selectionEnd) {
        const v = ta.value, a = v.lastIndexOf("\n", ta.selectionStart - 1) + 1, b = ta.selectionEnd, blk = v.slice(a, b);
        const neu = e.shiftKey ? blk.replace(/^ {1,2}/gm, "") : blk.replace(/^/gm, "  ");
        ta.setSelectionRange(a, b); einsetzen(neu); ta.setSelectionRange(a, a + neu.length);
      } else einsetzen("  ");
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const v = ta.value, i = ta.selectionStart, zeile = v.slice(v.lastIndexOf("\n", i - 1) + 1, i), einzug = (/^\s*/.exec(zeile) || [""])[0], auf = /\{\s*$/.test(zeile);
      if (auf && v[i] === "}") { einsetzen("\n" + einzug + "  \n" + einzug); const p = i + 1 + einzug.length + 2; ta.setSelectionRange(p, p); }
      else einsetzen("\n" + einzug + (auf ? "  " : ""));
      return;
    }
    if (e.key === "}") { const v = ta.value, i = ta.selectionStart, a = v.lastIndexOf("\n", i - 1) + 1, vt = v.slice(a, i); if (/^\s+$/.test(vt) && vt.length >= 2) { e.preventDefault(); ta.setSelectionRange(i - 2, i); einsetzen("}"); return; } }
    const paare = { "(": ")", "[": "]", '"': '"', "{": "}" };
    if (paare[e.key] && ta.selectionStart === ta.selectionEnd && !e.ctrlKey) {
      const n = ta.value[ta.selectionStart] || "";
      if (e.key === '"' && n === '"') { e.preventDefault(); ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); return; }
      if (!n || /[\s);,\]}]/.test(n)) { e.preventDefault(); const p = ta.selectionStart; einsetzen(e.key + paare[e.key]); ta.setSelectionRange(p + 1, p + 1); geaendert(); return; }
    }
    if ((e.key === ")" || e.key === "]") && ta.value[ta.selectionStart] === e.key) { e.preventDefault(); ta.setSelectionRange(ta.selectionStart + 1, ta.selectionStart + 1); }
  });
  ta.addEventListener("input", (e) => { beiEingabe(e); geaendert(true); });
  ta.addEventListener("paste", (e) => beiEingabe({ inputType: "paste", text: (e.clipboardData && e.clipboardData.getData("text")) || "" }));
  ta.addEventListener("click", () => { vor.hidden = true; cursorMelden(); });
  ta.addEventListener("keyup", (e) => { if (/^Arrow|Home|End|Page/.test(e.key)) cursorMelden(); });
  ta.addEventListener("blur", () => setTimeout(() => { vor.hidden = true; }, 150));
  nr.addEventListener("click", (e) => { const d = e.target.closest("[data-z]"); if (d) api.zuZeile(Number(d.dataset.z)); });

  const api = {
    get wert() { return ta.value; },
    setzen(text) { ta.value = text; basis = []; mischen(); malen(); cursorMelden(); },
    ersetzen(text) { ta.focus(); ta.select(); einsetzen(text); },          // mit Rückgängig
    meldungenSetzen(m) { basis = m; mischen(); malen(); cursorMelden(); },
    neuPruefen() { mischen(); malen(); cursorMelden(); },
    get textfeld() { return ta; },
    zuZeile(z, sp) {
      const v = ta.value.split("\n"); let p = 0; for (let i = 0; i < z - 1 && i < v.length; i++) p += v[i].length + 1;
      const l = v[z - 1] || "", a = p + (sp ? sp - 1 : (/^\s*/.exec(l)[0].length));
      ta.focus(); ta.setSelectionRange(a, sp ? a : p + l.length);
      const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22; ta.scrollTop = Math.max(0, (z - 5) * lh); cursorMelden();
    },
    schrift(px) { box.style.setProperty("--ed-schrift", px + "px"); malen(); },
    fokus() { ta.focus(); }
  };
  mischen(); malen();
  return api;
}
