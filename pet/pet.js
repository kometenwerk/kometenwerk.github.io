/* FIDELIA Pet – die Haustier-Akte. Alles bleibt auf dem Gerät (localStorage „kw-pet“). */
(function () {
  "use strict";
  var esc = KW.esc, KEY = "kw-pet", $ = function (id) { return document.getElementById(id); };
  var ARTEN = [["hund", "🐶", "Hund"], ["katze", "🐱", "Katze"], ["kaninchen", "🐰", "Kaninchen"], ["meerschwein", "🐹", "Meerschweinchen"], ["vogel", "🐦", "Vogel"], ["fisch", "🐠", "Fisch"], ["pferd", "🐴", "Pferd"], ["schildkroete", "🐢", "Schildkröte"], ["anderes", "🐾", "Anderes"]];
  var FARBEN = ["#f5e1c8", "#dbeafe", "#dcfce7", "#fce7f3", "#ede9fe", "#fef3c7", "#e0f2fe", "#ffe4e6"];
  // Häufige Impfungen als Vorschlag (keine Empfehlung – das entscheidet der Tierarzt)
  var IMPF = { hund: ["Staupe", "Parvovirose", "Hepatitis (HCC)", "Leptospirose", "Tollwut", "Zwingerhusten"], katze: ["Katzenschnupfen", "Katzenseuche", "Tollwut", "Leukose (FeLV)"], kaninchen: ["RHD 1 + 2 (Chinaseuche)", "Myxomatose"], pferd: ["Tetanus", "Influenza", "Herpes"] };
  var D = KW.load(KEY, null);
  if (!D || !Array.isArray(D.tiere)) D = { tiere: [], aktiv: null };
  function speichern() { KW.save(KEY, D); }
  var reiter = "uebersicht";

  function art(t) { return ARTEN.filter(function (a) { return a[0] === t.art; })[0] || ARTEN[ARTEN.length - 1]; }
  function aktiv() { return D.tiere.filter(function (t) { return t.id === D.aktiv; })[0] || D.tiere[0] || null; }
  function datum(s) { if (!s) return ""; var p = s.split("-"); return p[2] + "." + p[1] + "." + p[0]; }
  function alter(geb) {
    if (!geb) return "";
    var g = KW.parse(geb), h = new Date(), m = (h.getFullYear() - g.getFullYear()) * 12 + h.getMonth() - g.getMonth() - (h.getDate() < g.getDate() ? 1 : 0);
    if (m < 0) return ""; if (m < 1) return "unter 1 Monat"; if (m < 24) return m + (m === 1 ? " Monat" : " Monate");
    return Math.floor(m / 12) + " Jahre";
  }
  function tage(bis) { return KW.days(KW.today(), bis); }
  function bald(bis) { if (!bis) return ""; var t = tage(bis); return t < 0 ? "weg" : t <= 30 ? "bald" : "ok"; }
  function wannText(bis) { var t = tage(bis); return t < 0 ? "seit " + -t + " Tagen überfällig" : t === 0 ? "heute" : t === 1 ? "morgen" : "in " + t + " Tagen"; }
  function bildHtml(t) { return t.foto ? '<img src="' + t.foto + '" alt="">' : esc(art(t)[1]); }

  /* ---------- Anzeige ---------- */
  function zeigen() {
    var a = aktiv();
    $("tiere").innerHTML = D.tiere.map(function (t) { return '<button class="tier-knopf" type="button" data-t="' + t.id + '" aria-pressed="' + (a && a.id === t.id) + '" style="--c:' + t.farbe + '"><span class="bild">' + bildHtml(t) + "</span><small>" + esc(t.name) + "</small></button>"; }).join("") +
      (D.tiere.length ? '<button class="tier-knopf plus" type="button" data-t="neu"><span class="bild">＋</span><small>Neues Tier</small></button>' : "");
    $("tiere").hidden = !D.tiere.length;
    if (!a) {
      $("ansicht").innerHTML = '<div class="hallo"><div class="gross" aria-hidden="true">🐾</div><h2>Die Akte für dein Haustier</h2><p>Impfungen, Gewicht, Medikamente und Tierarzt-Termine an einem Ort – mit Erinnerungen. Alles bleibt auf deinem Gerät.</p><button class="btn primary" type="button" data-a="neu">＋ Erstes Tier anlegen</button></div>';
      return;
    }
    var h = '<div class="card profil" style="--c:' + a.farbe + '"><span class="bild">' + bildHtml(a) + '</span><div class="sp"><h2>' + esc(a.name) + "</h2><p>" + esc(art(a)[2]) + (a.rasse ? " · " + esc(a.rasse) : "") + (a.geb ? " · " + alter(a.geb) : "") + '</p></div><button class="btn small" type="button" data-a="bearbeiten" aria-label="' + esc(a.name) + ' bearbeiten">✏️</button></div>';
    h += '<div class="tabs" role="tablist">' + [["uebersicht", "Übersicht"], ["impf", "💉 Impfungen"], ["gewicht", "⚖️ Gewicht"], ["medi", "💊 Medizin"], ["termine", "🩺 Tierarzt"]].map(function (r) { return '<button type="button" role="tab" data-r="' + r[0] + '" aria-selected="' + (reiter === r[0]) + '">' + r[1] + "</button>"; }).join("") + "</div>";
    h += ({ uebersicht: uebersicht, impf: impfungen, gewicht: gewicht, medi: medizin, termine: termine }[reiter])(a);
    $("ansicht").innerHTML = h;
  }
  function faellige(a) {
    var f = [];
    (a.impf || []).forEach(function (i) { if (i.naechste && tage(i.naechste) <= 30 && !(a.impf || []).some(function (j) { return j !== i && j.name === i.name && j.datum > i.datum; })) f.push({ text: "💉 " + i.name + " auffrischen", bis: i.naechste }); });
    (a.termine || []).forEach(function (t) { if (t.datum >= KW.today() && tage(t.datum) <= 14) f.push({ text: "🩺 " + (t.grund || "Tierarzt-Termin") + (t.uhr ? " um " + t.uhr : ""), bis: t.datum }); });
    (a.medi || []).forEach(function (m) { if (!m.bis || m.bis >= KW.today()) f.push({ text: "💊 " + m.name + (m.dosis ? " – " + m.dosis : "") + (m.wie ? " (" + m.wie + ")" : ""), bis: null, medi: true }); });
    return f.sort(function (x, y) { return (x.bis || "9") < (y.bis || "9") ? -1 : 1; });
  }
  function uebersicht(a) {
    var f = faellige(a), w = (a.gewicht || []).slice().sort(function (x, y) { return x.datum < y.datum ? -1 : 1; }), lw = w[w.length - 1];
    var h = '<h2 class="sec">Was ansteht</h2>' + (f.length ? f.map(function (x) { return '<div class="card faellig' + (x.bis && tage(x.bis) < 0 ? " rot" : "") + '"><b>' + esc(x.text) + "</b><small>" + (x.medi ? "läuft gerade" : datum(x.bis) + " · " + wannText(x.bis)) + "</small></div>"; }).join("") : '<div class="card faellig" style="border-left-color:var(--good)"><b>✅ Gerade steht nichts an</b><small>Neue Impfungen und Termine trägst du in den Reitern oben ein.</small></div>');
    h += '<div class="kacheln"><div class="card kachel"><small>Geburtstag</small><b>' + (a.geb ? datum(a.geb) : "–") + '</b></div><div class="card kachel"><small>Gewicht</small><b>' + (lw ? esc(String(lw.kg).replace(".", ",")) + " kg" : "–") + '</b></div><div class="card kachel"><small>Chip-Nummer</small><b>' + esc(a.chip || "–") + '</b></div><div class="card kachel"><small>Tierarzt</small><b>' + esc(a.arzt || "–") + "</b>" + (a.arztTel ? '<br><a href="tel:' + esc(a.arztTel.replace(/[^0-9+]/g, "")) + '">📞 ' + esc(a.arztTel) + "</a>" : "") + "</div></div>";
    if (a.allergien || a.futter) h += '<div class="card kachel" style="margin-top:10px">' + (a.allergien ? "<small>⚠️ Allergien / Unverträglichkeiten</small><b>" + esc(a.allergien) + "</b>" : "") + (a.futter ? '<small style="margin-top:6px">🥣 Futter</small><b>' + esc(a.futter) + "</b>" : "") + "</div>";
    h += '<div class="oben"><button class="btn primary" type="button" data-a="akte">📋 Akte für den Tierarzt</button><button class="btn" type="button" data-a="ics">📅 Erinnerungen in meinen Kalender</button></div>';
    return h;
  }
  function liste(arr, zeile, leer) { return arr.length ? '<div class="liste">' + arr.map(zeile).join("") + "</div>" : '<div class="empty"><b>' + leer[0] + "</b>" + leer[1] + "</div>"; }
  function impfungen(a) {
    var l = (a.impf || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; });
    return '<div class="oben"><span class="muted klein">Trag jede Impfung mit Datum ein – auf Wunsch mit Erinnerung.</span><button class="btn primary small" type="button" data-a="impf">＋ Impfung</button></div>' +
      liste(l, function (i) { var b = bald(i.naechste); return '<button class="eintrag" type="button" data-e="impf" data-id="' + i.id + '"><span class="i">💉</span><span class="mitte"><b>' + esc(i.name) + "</b><small>" + datum(i.datum) + (i.charge ? " · Charge " + esc(i.charge) : "") + '</small></span><span class="rechts">' + (i.naechste ? '<span class="punkt ' + b + '"></span>nächste ' + datum(i.naechste) : "") + "</span></button>"; }, ["Noch keine Impfungen", "Tipp auf „＋ Impfung“ oder schau in den Impfpass."]);
  }
  function gewicht(a) {
    var l = (a.gewicht || []).slice().sort(function (x, y) { return x.datum < y.datum ? -1 : 1; }), h = '<div class="oben"><span class="muted klein">Wiegen hilft, Krankheiten früh zu merken.</span><button class="btn primary small" type="button" data-a="gewicht">＋ Gewicht</button></div>';
    if (l.length >= 2) {
      var min = Math.min.apply(null, l.map(function (x) { return x.kg; })), max = Math.max.apply(null, l.map(function (x) { return x.kg; })), spanne = Math.max(0.1, max - min);
      var t0 = KW.parse(l[0].datum).getTime(), t1 = KW.parse(l[l.length - 1].datum).getTime() || t0 + 1;
      var pkt = l.map(function (x) { var X = 30 + (KW.parse(x.datum).getTime() - t0) / Math.max(1, t1 - t0) * 280, Y = 140 - (x.kg - min) / spanne * 110; return [X, Y, x]; });
      h += '<div class="card grafik"><svg viewBox="0 0 320 170" role="img" aria-label="Gewichtsverlauf"><text x="2" y="34" font-size="10" fill="currentColor" opacity=".6">' + String(max).replace(".", ",") + ' kg</text><text x="2" y="144" font-size="10" fill="currentColor" opacity=".6">' + String(min).replace(".", ",") + ' kg</text><polyline fill="none" stroke="#8b5e34" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" points="' + pkt.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + '"/>' + pkt.map(function (p) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4.5" fill="#ff8a3c"><title>' + datum(p[2].datum) + ": " + p[2].kg + " kg</title></circle>"; }).join("") + '<text x="30" y="164" font-size="10" fill="currentColor" opacity=".6">' + datum(l[0].datum) + '</text><text x="310" y="164" font-size="10" text-anchor="end" fill="currentColor" opacity=".6">' + datum(l[l.length - 1].datum) + "</text></svg></div>";
    }
    return h + liste(l.slice().reverse(), function (x, i, arr) { var vor = arr[i + 1], d = vor ? Math.round((x.kg - vor.kg) * 100) / 100 : null; return '<button class="eintrag" type="button" data-e="gewicht" data-id="' + x.id + '"><span class="i">⚖️</span><span class="mitte"><b>' + String(x.kg).replace(".", ",") + " kg</b><small>" + datum(x.datum) + '</small></span><span class="rechts">' + (d === null ? "" : (d > 0 ? "+" : "") + String(d).replace(".", ",") + " kg") + "</span></button>"; }, ["Noch kein Gewicht", "Wiege dein Tier und trag es hier ein."]);
  }
  function medizin(a) {
    var l = (a.medi || []).slice().sort(function (x, y) { return (x.bis || "9") < (y.bis || "9") ? 1 : -1; });
    return '<div class="oben"><span class="muted klein">Nur so geben, wie es der Tierarzt verschrieben hat.</span><button class="btn primary small" type="button" data-a="medi">＋ Medikament</button></div>' +
      liste(l, function (m) { var aktivM = !m.bis || m.bis >= KW.today(); return '<button class="eintrag" type="button" data-e="medi" data-id="' + m.id + '"><span class="i">💊</span><span class="mitte"><b>' + esc(m.name) + "</b><small>" + esc([m.dosis, m.wie].filter(Boolean).join(" · ") || "–") + '</small></span><span class="rechts"><span class="punkt ' + (aktivM ? "bald" : "ok") + '"></span>' + (aktivM ? (m.bis ? "bis " + datum(m.bis) : "läuft") : "beendet") + "</span></button>"; }, ["Keine Medikamente", "Hier trägst du ein, was dein Tier bekommt."]);
  }
  function termine(a) {
    var l = (a.termine || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; });
    return '<div class="oben"><span class="muted klein">Termine und Besuche beim Tierarzt.</span><button class="btn primary small" type="button" data-a="termin">＋ Termin</button></div>' +
      liste(l, function (t) { var kommt = t.datum >= KW.today(); return '<button class="eintrag" type="button" data-e="termine" data-id="' + t.id + '"><span class="i">' + (kommt ? "📅" : "🩺") + '</span><span class="mitte"><b>' + esc(t.grund || "Tierarzt") + "</b><small>" + datum(t.datum) + (t.uhr ? " · " + esc(t.uhr) : "") + (t.notiz ? " · " + esc(t.notiz) : "") + '</small></span><span class="rechts">' + (kommt ? wannText(t.datum) : "") + "</span></button>"; }, ["Noch keine Termine", "Trag den nächsten Tierarzt-Besuch ein."]);
  }

  /* ---------- Fenster ---------- */
  var fenster = $("fenster"), fin = $("fensterIn");
  function oeffne(html, setup) { fin.innerHTML = html; if (!fenster.open) fenster.showModal(); if (setup) setup(fin); var f = fin.querySelector("[autofocus]"); if (f) setTimeout(function () { f.focus(); }, 50); }
  function zu() { if (fenster.open) fenster.close(); }
  fenster.addEventListener("click", function (e) { if (e.target === fenster) zu(); });
  function feld(id, label, wert, typ, extra) { return '<label class="field"><span>' + label + '</span><input class="inp" id="' + id + '" type="' + (typ || "text") + '" value="' + esc(wert || "") + '"' + (extra || "") + "></label>"; }
  function fuss(loeschen) { return '<div class="sheet-foot">' + (loeschen ? '<button class="btn danger" type="button" id="fWeg">Löschen</button>' : "") + '<span class="sp"></span><button class="btn" type="button" id="fAbbr">Abbrechen</button><button class="btn primary" type="button" id="fOk">Speichern</button></div>'; }
  function wert(id) { var e = fin.querySelector("#" + id); return e ? e.value.trim() : ""; }

  function tierFenster(t) {
    var neu = !t, w = t ? JSON.parse(JSON.stringify(t)) : { id: KW.id(), art: "hund", farbe: FARBEN[0], impf: [], gewicht: [], medi: [], termine: [] };
    oeffne("<h2>" + (neu ? "Neues Tier" : esc(t.name) + " bearbeiten") + "</h2>" + feld("tName", "Name", w.name, "text", ' maxlength="30" autofocus') +
      '<div class="field"><span>Was für ein Tier?</span><div class="arten" id="tArt">' + ARTEN.map(function (a) { return '<button type="button" data-art="' + a[0] + '" aria-pressed="' + (w.art === a[0]) + '">' + a[1] + " " + a[2] + "</button>"; }).join("") + "</div></div>" +
      '<div class="row">' + feld("tRasse", "Rasse (freiwillig)", w.rasse) + feld("tGeb", "Geburtstag", w.geb, "date") + "</div>" +
      '<div class="field"><span>Foto (freiwillig)</span><div class="row" style="align-items:center"><label class="btn" style="cursor:pointer"><input type="file" accept="image/*" id="tFoto" hidden>📷 Foto wählen</label><span id="tFotoInfo" class="muted klein">' + (w.foto ? "Foto ist gespeichert" : "") + "</span>" + (w.foto ? '<button class="btn small" type="button" id="tFotoWeg">Foto entfernen</button>' : "") + "</div></div>" +
      '<div class="field"><span>Farbe</span><div class="row" id="tFarbe">' + FARBEN.map(function (f) { return '<button type="button" data-f="' + f + '" aria-label="Farbe" style="width:34px;height:34px;border-radius:50%;border:3px solid ' + (f === w.farbe ? "var(--app)" : "transparent") + ";background:" + f + ';cursor:pointer"></button>'; }).join("") + "</div></div>" +
      '<div class="row">' + feld("tChip", "Chip-Nummer (freiwillig)", w.chip, "text", ' inputmode="numeric" maxlength="20"') + "</div>" +
      feld("tAllergie", "Allergien / Unverträglichkeiten", w.allergien, "text", ' maxlength="120"') + feld("tFutter", "Futter", w.futter, "text", ' maxlength="120"') +
      '<div class="row">' + feld("tArzt", "Tierarzt / Praxis", w.arzt, "text", ' maxlength="60"') + feld("tTel", "Telefon der Praxis", w.arztTel, "tel", ' maxlength="30"') + "</div>" +
      fuss(!neu),
      function (f) {
        f.querySelector("#tArt").onclick = function (e) { var b = e.target.closest("[data-art]"); if (!b) return; w.art = b.dataset.art; f.querySelectorAll("#tArt button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
        f.querySelector("#tFarbe").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; w.farbe = b.dataset.f; f.querySelectorAll("#tFarbe button").forEach(function (x) { x.style.borderColor = x === b ? "var(--app)" : "transparent"; }); };
        f.querySelector("#tFoto").onchange = function () { var d = this.files && this.files[0]; if (!d) return; verkleinern(d, function (url) { w.foto = url; f.querySelector("#tFotoInfo").textContent = "✅ Foto übernommen"; }); };
        var fw = f.querySelector("#tFotoWeg"); if (fw) fw.onclick = function () { w.foto = null; f.querySelector("#tFotoInfo").textContent = "Foto entfernt"; this.remove(); };
        f.querySelector("#fAbbr").onclick = zu;
        var weg = f.querySelector("#fWeg"); if (weg) weg.onclick = function () {
          if (!confirm(t.name + " mit allen Einträgen löschen?")) return;
          var i = D.tiere.indexOf(t); D.tiere.splice(i, 1); D.aktiv = D.tiere[0] ? D.tiere[0].id : null; speichern(); zu(); zeigen();
          KW.toast(t.name + " gelöscht.", "Rückgängig", function () { D.tiere.splice(i, 0, t); D.aktiv = t.id; speichern(); zeigen(); });
        };
        f.querySelector("#fOk").onclick = function () {
          w.name = wert("tName"); if (!w.name) { KW.toast("Wie heißt dein Tier?"); return; }
          w.rasse = wert("tRasse"); w.geb = wert("tGeb"); w.chip = wert("tChip"); w.allergien = wert("tAllergie"); w.futter = wert("tFutter"); w.arzt = wert("tArzt"); w.arztTel = wert("tTel");
          if (neu) D.tiere.push(w); else D.tiere[D.tiere.indexOf(t)] = w;
          D.aktiv = w.id; speichern(); zu(); zeigen();
          if (neu) { KW.toast(w.name + " ist angelegt 🐾"); if (IMPF[w.art]) setTimeout(function () { reiter = "impf"; zeigen(); }, 600); }
        };
      });
  }
  function verkleinern(datei, fertig) {
    var u = URL.createObjectURL(datei), img = new Image();
    img.onload = function () { var s = 240, c = document.createElement("canvas"), m = Math.min(img.width, img.height); c.width = c.height = s; c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s); URL.revokeObjectURL(u); fertig(c.toDataURL("image/jpeg", 0.8)); };
    img.onerror = function () { KW.toast("Dieses Bild kann ich nicht öffnen."); };
    img.src = u;
  }
  // Einträge (Impfung, Gewicht, Medikament, Termin) anlegen/bearbeiten
  var FORM = {
    impf: { titel: "Impfung", felder: function (x, a) { return '<label class="field"><span>Impfung gegen</span><input class="inp" id="eName" list="impfListe" value="' + esc(x.name || "") + '" maxlength="60" autofocus><datalist id="impfListe">' + (IMPF[a.art] || []).map(function (i) { return '<option value="' + esc(i) + '">'; }).join("") + "</datalist></label>" + '<div class="row">' + feld("eDatum", "Geimpft am", x.datum || KW.today(), "date") + feld("eNaechste", "Nächste Impfung (Erinnerung)", x.naechste, "date") + "</div>" + '<div class="row" id="schnell" style="margin:-4px 0 12px;gap:6px"><span class="muted klein">Nächste in:</span><button class="btn small" type="button" data-plus="365">1 Jahr</button><button class="btn small" type="button" data-plus="730">2 Jahren</button><button class="btn small" type="button" data-plus="1095">3 Jahren</button></div>' + feld("eCharge", "Impfstoff / Charge (aus dem Impfpass, freiwillig)", x.charge, "text", ' maxlength="40"'); }, lesen: function (x) { x.name = wert("eName"); x.datum = wert("eDatum"); x.naechste = wert("eNaechste"); x.charge = wert("eCharge"); return x.name && x.datum; } },
    gewicht: { titel: "Gewicht", felder: function (x) { return '<div class="row">' + feld("eKg", "Gewicht in kg", x.kg !== undefined ? String(x.kg).replace(".", ",") : "", "text", ' inputmode="decimal" autofocus placeholder="z. B. 12,4"') + feld("eDatum", "Datum", x.datum || KW.today(), "date") + "</div>"; }, lesen: function (x) { var k = parseFloat(wert("eKg").replace(",", ".")); x.kg = Math.round(k * 100) / 100; x.datum = wert("eDatum"); return k > 0 && k < 2000 && x.datum; } },
    medi: { titel: "Medikament", felder: function (x) { return feld("eName", "Name", x.name, "text", ' maxlength="60" autofocus') + '<div class="row">' + feld("eDosis", "Menge", x.dosis, "text", ' maxlength="40" placeholder="z. B. 1/2 Tablette"') + feld("eWie", "Wie oft", x.wie, "text", ' maxlength="40" placeholder="z. B. morgens und abends"') + "</div>" + '<div class="row">' + feld("eAb", "Ab", x.ab || KW.today(), "date") + feld("eBis", "Bis (leer = dauerhaft)", x.bis, "date") + "</div>"; }, lesen: function (x) { x.name = wert("eName"); x.dosis = wert("eDosis"); x.wie = wert("eWie"); x.ab = wert("eAb"); x.bis = wert("eBis"); return x.name; } },
    termine: { titel: "Tierarzt-Termin", felder: function (x) { return feld("eGrund", "Grund", x.grund, "text", ' maxlength="60" autofocus placeholder="z. B. Impfung, Zähne, Kontrolle"') + '<div class="row">' + feld("eDatum", "Datum", x.datum || KW.today(), "date") + feld("eUhr", "Uhrzeit", x.uhr, "time") + "</div>" + '<label class="field"><span>Notiz (z. B. was der Tierarzt gesagt hat)</span><textarea class="inp" id="eNotiz" maxlength="400">' + esc(x.notiz || "") + "</textarea></label>"; }, lesen: function (x) { x.grund = wert("eGrund"); x.datum = wert("eDatum"); x.uhr = wert("eUhr"); x.notiz = wert("eNotiz"); return x.datum; } }
  };
  function eintragFenster(liste_, x) {
    var a = aktiv(), neu = !x, f = FORM[liste_], w = x ? Object.assign({}, x) : { id: KW.id() };
    a[liste_] = a[liste_] || [];
    oeffne("<h2>" + (neu ? "Neu: " : "") + f.titel + "</h2>" + f.felder(w, a) + fuss(!neu), function (el) {
      var s = el.querySelector("#schnell"); if (s) s.onclick = function (e) { var b = e.target.closest("[data-plus]"); if (!b) return; var d = wert("eDatum") || KW.today(); el.querySelector("#eNaechste").value = KW.addDays(d, +b.dataset.plus); };
      el.querySelector("#fAbbr").onclick = zu;
      var weg = el.querySelector("#fWeg"); if (weg) weg.onclick = function () { var i = a[liste_].indexOf(x); a[liste_].splice(i, 1); speichern(); zu(); zeigen(); KW.toast("Gelöscht.", "Rückgängig", function () { a[liste_].splice(i, 0, x); speichern(); zeigen(); }); };
      el.querySelector("#fOk").onclick = function () {
        if (!f.lesen(w)) { KW.toast("Bitte füll die wichtigsten Felder aus."); return; }
        if (neu) a[liste_].push(w); else a[liste_][a[liste_].indexOf(x)] = w;
        speichern(); zu(); zeigen(); KW.toast("Gespeichert ✅");
      };
    });
  }

  /* ---------- Akte für den Tierarzt ---------- */
  function akteText(a) {
    var z = ["FIDELIA Pet – Akte", a.name + " (" + art(a)[2] + (a.rasse ? ", " + a.rasse : "") + ")"];
    if (a.geb) z.push("Geboren: " + datum(a.geb)); if (a.chip) z.push("Chip: " + a.chip);
    if (a.allergien) z.push("Allergien: " + a.allergien);
    var w = (a.gewicht || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; })[0]; if (w) z.push("Gewicht: " + w.kg + " kg (" + datum(w.datum) + ")");
    (a.impf || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; }).slice(0, 12).forEach(function (i) { z.push("Impfung: " + i.name + " " + datum(i.datum)); });
    (a.medi || []).filter(function (m) { return !m.bis || m.bis >= KW.today(); }).forEach(function (m) { z.push("Medikament: " + m.name + (m.dosis ? " " + m.dosis : "") + (m.wie ? ", " + m.wie : "")); });
    return z.join("\n").slice(0, 1200);
  }
  function akte() {
    var a = aktiv(); if (!a) return;
    var d = document.createElement("div"); d.className = "akte"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Akte von " + a.name);
    var zeile = function (k, v) { return v ? "<tr><td style=\"width:40%;color:#5b6578\">" + k + "</td><td>" + esc(v) + "</td></tr>" : ""; };
    var w = (a.gewicht || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; });
    d.innerHTML = '<div class="in"><div class="qr" id="akteQr"></div><h1>' + esc(a.name) + '</h1><p style="margin:0;color:#5b6578">' + esc(art(a)[2]) + (a.rasse ? " · " + esc(a.rasse) : "") + " · Stand " + datum(KW.today()) + "</p>" +
      "<h3>Tier</h3><table>" + zeile("Geboren", a.geb ? datum(a.geb) + " (" + alter(a.geb) + ")" : "") + zeile("Chip-Nummer", a.chip) + zeile("Allergien", a.allergien) + zeile("Futter", a.futter) + zeile("Gewicht", w[0] ? String(w[0].kg).replace(".", ",") + " kg am " + datum(w[0].datum) : "") + "</table>" +
      "<h3>Impfungen</h3><table>" + ((a.impf || []).slice().sort(function (x, y) { return x.datum < y.datum ? 1 : -1; }).map(function (i) { return "<tr><td>" + esc(i.name) + "</td><td>" + datum(i.datum) + (i.charge ? " · " + esc(i.charge) : "") + (i.naechste ? " · nächste " + datum(i.naechste) : "") + "</td></tr>"; }).join("") || "<tr><td>Keine eingetragen</td></tr>") + "</table>" +
      "<h3>Aktuelle Medikamente</h3><table>" + ((a.medi || []).filter(function (m) { return !m.bis || m.bis >= KW.today(); }).map(function (m) { return "<tr><td>" + esc(m.name) + "</td><td>" + esc([m.dosis, m.wie, m.bis ? "bis " + datum(m.bis) : ""].filter(Boolean).join(" · ")) + "</td></tr>"; }).join("") || "<tr><td>Keine</td></tr>") + "</table>" +
      "<h3>Letzte Tierarzt-Besuche</h3><table>" + ((a.termine || []).filter(function (t) { return t.datum <= KW.today(); }).sort(function (x, y) { return x.datum < y.datum ? 1 : -1; }).slice(0, 6).map(function (t) { return "<tr><td>" + datum(t.datum) + "</td><td>" + esc((t.grund || "") + (t.notiz ? " – " + t.notiz : "")) + "</td></tr>"; }).join("") || "<tr><td>Keine</td></tr>") + "</table>" +
      '<p style="color:#5b6578;font-size:.8rem;margin-top:16px">Selbst eingetragen mit FIDELIA Pet. Der QR-Code enthält eine Kurzfassung als Text – er wird nirgends hochgeladen.</p>' +
      '<div class="knoepfe"><button class="btn primary" type="button" data-k="druck">🖨️ Drucken / als PDF</button><button class="btn" type="button" data-k="zu">Schließen</button></div></div>';
    document.body.appendChild(d);
    d.onclick = function (e) { var b = e.target.closest("[data-k]"); if (!b) return; if (b.dataset.k === "druck") window.print(); else d.remove(); };
    var s = document.createElement("script"); s.src = "../shared/vendor/qr/qrcode.js";
    s.onload = function () { try { var q = window.qrcode(0, "L"); q.addData(unescape(encodeURIComponent(akteText(a)))); q.make(); d.querySelector("#akteQr").innerHTML = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }) + "Zum Abscannen"; } catch (e) { /* zu lang */ } };
    if (window.qrcode) s.onload(); else document.head.appendChild(s);
  }
  // Erinnerungen als Kalender-Datei (.ics) – damit erinnert das Handy auch, wenn die App zu ist
  function ics() {
    var a = aktiv(), ev = [], st = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    function tag(d) { return d.replace(/-/g, ""); }
    function txt(s) { return String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }
    (a.impf || []).forEach(function (i) { if (i.naechste && i.naechste >= KW.today()) ev.push({ d: i.naechste, t: "💉 " + a.name + ": " + i.name + " auffrischen", id: "impf-" + i.id }); });
    (a.termine || []).forEach(function (t) { if (t.datum >= KW.today()) ev.push({ d: t.datum, u: t.uhr, t: "🩺 " + a.name + ": " + (t.grund || "Tierarzt"), id: "termin-" + t.id }); });
    if (a.geb) { var g = a.geb.slice(5), j = new Date().getFullYear(), d = j + "-" + g; if (d < KW.today()) d = (j + 1) + "-" + g; ev.push({ d: d, t: "🎂 " + a.name + " hat Geburtstag", id: "geb-" + a.id, jahr: true }); }
    if (!ev.length) { KW.toast("Es gibt noch keine zukünftigen Termine oder Impfungen."); return; }
    var z = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//OMNIVIA//FIDELIA Pet//DE", "CALSCALE:GREGORIAN"];
    ev.forEach(function (e) {
      z.push("BEGIN:VEVENT", "UID:" + e.id + "@fidelia-pet", "DTSTAMP:" + st);
      if (e.u) { var s = tag(e.d) + "T" + e.u.replace(":", "") + "00"; z.push("DTSTART:" + s, "DURATION:PT30M"); }
      else z.push("DTSTART;VALUE=DATE:" + tag(e.d), "DTEND;VALUE=DATE:" + tag(KW.addDays(e.d, 1)));
      if (e.jahr) z.push("RRULE:FREQ=YEARLY");
      z.push("SUMMARY:" + txt(e.t), "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + txt(e.t), "TRIGGER:" + (e.u ? "-PT2H" : "-P3D"), "END:VALARM", "END:VEVENT");
    });
    z.push("END:VCALENDAR");
    var b = new Blob([z.join("\r\n")], { type: "text/calendar" }), l = document.createElement("a");
    l.href = URL.createObjectURL(b); l.download = "FIDELIA-Pet-" + a.name + ".ics"; document.body.appendChild(l); l.click(); l.remove();
    KW.toast(ev.length + " Erinnerungen – öffne die Datei, um sie in deinen Kalender zu übernehmen.");
  }

  /* ---------- Klicks ---------- */
  document.addEventListener("click", function (e) {
    if (fenster.contains(e.target)) return;
    var t = e.target.closest("[data-t]"); if (t) { if (t.dataset.t === "neu") tierFenster(null); else { D.aktiv = t.dataset.t; speichern(); zeigen(); } return; }
    var r = e.target.closest("[data-r]"); if (r) { reiter = r.dataset.r; zeigen(); return; }
    var en = e.target.closest("[data-e]"); if (en) { var a = aktiv(), x = (a[en.dataset.e] || []).filter(function (y) { return y.id === en.dataset.id; })[0]; if (x) eintragFenster(en.dataset.e, x); return; }
    var b = e.target.closest("[data-a]"); if (!b) return;
    var aktion = b.dataset.a;
    if (aktion === "neu") tierFenster(null);
    else if (aktion === "bearbeiten") tierFenster(aktiv());
    else if (aktion === "impf") eintragFenster("impf");
    else if (aktion === "gewicht") eintragFenster("gewicht");
    else if (aktion === "medi") eintragFenster("medi");
    else if (aktion === "termin") eintragFenster("termine");
    else if (aktion === "akte") akte();
    else if (aktion === "ics") ics();
  });

  KW.footer("pet", function () { return D; }, function (d) { if (d && Array.isArray(d.tiere)) { D = d; speichern(); zeigen(); } });
  zeigen();
})();
