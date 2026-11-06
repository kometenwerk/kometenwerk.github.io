/* FIDELIA Health – das private Tagebuch für Schlaf, Bewegung, Stimmung, Beschwerden und (wenn gewünscht) Zyklus.
   Alles bleibt auf dem Gerät und wird mit deiner PIN verschlüsselt. Keine Kalorien, keine Gewichtsziele – das ist Absicht. */
(function () {
  "use strict";
  var esc = KW.esc, $ = function (id) { return document.getElementById(id); }, S = crypto.subtle, TE = new TextEncoder(), TD = new TextDecoder();
  var KEY = "kw-health";
  var D = null, schluessel = null, salz = null, ruhe = null;
  var heute = KW.today(), tag = heute, reiter = "tag";
  var STIMMUNG = [["super", "😄", "Super"], ["gut", "🙂", "Gut"], ["okay", "😐", "Okay"], ["mies", "😕", "Mies"], ["schlecht", "😢", "Schlecht"]];
  var SPORT = ["🚶 Gehen", "🚴 Rad", "⚽ Fußball", "🏊 Schwimmen", "🏃 Laufen", "🤸 Turnen", "💃 Tanzen", "🏀 Basketball", "🧘 Yoga", "🎾 Tennis", "🛹 Skaten", "✨ Anderes"];
  var BESCHWERDEN = ["🤕 Kopfweh", "🤢 Bauchweh", "🤧 Schnupfen", "😷 Halsweh", "🥱 Müde", "🌡️ Fieber", "💥 Krämpfe", "🦵 Muskelkater", "🤯 Stress", "✨ Anderes"];

  /* ---------- Verschlüsselung mit PIN ---------- */
  function b64(buf) { var b = new Uint8Array(buf), s = ""; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var r = atob(s), b = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) b[i] = r.charCodeAt(i); return b; }
  function ausPin(pin, s) { return S.importKey("raw", TE.encode("fidelia-health/" + pin), "PBKDF2", false, ["deriveKey"]).then(function (k) { return S.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: s, iterations: 400000 }, k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); }); }
  function verpacken() { var iv = crypto.getRandomValues(new Uint8Array(12)); return S.encrypt({ name: "AES-GCM", iv: iv }, schluessel, TE.encode(JSON.stringify(D))).then(function (ct) { return { v: 1, s: b64(salz), iv: b64(iv), ct: b64(ct) }; }); }
  function speichern() { verpacken().then(function (p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { KW.toast("Speichern ging nicht – ist der Speicher voll?"); } }); wach(); }
  function gespeichert() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  async function entsperren(pin, paket) { var k = await ausPin(pin, unb64(paket.s)); var pt = await S.decrypt({ name: "AES-GCM", iv: unb64(paket.iv) }, k, unb64(paket.ct)); return { k: k, d: JSON.parse(TD.decode(pt)) }; }
  // nach 5 Minuten ohne Tippen wieder sperren
  function wach() { clearTimeout(ruhe); ruhe = setTimeout(sperren, 5 * 60 * 1000); }
  function sperren() { D = null; schluessel = null; $("ansicht").innerHTML = ""; pinSeite(); }
  document.addEventListener("pointerdown", function () { if (D) wach(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && D) { clearTimeout(ruhe); ruhe = setTimeout(sperren, 60 * 1000); } });

  /* ---------- PIN-Seite ---------- */
  function pinSeite() {
    var p = gespeichert(), neu = !p;
    $("sperre").hidden = !neu && false;
    $("ansicht").innerHTML = '<div class="pin-karte card"><div class="gross" aria-hidden="true">' + (neu ? "🌱" : "🔒") + "</div><h2>" + (neu ? "Dein privates Tagebuch" : "Gesperrt") + "</h2>" +
      "<p>" + (neu ? "Schlaf, Bewegung, Stimmung und wie es dir geht – nur für dich. Lege eine PIN fest: Damit wird alles auf diesem Gerät verschlüsselt." : "Gib deine PIN ein.") + "</p>" +
      '<input class="inp pin" id="pin" type="password" inputmode="numeric" autocomplete="' + (neu ? "new-password" : "current-password") + '" maxlength="12" placeholder="' + (neu ? "PIN (mind. 4 Ziffern)" : "PIN") + '" aria-label="PIN">' +
      (neu ? '<input class="inp pin" id="pin2" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="PIN nochmal" aria-label="PIN wiederholen">' : "") +
      '<button class="btn primary" type="button" id="pinOk">' + (neu ? "Tagebuch anlegen" : "Öffnen") + "</button>" +
      (neu ? '<p class="muted klein">⚠️ Merk dir die PIN gut. Ohne sie kann niemand die Einträge öffnen – auch wir nicht. Längere PINs sind sicherer.</p><p class="muted klein">Schon ein Backup? <button class="link" type="button" id="pinBackup">Backup laden</button></p>' : '<p class="muted klein"><button class="link" type="button" id="pinVergessen">PIN vergessen?</button></p>') + "</div>";
    var f = $("pin"); setTimeout(function () { f.focus(); }, 100);
    var los = async function () {
      var pin = $("pin").value.trim();
      if (!/^\d{4,12}$/.test(pin)) { wackeln("Die PIN besteht aus 4 bis 12 Ziffern."); return; }
      $("pinOk").disabled = true; $("pinOk").textContent = "Moment …";
      try {
        if (neu) {
          if ($("pin2").value.trim() !== pin) { $("pinOk").disabled = false; $("pinOk").textContent = "Tagebuch anlegen"; wackeln("Die beiden PINs sind nicht gleich."); return; }
          salz = crypto.getRandomValues(new Uint8Array(16)); schluessel = await ausPin(pin, salz);
          D = { tage: {}, zyklus: { an: false, start: [] }, angelegt: heute }; speichern();
        } else {
          var r = await entsperren(pin, p); schluessel = r.k; D = r.d; salz = unb64(p.s);
        }
        wach(); zeigen();
      } catch (e) { $("pinOk").disabled = false; $("pinOk").textContent = "Öffnen"; $("pin").value = ""; wackeln("Die PIN stimmt nicht."); }
    };
    $("pinOk").onclick = los;
    [f, $("pin2")].forEach(function (x) { if (x) x.onkeydown = function (e) { if (e.key === "Enter") los(); }; });
    var v = $("pinVergessen"); if (v) v.onclick = function () { if (confirm("Ohne PIN lassen sich die Einträge nicht öffnen. Alles löschen und neu anfangen?") && confirm("Wirklich? Alle Einträge sind dann weg.")) { localStorage.removeItem(KEY); pinSeite(); } };
    var bk = $("pinBackup"); if (bk) bk.onclick = backupLaden;
  }
  function wackeln(t) { var k = document.querySelector(".pin-karte"); KW.toast(t); if (k) { k.classList.remove("wackel"); void k.offsetWidth; k.classList.add("wackel"); } }

  /* ---------- Hauptansicht ---------- */
  function eintrag(d) { D.tage[d] = D.tage[d] || {}; return D.tage[d]; }
  function datumText(d) { if (d === heute) return "Heute"; if (d === KW.addDays(heute, -1)) return "Gestern"; var x = KW.parse(d); return ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][x.getDay()] + ", " + x.getDate() + "." + (x.getMonth() + 1) + "."; }
  function zeigen() {
    $("knopfSperren").hidden = false; $("knopfEinst").hidden = false;
    var h = '<div class="tabs" role="tablist">' + [["tag", "📅 Tag"], ["woche", "📊 Überblick"]].concat(D.zyklus.an ? [["zyklus", "🌸 Zyklus"]] : []).map(function (r) { return '<button type="button" role="tab" data-r="' + r[0] + '" aria-selected="' + (reiter === r[0]) + '">' + r[1] + "</button>"; }).join("") + "</div>";
    h += ({ tag: tagAnsicht, woche: wochenAnsicht, zyklus: zyklusAnsicht }[reiter] || tagAnsicht)();
    $("ansicht").innerHTML = h;
  }
  function tagAnsicht() {
    var e = D.tage[tag] || {};
    var h = '<div class="tagwahl"><button class="kw-ico2" type="button" data-tag="-1" aria-label="Tag davor">‹</button><b>' + esc(datumText(tag)) + '</b><button class="kw-ico2" type="button" data-tag="1" aria-label="Tag danach"' + (tag >= heute ? " disabled" : "") + ">›</button></div>";
    h += '<div class="card block"><h3>Wie geht es dir?</h3><div class="stimmung">' + STIMMUNG.map(function (s) { return '<button type="button" data-st="' + s[0] + '" aria-pressed="' + (e.st === s[0]) + '"><span>' + s[1] + "</span><small>" + s[2] + "</small></button>"; }).join("") + "</div></div>";
    h += '<div class="card block"><h3>😴 Schlaf</h3><div class="regler"><button type="button" data-schlaf="-0.5" aria-label="Weniger">−</button><b>' + (e.schlaf != null ? String(e.schlaf).replace(".", ",") + " Std." : "–") + '</b><button type="button" data-schlaf="0.5" aria-label="Mehr">＋</button></div><div class="chips2">' + [["tief", "😌 Gut geschlafen"], ["unruhig", "😵 Unruhig"]].map(function (q) { return '<button type="button" data-sq="' + q[0] + '" aria-pressed="' + (e.sq === q[0]) + '">' + q[1] + "</button>"; }).join("") + "</div></div>";
    h += '<div class="card block"><h3>🏃 Bewegung</h3><div class="regler"><button type="button" data-bew="-10" aria-label="Weniger">−</button><b>' + (e.bew ? e.bew + " Min." : "–") + '</b><button type="button" data-bew="10" aria-label="Mehr">＋</button></div><div class="chips2">' + SPORT.map(function (s) { return '<button type="button" data-sport="' + esc(s) + '" aria-pressed="' + ((e.sport || []).indexOf(s) >= 0) + '">' + esc(s) + "</button>"; }).join("") + "</div></div>";
    h += '<div class="card block"><h3>💧 Trinken</h3><div class="glaeser">' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<button type="button" data-glas="' + n + '" aria-label="' + n + ' Gläser" aria-pressed="' + ((e.glas || 0) >= n) + '">🥛</button>'; }).join("") + '</div><small class="muted">' + (e.glas || 0) + " Gläser</small></div>";
    h += '<div class="card block"><h3>🩹 Beschwerden</h3><div class="chips2">' + BESCHWERDEN.map(function (s) { return '<button type="button" data-bes="' + esc(s) + '" aria-pressed="' + ((e.bes || []).indexOf(s) >= 0) + '">' + esc(s) + "</button>"; }).join("") + "</div>" + (oftBeschwerden() ? '<p class="tipp">💬 Du hattest in letzter Zeit oft Beschwerden. Wenn das so bleibt, sprich mit deinen Eltern oder geh zum Arzt.</p>' : "") + "</div>";
    if (D.zyklus.an) h += '<div class="card block"><h3>🌸 Periode</h3><div class="chips2"><button type="button" data-per="1" aria-pressed="' + !!e.per + '">' + (e.per ? "🩸 Heute: Periode" : "Heute Periode eintragen") + "</button></div></div>";
    h += '<div class="card block"><h3>📝 Notiz</h3><textarea class="inp" id="notiz" maxlength="1000" placeholder="Was war heute los? (nur für dich)">' + esc(e.notiz || "") + "</textarea></div>";
    return h;
  }
  function oftBeschwerden() { var n = 0; for (var i = 0; i < 10; i++) { var e = D.tage[KW.addDays(heute, -i)]; if (e && e.bes && e.bes.length) n++; } return n >= 6; }
  function wochenAnsicht() {
    var tage = []; for (var i = 13; i >= 0; i--) tage.push(KW.addDays(heute, -i));
    var balken = function (titel, wert, max, farbe, einheit) {
      return '<div class="card block"><h3>' + titel + '</h3><div class="saeulen">' + tage.map(function (d) { var v = wert(D.tage[d] || {}); var hh = v ? Math.max(4, Math.min(100, v / max * 100)) : 0; return '<div class="s"><span style="height:' + hh + "%;background:" + farbe + '" title="' + esc(datumText(d)) + ": " + (v || 0) + " " + einheit + '"></span><small>' + KW.parse(d).getDate() + "</small></div>"; }).join("") + "</div></div>";
    };
    var mit = function (f) { var s = 0, n = 0; tage.slice(7).forEach(function (d) { var v = f(D.tage[d] || {}); if (v) { s += v; n++; } }); return n ? Math.round(s / n * 10) / 10 : null; };
    var st = {}; tage.slice(7).forEach(function (d) { var e = D.tage[d]; if (e && e.st) st[e.st] = (st[e.st] || 0) + 1; });
    var h = '<div class="kacheln"><div class="card kachel"><small>Schlaf (7 Tage)</small><b>' + (mit(function (e) { return e.schlaf; }) != null ? String(mit(function (e) { return e.schlaf; })).replace(".", ",") + " Std." : "–") + '</b></div><div class="card kachel"><small>Bewegung (7 Tage)</small><b>' + tage.slice(7).reduce(function (s, d) { return s + ((D.tage[d] || {}).bew || 0); }, 0) + ' Min.</b></div><div class="card kachel"><small>Stimmung (7 Tage)</small><b>' + (STIMMUNG.filter(function (s) { return st[s[0]]; }).map(function (s) { return s[1] + "×" + st[s[0]]; }).join(" ") || "–") + "</b></div></div>";
    h += balken("😴 Schlaf – 14 Tage", function (e) { return e.schlaf; }, 11, "#6d8fd6", "Std.");
    h += balken("🏃 Bewegung – 14 Tage", function (e) { return e.bew; }, 120, "#2f6f4f", "Min.");
    h += '<div class="card block"><h3>Stimmung – 14 Tage</h3><div class="saeulen emo">' + tage.map(function (d) { var e = D.tage[d] || {}, s = STIMMUNG.filter(function (x) { return x[0] === e.st; })[0]; return '<div class="s"><span class="e">' + (s ? s[1] : "·") + "</span><small>" + KW.parse(d).getDate() + "</small></div>"; }).join("") + "</div></div>";
    h += '<p class="muted klein">💡 Tipp: Jugendliche brauchen meist 8 bis 10 Stunden Schlaf und jeden Tag etwa eine Stunde Bewegung. Das hier ist nur ein Tagebuch – bei Sorgen frag deine Eltern oder einen Arzt.</p>';
    return h;
  }
  function zyklusAnsicht() {
    // Starttage = erster Periodentag nach mindestens 2 Tagen ohne
    var tage = Object.keys(D.tage).filter(function (d) { return D.tage[d].per; }).sort(), starts = [];
    tage.forEach(function (d) { if (!D.tage[KW.addDays(d, -1)] || !D.tage[KW.addDays(d, -1)].per) { if (!D.tage[KW.addDays(d, -2)] || !D.tage[KW.addDays(d, -2)].per) starts.push(d); } });
    var laengen = []; for (var i = 1; i < starts.length; i++) { var l = KW.days(starts[i - 1], starts[i]); if (l >= 18 && l <= 45) laengen.push(l); }
    var schnitt = laengen.length ? Math.round(laengen.slice(-6).reduce(function (a, b) { return a + b; }, 0) / Math.min(6, laengen.length)) : null;
    var naechste = schnitt && starts.length ? KW.addDays(starts[starts.length - 1], schnitt) : null;
    var h = '<div class="kacheln"><div class="card kachel"><small>Letzte Periode</small><b>' + (starts.length ? esc(datumText(starts[starts.length - 1])) : "–") + '</b></div><div class="card kachel"><small>Durchschnittlicher Zyklus</small><b>' + (schnitt ? schnitt + " Tage" : "noch zu wenig Daten") + '</b></div><div class="card kachel"><small>Nächste ungefähr</small><b>' + (naechste ? esc(datumText(naechste)) + " (in " + KW.days(heute, naechste) + " Tagen)" : "–") + "</b></div></div>";
    h += '<div class="card block"><h3>Kalender – letzte 6 Wochen</h3><div class="kal">' + (function () { var z = ""; for (var j = 41; j >= 0; j--) { var d = KW.addDays(heute, -j), e = D.tage[d] || {}; z += '<span class="' + (e.per ? "per" : "") + (d === heute ? " heute" : "") + '" title="' + esc(datumText(d)) + '">' + KW.parse(d).getDate() + "</span>"; } return z; })() + "</div></div>";
    h += '<p class="muted klein">Die Vorhersage ist nur eine grobe Schätzung aus deinen Einträgen – kein Verhütungsmittel und keine medizinische Auskunft. Bei Fragen hilft deine Frauenärztin oder dein Arzt.</p>';
    return h;
  }

  /* ---------- Eingaben ---------- */
  document.addEventListener("click", function (ev) {
    if (!D) return;
    var b = ev.target.closest("button"); if (!b) return;
    var e, ds = b.dataset;
    if (ds.r) { reiter = ds.r; zeigen(); return; }
    if (ds.tag) { var n = KW.addDays(tag, +ds.tag); if (n <= heute) { tag = n; zeigen(); } return; }
    if (!("st" in ds || "schlaf" in ds || "sq" in ds || "bew" in ds || "sport" in ds || "glas" in ds || "bes" in ds || "per" in ds)) return;
    e = eintrag(tag);
    if (ds.st) e.st = e.st === ds.st ? null : ds.st;
    if (ds.schlaf) e.schlaf = Math.max(0, Math.min(16, (e.schlaf == null ? 8 : e.schlaf) + (e.schlaf == null ? 0 : +ds.schlaf)));
    if (ds.sq) e.sq = e.sq === ds.sq ? null : ds.sq;
    if (ds.bew) e.bew = Math.max(0, Math.min(600, (e.bew || 0) + +ds.bew));
    if (ds.sport) { e.sport = e.sport || []; var i = e.sport.indexOf(ds.sport); if (i >= 0) e.sport.splice(i, 1); else e.sport.push(ds.sport); }
    if (ds.glas) e.glas = e.glas === +ds.glas ? +ds.glas - 1 : +ds.glas;
    if (ds.bes) { e.bes = e.bes || []; var j = e.bes.indexOf(ds.bes); if (j >= 0) e.bes.splice(j, 1); else e.bes.push(ds.bes); }
    if (ds.per) e.per = !e.per;
    speichern(); var y = scrollY; zeigen(); scrollTo(0, y);
  });
  document.addEventListener("input", function (ev) { if (D && ev.target.id === "notiz") { eintrag(tag).notiz = ev.target.value; clearTimeout(ev.target._t); ev.target._t = setTimeout(speichern, 500); } });

  /* ---------- Einstellungen, Backup ---------- */
  $("knopfSperren").onclick = function () { sperren(); KW.toast("Gesperrt 🔒"); };
  $("knopfEinst").onclick = function () {
    var dlg = $("fenster"), fin = $("fensterIn");
    fin.innerHTML = '<h2>Einstellungen</h2><div class="menue">' +
      '<label class="btn"><input type="checkbox" id="zAn"' + (D.zyklus.an ? " checked" : "") + '> 🌸 Zyklus-Kalender anzeigen</label>' +
      '<button class="btn" type="button" data-e="pin">🔑 PIN ändern</button>' +
      '<button class="btn" type="button" data-e="backup">💾 Verschlüsseltes Backup speichern</button>' +
      '<button class="btn" type="button" data-e="laden">📂 Backup laden</button>' +
      '<button class="btn danger" type="button" data-e="alles">🗑️ Alle Einträge löschen</button></div>' +
      '<p class="muted klein" style="margin-top:12px">🔒 Deine Einträge liegen nur auf diesem Gerät, verschlüsselt mit deiner PIN. Nichts geht ins Internet.</p><div class="sheet-foot"><button class="btn primary" type="button" data-e="zu">Fertig</button></div>';
    dlg.showModal();
    fin.querySelector("#zAn").onchange = function () { D.zyklus.an = this.checked; if (!this.checked && reiter === "zyklus") reiter = "tag"; speichern(); zeigen(); };
    fin.onclick = async function (e) {
      var b = e.target.closest("[data-e]"); if (!b) return;
      var a = b.dataset.e;
      if (a === "zu") dlg.close();
      else if (a === "backup") { var p = await verpacken(); var bl = new Blob([JSON.stringify(Object.assign({ fidelia: "health-backup" }, p))], { type: "application/octet-stream" }); var l = document.createElement("a"); l.href = URL.createObjectURL(bl); l.download = "FIDELIA-Health-Backup-" + heute + ".fidelia"; document.body.appendChild(l); l.click(); l.remove(); KW.toast("Backup gespeichert – es lässt sich nur mit deiner PIN öffnen."); }
      else if (a === "laden") { dlg.close(); backupLaden(); }
      else if (a === "pin") {
        var alt = prompt("Deine jetzige PIN:"); if (alt === null) return;
        try { await entsperren(alt.trim(), gespeichert()); } catch (err) { KW.toast("Die PIN stimmt nicht."); return; }
        var neu = prompt("Neue PIN (4 bis 12 Ziffern):"); if (!neu || !/^\d{4,12}$/.test(neu.trim())) { KW.toast("Die PIN braucht 4 bis 12 Ziffern."); return; }
        if (prompt("Neue PIN nochmal:") !== neu) { KW.toast("Die PINs sind nicht gleich."); return; }
        salz = crypto.getRandomValues(new Uint8Array(16)); schluessel = await ausPin(neu.trim(), salz); speichern(); KW.toast("PIN geändert ✅");
      } else if (a === "alles") { if (confirm("Wirklich alle Einträge löschen?")) { D.tage = {}; speichern(); dlg.close(); zeigen(); KW.toast("Alles gelöscht."); } }
    };
  };
  $("fenster").addEventListener("click", function (e) { if (e.target === this) this.close(); });
  function backupLaden() {
    var i = document.createElement("input"); i.type = "file"; i.accept = ".fidelia,application/octet-stream,application/json";
    i.onchange = async function () {
      var f = i.files && i.files[0]; if (!f) return;
      try {
        var p = JSON.parse(await f.text()); if (p.fidelia !== "health-backup") throw new Error("Das ist kein FIDELIA-Health-Backup.");
        var pin = prompt("PIN des Backups:"); if (pin === null) return;
        var r = await entsperren(pin.trim(), p).catch(function () { throw new Error("Die PIN passt nicht zum Backup."); });
        if (D && !confirm("Das Backup ersetzt deine jetzigen Einträge. Weiter?")) return;
        localStorage.setItem(KEY, JSON.stringify({ v: 1, s: p.s, iv: p.iv, ct: p.ct })); schluessel = r.k; D = r.d; salz = unb64(p.s); wach(); zeigen(); KW.toast("Backup geladen ✅");
      } catch (e) { KW.toast(e.message || "Das Backup ließ sich nicht laden."); }
    };
    i.click();
  }

  pinSeite();
})();
