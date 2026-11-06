/* FIDELIA Chat – Schritt 1: Konto, Kontakt-Code, verschlüsselter Text-Chat, Blockieren, Melden */
(function () {
  "use strict";
  var K = window.FCK, L = window.FC.lokal, esc = KW.esc;
  var $ = function (id) { return document.getElementById(id); };
  var TAG = 864e5;

  var B = null;          // Server
  var ich = null;        // eigenes Profil {cid, name, em, farbe, ek, fp, code, lesen}
  var priv = null;       // geheimer Schlüssel (CryptoKey, nicht exportierbar)
  var kontakte = {};     // cid → Kontakt
  var nachrichten = {};  // cid → [Nachricht]
  var anfragen = {};     // cid → {zeit, profil}
  var aktiv = null;      // offener Chat (cid)
  var einladung = null;  // {k, fp} aus Link/QR
  var meineCodes = [];   // [{k, bis, einmal}]
  var ausstehend = {};   // cid → fp (Anfragen, die ich geschickt habe)
  var abos = [];

  var EMOJIS = ["🦊", "🐼", "🐸", "🐱", "🐶", "🦁", "🐯", "🐵", "🐧", "🦄", "🐙", "🐝", "🐢", "🦖", "🚀", "⭐", "🌈", "⚽", "🎮", "🎧", "🍕", "🌻"];
  var FARBEN = ["#4338ca", "#0f766e", "#b8235a", "#c2410c", "#15803d", "#6d3fd6", "#0369a1", "#a36b00"];

  /* ---------- Hilfen ---------- */
  function seite(id) { ["seiteStart", "seiteListe", "seiteChat"].forEach(function (s) { $(s).classList.toggle("an", s === id); }); $("lade").hidden = true; $("fuss").hidden = id === "seiteChat"; }
  var fenster = $("fenster"), fensterIn = $("fensterIn");
  function oeffne(html, setup) { fensterIn.innerHTML = html; if (!fenster.open) fenster.showModal(); if (setup) setup(fensterIn); var f = fensterIn.querySelector("[autofocus]"); if (f) f.focus(); }
  var zwang = false; // Fenster darf nicht mit Esc/Tippen daneben geschlossen werden
  fenster.addEventListener("cancel", function (e) { if (zwang) e.preventDefault(); });
  function zu() { zwang = false; kameraAus(); if (fenster.open) fenster.close(); fensterIn.innerHTML = ""; }
  fenster.addEventListener("close", function () { kameraAus(); if (!fenster.open) setTimeout(function () { if (!fenster.open) fensterIn.innerHTML = ""; }, 0); });
  fenster.addEventListener("click", function (e) { if (e.target === fenster && !zwang) zu(); });
  function ava(k, klein) { return '<span class="ava' + (klein ? " klein" : "") + '" style="background:' + esc(k.farbe || "#4338ca") + '" aria-hidden="true">' + esc(k.em || "🙂") + "</span>"; }
  function uhr(t) { var d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function tagText(t) {
    var d = new Date(t), h = new Date(); h.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var diff = Math.round((h - x) / TAG);
    if (diff === 0) return "Heute"; if (diff === 1) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: diff < 7 ? "long" : undefined, day: "numeric", month: "long", year: d.getFullYear() !== h.getFullYear() ? "numeric" : undefined });
  }
  function kurzZeit(t) { var d = new Date(t); return Date.now() - t < TAG && d.getDate() === new Date().getDate() ? uhr(t) : tagText(t); }
  function fehlerText(e) {
    var m = String(e && (e.code || e.message) || e);
    if (/permission|PERMISSION_DENIED/i.test(m)) return "Der Server hat das abgelehnt.";
    return m;
  }
  function speichereIch() { return L.leg("ich", ich, "profil"); }
  function speichereKontakt(k) { return L.leg("kontakte", k); }
  function speichereNachricht(n) { return L.leg("nachrichten", n); }
  function eigeneDaten() { return L.leg("ich", { codes: meineCodes, ausstehend: ausstehend }, "mehr"); }

  /* ---------- Start ---------- */
  async function start() {
    lesHash();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }
    try {
      ich = await L.hol("ich", "profil");
      priv = await L.hol("ich", "priv");
      var mehr = (await L.hol("ich", "mehr")) || {};
      meineCodes = mehr.codes || []; ausstehend = mehr.ausstehend || {};
    } catch (e) {
      $("lade").textContent = "Dein Browser erlaubt hier keinen Speicher. Öffne FIDELIA Chat bitte nicht im privaten Modus.";
      return;
    }
    if (!ich || !priv) { startSeite(); return; }
    (await L.alle("kontakte")).forEach(function (k) { kontakte[k.cid] = k; });
    (await L.alle("nachrichten")).forEach(function (n) { (nachrichten[n.chat] = nachrichten[n.chat] || []).push(n); });
    Object.keys(nachrichten).forEach(function (c) { nachrichten[c].sort(function (a, b) { return a.zeit - b.zeit; }); });
    seite("seiteListe"); $("knopfEinst").hidden = false; liste();
    verbinden();
  }
  function lesHash() {
    var m = location.hash.match(/k=([A-Za-z0-9_-]{16,32})\.([a-f0-9]{32})/);
    if (m) { einladung = { k: m[1], fp: m[2] }; history.replaceState(null, "", location.pathname + location.search); }
  }
  window.addEventListener("hashchange", function () { lesHash(); if (einladung && ich && B) codeEinloesen(einladung); });

  async function server() {
    if (B) return B;
    B = await window.FC.server();
    return B;
  }

  async function verbinden() {
    try { await server(); }
    catch (e) { $("offline").hidden = false; $("offline").textContent = "Keine Verbindung zum Chat-Server. Neuer Versuch in 20 Sekunden …"; setTimeout(verbinden, 20000); return; }
    try {
      // Dieses Gerät gehört zum Konto (beweist das Schloss aus dem Wiederherstellungs-Code)
      await B.setz("geraete/" + ich.cid + "/" + B.uid, await K.schloss(ich.code));
    } catch (e) { KW.toast("Anmelden am Server hat nicht geklappt: " + fehlerText(e)); }
    abos.forEach(function (u) { u(); }); abos = [];
    abos.push(B.verbunden(function (an) { $("offline").hidden = an; $("offline").textContent = "Keine Verbindung – Nachrichten werden gesendet, sobald du wieder online bist."; }));
    abos.push(B.wert("kontakte/" + ich.cid, kontakteAbgleichen));
    abos.push(B.kinder("anfragen/" + ich.cid, anfrageDa, function (cid) { delete anfragen[cid]; anfragenZeigen(); }));
    abos.push(B.kinder("post/" + ich.cid, empfangen));
    abos.push(B.kinder("quittung/" + ich.cid, quittungDa));
    abos.push(B.meldungen(meldungenDa));
    // Unversendete Nachrichten nochmal schicken
    Object.keys(nachrichten).forEach(function (c) { nachrichten[c].forEach(function (n) { if (n.von === ich.cid && n.st === 0) zustellen(n); }); });
    // alte eigene Kontakt-Codes aufräumen
    var jetzt = Date.now();
    meineCodes = meineCodes.filter(function (c) { if (c.bis < jetzt) { B.weg("codes/" + c.k).catch(function () {}); return false; } return true; });
    eigeneDaten();
    if (einladung) codeEinloesen(einladung);
  }

  function startSeite() {
    seite("seiteStart");
    var e = $("startEinladung");
    if (einladung) { e.hidden = false; e.innerHTML = "<b>🎉 Du wurdest eingeladen!</b><br>Leg dir ein Konto an – danach geht die Kontaktanfrage automatisch raus."; }
    else { e.hidden = false; e.innerHTML = "<b>Am Anfang nur mit Einladung:</b> Lass dir von jemandem, der FIDELIA Chat schon benutzt, den Kontakt-Code zeigen und scanne ihn mit der Kamera – oder öffne den Link, den er dir schickt."; }
  }
  $("knopfNeu").onclick = function () { profilFenster(null); };
  $("knopfZurueck").onclick = zurueckholenFenster;

  /* ---------- Konto anlegen ---------- */
  function profilFenster(alt) {
    var wahl = { em: alt ? alt.em : EMOJIS[Math.floor(Math.random() * EMOJIS.length)], farbe: alt ? alt.farbe : FARBEN[Math.floor(Math.random() * FARBEN.length)] };
    oeffne('<h2>' + (alt ? "Dein Profil" : "Dein Konto") + '</h2>' +
      '<label class="field"><span>Spitzname (den sehen deine Kontakte)</span><input class="inp" id="pName" maxlength="30" autocomplete="nickname" value="' + esc(alt ? alt.name : "") + '" autofocus></label>' +
      '<div class="field"><span>Bild</span><div class="emojis" id="pEm">' + EMOJIS.map(function (x) { return '<button type="button" data-e="' + x + '" aria-label="' + x + '" aria-pressed="' + (x === wahl.em) + '">' + x + "</button>"; }).join("") + "</div></div>" +
      '<div class="field"><span>Farbe</span><div class="farbwahl" id="pFarbe">' + FARBEN.map(function (x, i) { return '<button type="button" data-f="' + x + '" style="background:' + x + '" aria-label="Farbe ' + (i + 1) + '" aria-pressed="' + (x === wahl.farbe) + '"></button>'; }).join("") + "</div></div>" +
      (alt ? "" : '<p class="muted" style="font-size:.88rem">Bitte nicht deinen echten vollen Namen. Bist du unter 16? Dann sprich vorher mit deinen Eltern – sie müssen zustimmen.</p>') +
      '<div class="sheet-foot"><button class="btn" type="button" id="pAbbr">Abbrechen</button><button class="btn primary" type="button" id="pOk">' + (alt ? "Speichern" : "Weiter") + "</button></div>",
      function (w) {
        w.querySelector("#pEm").onclick = function (e) { var b = e.target.closest("[data-e]"); if (!b) return; wahl.em = b.dataset.e; w.querySelectorAll("#pEm button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
        w.querySelector("#pFarbe").onclick = function (e) { var b = e.target.closest("[data-f]"); if (!b) return; wahl.farbe = b.dataset.f; w.querySelectorAll("#pFarbe button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); }); };
        w.querySelector("#pAbbr").onclick = zu;
        w.querySelector("#pOk").onclick = async function () {
          var name = w.querySelector("#pName").value.trim().replace(/\s+/g, " ");
          if (!name) { KW.toast("Bitte gib einen Spitznamen ein."); return; }
          this.disabled = true;
          if (alt) {
            try { await server(); await B.setz("nutzer/" + ich.cid + "/name", name); await B.setz("nutzer/" + ich.cid + "/em", wahl.em); await B.setz("nutzer/" + ich.cid + "/farbe", wahl.farbe); ich.name = name; ich.em = wahl.em; ich.farbe = wahl.farbe; await speichereIch(); zu(); KW.toast("Profil gespeichert."); }
            catch (e) { this.disabled = false; KW.toast("Speichern hat nicht geklappt: " + fehlerText(e)); }
            return;
          }
          this.textContent = "Konto wird angelegt …";
          try { await kontoAnlegen(name, wahl.em, wahl.farbe); }
          catch (e) { this.disabled = false; this.textContent = "Weiter"; KW.toast(e.message || "Das hat nicht geklappt."); }
        };
      });
  }

  async function kontoAnlegen(name, em, farbe) {
    await server().catch(function () { throw new Error("Keine Verbindung zum Chat-Server. Bist du online?"); });
    var code = K.neuerCode(), paar = await K.neuesPaar(), ek = await K.oeffentlich(paar), fp = await K.fingerabdruck(ek), cid = K.id(12);
    var schloss = await K.schloss(code), tresor = await K.tresorName(code);
    var per = null;
    if (einladung) {
      var c = await B.hol("codes/" + einladung.k).catch(function () { return null; });
      if (!c || c.bis < Date.now()) { einladung = null; throw new Error("Dieser Einladungs-Code ist abgelaufen. Lass dir einen neuen zeigen."); }
      per = einladung.k;
    }
    await B.setz("schloss/" + cid, schloss);
    await B.setz("geraete/" + cid + "/" + B.uid, schloss);
    var profil = { name: name, em: em, farbe: farbe, ek: ek, fp: fp, zeit: B.TS };
    if (per) profil.per = per;
    try { await B.setz("nutzer/" + cid, profil); }
    catch (e) { throw new Error(per ? "Das Anlegen wurde abgelehnt. Versuch es mit einem neuen Code." : "Du brauchst eine Einladung: Scanne zuerst den Kontakt-Code von jemandem, der FIDELIA Chat schon benutzt."); }
    var jwk = await K.privatExport(paar);
    await B.setz("tresor/" + tresor, await K.tresorZu(code, { cid: cid, priv: jwk, v: 1 }));
    priv = await K.privatImport(jwk, false);
    ich = { cid: cid, name: name, em: em, farbe: farbe, ek: ek, fp: fp, code: code, lesen: true, angelegt: Date.now() };
    await L.leg("ich", priv, "priv"); await speichereIch();
    codeZeigenFenster(true);
  }

  function codeZeigenFenster(neu) {
    oeffne("<h2>" + (neu ? "Dein Wiederherstellungs-Code" : "Wiederherstellungs-Code") + "</h2>" +
      "<p>Mit diesem Code kommst du auf einem neuen Handy wieder in dein Konto. <b>Schreib ihn auf Papier</b> und heb ihn gut auf.</p>" +
      '<div class="codebox" id="cCode">' + esc(ich.code) + "</div>" +
      '<div class="warn">⚠️ Zeig ihn niemandem – wer den Code hat, kann dein Konto benutzen. Wir können ihn nicht zurücksetzen, weil wir ihn nicht kennen.</div>' +
      (neu ? '<label class="hak"><input type="checkbox" id="cOk"> Ich habe den Code aufgeschrieben.</label>' : "") +
      '<div class="sheet-foot"><button class="btn" type="button" id="cKopie">Kopieren</button><span class="sp"></span><button class="btn primary" type="button" id="cWeiter"' + (neu ? " disabled" : "") + ">" + (neu ? "Fertig" : "Schließen") + "</button></div>",
      function (w) {
        w.querySelector("#cKopie").onclick = function () { navigator.clipboard && navigator.clipboard.writeText(ich.code).then(function () { KW.toast("Kopiert – füge ihn an einem sicheren Ort ein."); }); };
        if (neu) w.querySelector("#cOk").onchange = function () { w.querySelector("#cWeiter").disabled = !this.checked; };
        w.querySelector("#cWeiter").onclick = function () { zu(); if (neu) { seite("seiteListe"); $("knopfEinst").hidden = false; liste(); verbinden(); } };
      });
    zwang = !!neu;
  }

  function zurueckholenFenster() {
    oeffne('<h2>Konto zurückholen</h2><p>Gib deinen Wiederherstellungs-Code ein.</p>' +
      '<label class="field"><span>Code (20 Zeichen)</span><input class="inp" id="zCode" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" spellcheck="false" autofocus></label>' +
      '<p class="muted" style="font-size:.88rem">Deine Kontakte kommen zurück. Alte Nachrichten lagen nur auf dem alten Handy und sind dort geblieben.</p>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="zAbbr">Abbrechen</button><button class="btn primary" type="button" id="zOk">Zurückholen</button></div>',
      function (w) {
        w.querySelector("#zAbbr").onclick = zu;
        w.querySelector("#zOk").onclick = async function () {
          var code = K.codeSauber(w.querySelector("#zCode").value);
          if (!code) { KW.toast("Der Code hat 20 Zeichen – prüf ihn nochmal."); return; }
          var knopf = this; knopf.disabled = true; knopf.textContent = "Wird geprüft …";
          try {
            await server();
            var t = await B.hol("tresor/" + (await K.tresorName(code)));
            if (!t) throw new Error("Zu diesem Code gibt es kein Konto.");
            var inhalt = await K.tresorAuf(code, t).catch(function () { throw new Error("Der Code passt nicht."); });
            await B.setz("geraete/" + inhalt.cid + "/" + B.uid, await K.schloss(code));
            var p = await B.hol("nutzer/" + inhalt.cid);
            if (!p) throw new Error("Das Konto gibt es nicht mehr.");
            priv = await K.privatImport(inhalt.priv, false);
            ich = { cid: inhalt.cid, name: p.name, em: p.em, farbe: p.farbe, ek: p.ek, fp: p.fp, code: code, lesen: true, angelegt: Date.now() };
            await L.leg("ich", priv, "priv"); await speichereIch();
            zu(); seite("seiteListe"); $("knopfEinst").hidden = false; liste(); verbinden();
            KW.toast("Willkommen zurück, " + p.name + "!");
          } catch (e) { knopf.disabled = false; knopf.textContent = "Zurückholen"; KW.toast(e.message || fehlerText(e)); }
        };
      });
  }

  /* ---------- Kontakte ---------- */
  var abgleich = Promise.resolve(), wartend = {};
  function kontakteAbgleichen(l) { abgleich = abgleich.then(function () { return abgleichen(l); }).catch(function () {}).then(function () { Object.keys(wartend).forEach(function (key) { var m = wartend[key]; delete wartend[key]; empfangen(key, m); }); }); }
  async function abgleichen(liste_) {
    liste_ = liste_ || {};
    var geaendert = false;
    for (var cid in liste_) {
      var st = liste_[cid] === "blockiert" ? "blockiert" : "ok";
      var k = kontakte[cid];
      if (!k || !k.ek) {
        var p = await B.hol("nutzer/" + cid).catch(function () { return null; });
        if (!p) continue;
        var geprueft = !!(ausstehend[cid] && ausstehend[cid] === (await K.fingerabdruck(p.ek)));
        k = kontakte[cid] = { cid: cid, name: p.name, em: p.em, farbe: p.farbe, ek: p.ek, fp: p.fp, status: st, geprueft: geprueft, seit: Date.now() };
        if (ausstehend[cid]) { delete ausstehend[cid]; eigeneDaten(); }
        if (st === "ok" && !(nachrichten[cid] || []).length) KW.toast(p.em + " " + p.name + " ist jetzt dein Kontakt.");
        await speichereKontakt(k); geaendert = true;
      } else if (k.status !== st) { k.status = st; await speichereKontakt(k); geaendert = true; }
    }
    for (var c in kontakte) if (!(c in liste_) && kontakte[c].status !== "entfernt") { kontakte[c].status = "entfernt"; await speichereKontakt(kontakte[c]); geaendert = true; }
    profileAuffrischen();
    if (geaendert) { liste(); if (aktiv) chatKopf(); }
  }
  var aufgefrischt = false;
  function profileAuffrischen() {
    if (aufgefrischt) return; aufgefrischt = true;
    Object.keys(kontakte).forEach(function (cid) {
      B.hol("nutzer/" + cid).then(function (p) {
        var k = kontakte[cid]; if (!p || !k) return;
        if (p.ek !== k.ek) { k.schluesselNeu = true; } // darf nicht passieren – der Server erlaubt keinen Schlüsseltausch
        if (p.name !== k.name || p.em !== k.em || p.farbe !== k.farbe) { k.name = p.name; k.em = p.em; k.farbe = p.farbe; speichereKontakt(k); liste(); if (aktiv === cid) chatKopf(); }
      }).catch(function () {});
    });
  }

  async function anfrageDa(cid, a) {
    if (kontakte[cid] && kontakte[cid].status === "ok") { B.weg("anfragen/" + ich.cid + "/" + cid).catch(function () {}); return; }
    var p = await B.hol("nutzer/" + cid).catch(function () { return null; });
    if (!p) return;
    anfragen[cid] = { zeit: a.zeit, profil: p };
    anfragenZeigen();
  }
  function anfragenZeigen() {
    var ids = Object.keys(anfragen);
    $("anfragen").innerHTML = ids.length ? '<h2 class="sec">Neue Kontaktanfragen</h2>' + ids.map(function (cid) {
      var p = anfragen[cid].profil;
      return '<div class="card anfrage">' + ava(p) + '<div class="wer"><b>' + esc(p.name) + "</b><small>möchte mit dir chatten · " + esc(kurzZeit(anfragen[cid].zeit || Date.now())) + "</small></div>" +
        '<button class="btn primary small" type="button" data-an="ja" data-c="' + cid + '">Annehmen</button><button class="btn small" type="button" data-an="nein" data-c="' + cid + '">Ablehnen</button><button class="btn small danger" type="button" data-an="block" data-c="' + cid + '">Blockieren</button></div>';
    }).join("") : "";
  }
  $("anfragen").onclick = async function (e) {
    var b = e.target.closest("[data-an]"); if (!b) return;
    var cid = b.dataset.c, a = anfragen[cid]; if (!a) return;
    b.disabled = true;
    try {
      if (b.dataset.an === "ja") {
        await B.setz("kontakte/" + ich.cid + "/" + cid, true);
        await B.setz("kontakte/" + cid + "/" + ich.cid, true);
        KW.toast(a.profil.name + " ist jetzt dein Kontakt. Tipp: Vergleicht in den Kontakt-Infos eure Sicherheitsnummer.");
      } else if (b.dataset.an === "block") {
        await B.setz("kontakte/" + ich.cid + "/" + cid, "blockiert");
        KW.toast(a.profil.name + " ist blockiert.");
      }
      await B.weg("anfragen/" + ich.cid + "/" + cid);
      delete anfragen[cid]; anfragenZeigen();
    } catch (err) { b.disabled = false; KW.toast("Das hat nicht geklappt: " + fehlerText(err)); }
  };

  /* ---------- Liste ---------- */
  function letzte(cid) { var l = nachrichten[cid]; return l && l.length ? l[l.length - 1] : null; }
  function ungelesen(cid) { return (nachrichten[cid] || []).filter(function (n) { return n.von !== ich.cid && !n.gelesen; }).length; }
  function liste() {
    if (!ich) return;
    var q = ($("suche").value || "").trim().toLowerCase();
    var ids = Object.keys(kontakte).filter(function (c) { return kontakte[c].status !== "entfernt" || (nachrichten[c] || []).length; });
    $("sucheLeiste").hidden = ids.length < 6;
    ids = ids.filter(function (c) { return !q || kontakte[c].name.toLowerCase().indexOf(q) >= 0; });
    ids.sort(function (a, b) { var x = letzte(a), y = letzte(b); return (y ? y.zeit : kontakte[b].seit || 0) - (x ? x.zeit : kontakte[a].seit || 0); });
    var gesamt = 0;
    $("chats").innerHTML = ids.length ? ids.map(function (cid) {
      var k = kontakte[cid], n = letzte(cid), u = ungelesen(cid); gesamt += u;
      var vor = n ? (n.von === ich.cid ? "Du: " : "") + n.text : (k.status === "ok" ? "Sag Hallo 👋" : "");
      var schild = k.status === "blockiert" ? '<span class="schild">blockiert</span>' : k.status === "entfernt" ? '<span class="schild">nicht mehr verbunden</span>' : "";
      return '<button class="chatzeile" type="button" data-c="' + cid + '">' + ava(k) + '<span class="mitte"><span class="name">' + esc(k.name) + (k.geprueft ? ' <span title="Schlüssel geprüft" aria-label="geprüft">✅</span>' : "") + schild + '</span><span class="vor">' + esc(vor) + '</span></span><span class="rechts">' + (n ? esc(kurzZeit(n.zeit)) : "") + (u ? '<span class="zahl" aria-label="' + u + ' ungelesen">' + u + "</span>" : "") + "</span></button>";
    }).join("") : '<div class="empty"><b>Noch keine Chats</b>Tippe auf ＋, um deinen Kontakt-Code zu zeigen oder den von jemand anderem zu scannen.</div>';
    document.title = (gesamt ? "(" + gesamt + ") " : "") + "FIDELIA Chat";
    installHinweis();
  }
  $("suche").oninput = liste;
  $("chats").onclick = function (e) { var b = e.target.closest("[data-c]"); if (b) chatOeffnen(b.dataset.c); };
  function installHinweis() {
    var alleinst = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
    var weg = false; try { weg = localStorage.getItem("fchat-banner-weg") === "1"; } catch (e) { /* egal */ }
    $("installBanner").hidden = alleinst || weg;
  }
  $("bannerWeg").onclick = function () { try { localStorage.setItem("fchat-banner-weg", "1"); } catch (e) { /* egal */ } $("installBanner").hidden = true; };

  /* ---------- Kontakt hinzufügen: Code zeigen / scannen ---------- */
  $("knopfPlus").onclick = function () { plusFenster("zeigen"); };
  function linkVon(c) { return location.origin + location.pathname + "#k=" + c.k + "." + ich.fp; }
  async function aktuellerCode(einmal, neu) {
    var jetzt = Date.now();
    var c = !neu && meineCodes.filter(function (x) { return x.bis - jetzt > 3600e3 && !!x.einmal === !!einmal; })[0];
    if (c) return c;
    if (neu) { for (var i = 0; i < meineCodes.length; i++) await B.weg("codes/" + meineCodes[i].k).catch(function () {}); meineCodes = []; }
    c = { k: K.token(), bis: jetzt + TAG - 120000, einmal: !!einmal };
    await B.setz("codes/" + c.k, { cid: ich.cid, bis: c.bis, einmal: c.einmal });
    meineCodes.push(c); await eigeneDaten();
    return c;
  }
  function plusFenster(reiter) {
    oeffne('<h2>Kontakt hinzufügen</h2><div class="tabs" role="tablist"><button type="button" role="tab" data-r="zeigen" aria-selected="' + (reiter === "zeigen") + '">📱 Mein Code</button><button type="button" role="tab" data-r="scannen" aria-selected="' + (reiter === "scannen") + '">📷 Code scannen</button></div><div id="plusInhalt" style="margin-top:14px"></div><div class="sheet-foot"><button class="btn primary" type="button" id="plusZu">Fertig</button></div>',
      function (w) {
        w.querySelector(".tabs").onclick = function (e) { var b = e.target.closest("[data-r]"); if (!b) return; w.querySelectorAll(".tabs button").forEach(function (x) { x.setAttribute("aria-selected", x === b); }); kameraAus(); (b.dataset.r === "zeigen" ? codeTab : scanTab)(w.querySelector("#plusInhalt")); };
        w.querySelector("#plusZu").onclick = zu;
        (reiter === "zeigen" ? codeTab : scanTab)(w.querySelector("#plusInhalt"));
      });
  }
  var einmalWahl = false;
  async function codeTab(el, neu) {
    el.innerHTML = '<div class="lade" style="padding:30px 0">Code wird gemacht …</div>';
    try { await server(); var c = await aktuellerCode(einmalWahl, neu); }
    catch (e) { el.innerHTML = '<p class="warn">Gerade keine Verbindung zum Server. Versuch es gleich nochmal.</p>'; return; }
    var link = linkVon(c), rest = Math.max(1, Math.round((c.bis - Date.now()) / 3600e3));
    el.innerHTML = '<div class="qr" id="qr" aria-label="QR-Code mit deinem Kontakt-Code"></div>' +
      '<p class="muted" style="text-align:center;margin:4px 0 10px;font-size:.9rem">Lass ihn scannen, oder schick den Link an jemanden, den du kennst.<br>Gültig noch ' + rest + " Std." + (c.einmal ? " · nur einmal benutzbar" : "") + "</p>" +
      '<div class="codezeile"><input class="inp" readonly value="' + esc(link) + '" aria-label="Dein Kontakt-Link"><button class="btn" type="button" id="cTeilen">' + (navigator.share ? "Teilen" : "Kopieren") + "</button></div>" +
      '<label class="hak"><input type="checkbox" id="cEinmal"' + (einmalWahl ? " checked" : "") + "> Nur einmal benutzbar (für Links, die weitergeschickt werden könnten)</label>" +
      '<button class="btn small" type="button" id="cNeu">🔄 Neuen Code machen (alte werden ungültig)</button>' +
      '<p class="muted" style="font-size:.85rem;margin-top:12px">Wer deinen Code benutzt, schickt dir nur eine Anfrage – du entscheidest, ob du sie annimmst.</p>';
    qrMalen(el.querySelector("#qr"), link);
    el.querySelector("#cTeilen").onclick = function () {
      if (navigator.share) navigator.share({ title: "FIDELIA Chat", text: "Schreib mir in FIDELIA Chat (Link gilt 24 Stunden):", url: link }).catch(function () {});
      else navigator.clipboard.writeText(link).then(function () { KW.toast("Link kopiert."); });
    };
    el.querySelector("#cEinmal").onchange = function () { einmalWahl = this.checked; codeTab(el); };
    el.querySelector("#cNeu").onclick = function () { codeTab(el, true); KW.toast("Neuer Code – die alten gelten nicht mehr."); };
  }
  function qrMalen(el, text) {
    if (!window.qrcode) { var s = document.createElement("script"); s.src = "../shared/vendor/qr/qrcode.js"; s.onload = function () { qrMalen(el, text); }; document.head.appendChild(s); return; }
    var q = window.qrcode(0, "M"); q.addData(text); q.make();
    el.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }

  var kameraStrom = null, kameraTimer = null;
  function kameraAus() { clearInterval(kameraTimer); kameraTimer = null; if (kameraStrom) { kameraStrom.getTracks().forEach(function (t) { t.stop(); }); kameraStrom = null; } }
  function scanTab(el) {
    el.innerHTML = '<video id="kamera" playsinline muted aria-label="Kamerabild"></video><p class="muted" id="scanInfo" style="text-align:center;font-size:.9rem">Halte die Kamera auf den QR-Code.</p>' +
      '<label class="field"><span>Oder Link hier einfügen</span><div class="codezeile" style="margin:0"><input class="inp" id="sLink" placeholder="https://…#k=…" autocomplete="off"><button class="btn primary" type="button" id="sOk">OK</button></div></label>';
    el.querySelector("#sOk").onclick = function () { var c = codeAusText(el.querySelector("#sLink").value); if (c) { zu(); codeEinloesen(c); } else KW.toast("Das ist kein FIDELIA-Chat-Link."); };
    var video = el.querySelector("#kamera");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { video.hidden = true; el.querySelector("#scanInfo").textContent = "Dein Browser kann hier keine Kamera benutzen – füg den Link ein."; return; }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }).then(function (s) {
      kameraStrom = s; video.srcObject = s; video.play().catch(function () {});
      var leser = null, c = document.createElement("canvas"), g = c.getContext("2d", { willReadFrequently: true });
      if ("BarcodeDetector" in window) { try { leser = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch (e) { leser = null; } }
      if (!leser && !window.jsQR) { var sk = document.createElement("script"); sk.src = "../shared/vendor/qr/jsQR.js"; document.head.appendChild(sk); }
      kameraTimer = setInterval(function () {
        if (!video.videoWidth) return;
        var fund = function (text) { var code = codeAusText(text); if (code) { kameraAus(); zu(); codeEinloesen(code); } };
        if (leser) { leser.detect(video).then(function (r) { if (r && r[0]) fund(r[0].rawValue); }).catch(function () {}); return; }
        if (!window.jsQR) return;
        var w = Math.min(640, video.videoWidth), h = Math.round(video.videoHeight * w / video.videoWidth);
        c.width = w; c.height = h; g.drawImage(video, 0, 0, w, h);
        var r = window.jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (r) fund(r.data);
      }, 300);
    }).catch(function () { video.hidden = true; el.querySelector("#scanInfo").textContent = "Kein Zugriff auf die Kamera. Erlaube die Kamera oder füg den Link ein."; });
  }
  function codeAusText(t) { var m = String(t || "").match(/k=([A-Za-z0-9_-]{16,32})\.([a-f0-9]{32})/); return m ? { k: m[1], fp: m[2] } : null; }

  async function codeEinloesen(code) {
    einladung = null;
    if (!ich) { einladung = code; startSeite(); return; }
    try {
      await server();
      var c = await B.hol("codes/" + code.k);
      if (!c || c.bis < Date.now()) { KW.toast("Dieser Code ist abgelaufen oder wurde schon benutzt. Lass dir einen neuen zeigen."); return; }
      if (c.cid === ich.cid) { KW.toast("Das ist dein eigener Code 😄"); return; }
      var p = await B.hol("nutzer/" + c.cid);
      if (!p || (await K.fingerabdruck(p.ek)) !== code.fp) { KW.toast("⚠️ Dieser Code passt nicht zum Konto. Benutze ihn lieber nicht."); return; }
      if (kontakte[c.cid] && kontakte[c.cid].status === "ok") { if (!kontakte[c.cid].geprueft) { kontakte[c.cid].geprueft = true; speichereKontakt(kontakte[c.cid]); } chatOeffnen(c.cid); return; }
      oeffne('<h2>Kontaktanfrage schicken?</h2><div class="card anfrage" style="box-shadow:none">' + ava(p) + '<div class="wer"><b>' + esc(p.name) + "</b><small>✅ Code geprüft – das ist wirklich dieses Konto.</small></div></div>" +
        '<p class="muted" style="font-size:.9rem">Kennst du diese Person? Schick nur Anfragen an Leute, die du wirklich kennst.</p>' +
        '<div class="sheet-foot"><button class="btn" type="button" id="aAbbr">Abbrechen</button><button class="btn primary" type="button" id="aOk">Anfrage schicken</button></div>',
        function (w) {
          w.querySelector("#aAbbr").onclick = zu;
          w.querySelector("#aOk").onclick = async function () {
            this.disabled = true;
            try {
              ausstehend[c.cid] = code.fp; await eigeneDaten();
              await B.setz("anfragen/" + c.cid + "/" + ich.cid, { code: code.k, zeit: B.TS });
              if (c.einmal) await B.weg("codes/" + code.k).catch(function () {});
              zu(); KW.toast("Anfrage an " + p.name + " geschickt. Sobald sie angenommen ist, könnt ihr chatten.");
            } catch (e) { this.disabled = false; KW.toast("Die Anfrage ging nicht durch: " + fehlerText(e)); }
          };
        });
    } catch (e) { KW.toast("Das hat nicht geklappt: " + fehlerText(e)); }
  }

  /* ---------- Chat ---------- */
  function chatOeffnen(cid) {
    if (!kontakte[cid]) return;
    zu(); aktiv = cid; seite("seiteChat"); chatKopf(); verlauf(true); gelesenMarkieren();
    history.pushState({ chat: cid }, "");
    if (matchMedia("(pointer:fine)").matches) $("text").focus();
  }
  function chatZu() { aktiv = null; seite("seiteListe"); liste(); }
  $("chatZurueck").onclick = function () { if (history.state && history.state.chat) history.back(); else chatZu(); };
  window.addEventListener("popstate", function () { if (aktiv) chatZu(); });
  function chatKopf() {
    var k = kontakte[aktiv]; if (!k) return;
    $("chatAva").style.background = k.farbe; $("chatAva").textContent = k.em;
    $("chatName").textContent = k.name;
    $("chatUnter").textContent = k.status === "blockiert" ? "blockiert" : k.status === "entfernt" ? "nicht mehr verbunden" : (k.geprueft ? "✅ geprüft · " : "") + "🔒 verschlüsselt";
    var gesperrt = k.status !== "ok";
    $("eingabe").hidden = gesperrt; $("gesperrt").hidden = !gesperrt;
    $("gesperrt").innerHTML = k.status === "blockiert" ? 'Du hast ' + esc(k.name) + ' blockiert. <button class="btn small" type="button" id="entsperren">Freigeben</button>' : "Ihr seid nicht mehr verbunden. Für einen neuen Chat braucht ihr einen neuen Kontakt-Code.";
    var e = $("entsperren"); if (e) e.onclick = function () { blockieren(aktiv, false); };
  }
  function verlauf(nachUnten) {
    var el = $("verlauf"), unten = nachUnten || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    var l = nachrichten[aktiv] || [], h = '<div class="info">🔒 Nachrichten in diesem Chat sind Ende-zu-Ende verschlüsselt. Nur ihr beide könnt sie lesen.</div>', tag = "";
    l.forEach(function (n) {
      var t = tagText(n.zeit); if (t !== tag) { tag = t; h += '<div class="tag">' + esc(t) + "</div>"; }
      var mein = n.von === ich.cid, nurEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,8}$/u.test(n.text) && !/^[0-9#*]+$/.test(n.text);
      var st = mein ? (n.st === -1 ? "⚠️ nicht zugestellt – antippen" : n.st === 0 ? "🕓" : n.st === 1 ? "✓" : n.st === 2 ? "✓✓" : '<span class="st3" aria-label="gelesen">✓✓</span>') : "";
      h += '<div class="blase' + (mein ? " ich" : "") + (n.st === -1 ? " fehler" : "") + (nurEmoji ? " gross" : "") + '" data-id="' + esc(n.id) + '">' + esc(n.text) + '<div class="fuss">' + uhr(n.zeit) + (st ? " " + st : "") + "</div></div>";
    });
    el.innerHTML = h;
    if (unten) el.scrollTop = el.scrollHeight;
  }
  $("verlauf").onclick = function (e) {
    var b = e.target.closest(".blase.fehler"); if (!b) return;
    var n = (nachrichten[aktiv] || []).filter(function (x) { return x.id === b.dataset.id; })[0];
    if (n) { n.st = 0; speichereNachricht(n); verlauf(); zustellen(n); }
  };
  var feld = $("text");
  feld.addEventListener("input", function () { $("senden").disabled = !this.value.trim(); this.style.height = "auto"; this.style.height = Math.min(140, this.scrollHeight) + "px"; });
  feld.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("eingabe").requestSubmit(); } });
  $("eingabe").onsubmit = function (e) {
    e.preventDefault();
    var t = feld.value.trim(); if (!t || !aktiv || !B) { if (!B) KW.toast("Noch keine Verbindung – gleich nochmal."); return; }
    var n = { id: B.neuKey("post/" + aktiv), chat: aktiv, von: ich.cid, text: t.slice(0, 4000), zeit: Date.now(), st: 0 };
    (nachrichten[aktiv] = nachrichten[aktiv] || []).push(n);
    speichereNachricht(n); feld.value = ""; feld.style.height = "auto"; $("senden").disabled = true;
    verlauf(true); zustellen(n);
  };
  async function zustellen(n) {
    var k = kontakte[n.chat]; if (!k || !B) return;
    try {
      var s = await K.gemeinsam(priv, ich.cid, k.cid, k.ek);
      var v = await K.verschluesseln(s, { t: n.text, z: n.zeit }, ich.cid + ">" + k.cid + ">" + n.id);
      await B.setz("post/" + k.cid + "/" + n.id, { von: ich.cid, iv: v.iv, ct: v.ct, zeit: B.TS });
      if (n.st < 1) n.st = 1;
    } catch (e) { n.st = -1; }
    speichereNachricht(n);
    if (aktiv === n.chat) verlauf(); else liste();
  }

  async function empfangen(key, m) {
    if (!m || !m.von) return;
    var k = kontakte[m.von];
    var schon = (nachrichten[m.von] || []).some(function (x) { return x.id === key; });
    if (!k || !k.ek) { wartend[key] = m; return; } // Kontakt wird gerade noch geladen
    if (k.status !== "ok" || schon) { B.weg("post/" + ich.cid + "/" + key).catch(function () {}); return; }
    var text;
    try {
      var s = await K.gemeinsam(priv, ich.cid, k.cid, k.ek);
      text = String((await K.entschluesseln(s, m.iv, m.ct, m.von + ">" + ich.cid + ">" + key)).t || "");
    } catch (e) { text = "⚠️ Diese Nachricht konnte nicht entschlüsselt werden."; }
    var n = { id: key, chat: m.von, von: m.von, text: text, zeit: m.zeit || Date.now(), gelesen: false };
    (nachrichten[m.von] = nachrichten[m.von] || []).push(n);
    nachrichten[m.von].sort(function (a, b) { return a.zeit - b.zeit; });
    await speichereNachricht(n);
    B.weg("post/" + ich.cid + "/" + key).catch(function () {});
    B.setz("quittung/" + m.von + "/" + key, { von: ich.cid, a: 1 }).catch(function () {});
    if (aktiv === m.von) { verlauf(); gelesenMarkieren(); }
    else { liste(); if (!document.hidden) KW.toast(k.em + " " + k.name + ": " + text.slice(0, 60), "Öffnen", function () { chatOeffnen(k.cid); }); }
  }
  function gelesenMarkieren() {
    if (!aktiv || document.hidden) return;
    (nachrichten[aktiv] || []).forEach(function (n) {
      if (n.von === ich.cid || n.gelesen) return;
      n.gelesen = true; speichereNachricht(n);
      if (ich.lesen !== false && B) B.setz("quittung/" + n.von + "/" + n.id, { von: ich.cid, a: 2 }).catch(function () {});
    });
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { gelesenMarkieren(); if (!aktiv) liste(); } });
  function quittungDa(key, q) {
    if (!q) return;
    var l = nachrichten[q.von] || [], n = l.filter(function (x) { return x.id === key; })[0];
    if (n && n.von === ich.cid && n.st < q.a + 1) { n.st = q.a + 1; speichereNachricht(n); if (aktiv === q.von) verlauf(); }
    B.weg("quittung/" + ich.cid + "/" + key).catch(function () {});
  }

  /* ---------- Kontakt-Infos, Blockieren, Melden ---------- */
  $("chatWer").onclick = function () { kontaktFenster(aktiv); };
  async function kontaktFenster(cid) {
    var k = kontakte[cid]; if (!k) return;
    var nr = await K.sicherheitsnummer(ich.ek, k.ek);
    oeffne('<div style="text-align:center">' + ava(k).replace('class="ava"', 'class="ava" style="width:76px;height:76px;font-size:2.4rem;margin:0 auto;background:' + esc(k.farbe) + '"') + '<h2 style="margin:10px 0 2px">' + esc(k.name) + '</h2><p class="muted" style="margin:0 0 14px">' + (k.geprueft ? "✅ Schlüssel geprüft" : "Schlüssel noch nicht geprüft") + "</p></div>" +
      '<div class="field"><span>Sicherheitsnummer – auf beiden Handys muss dieselbe stehen</span><div class="sicher">' + esc(nr) + "</div></div>" +
      (k.geprueft ? "" : '<p class="muted" style="font-size:.88rem">Vergleicht die Zahlen, wenn ihr euch trefft. Wenn sie gleich sind, kann niemand eure Nachrichten mitlesen.</p>') +
      '<div class="menue">' + (k.geprueft ? "" : '<button class="btn" type="button" data-m="pruef">✅ Zahlen sind gleich – als geprüft markieren</button>') +
      (k.status === "ok" ? '<button class="btn" type="button" data-m="block">🚫 Blockieren</button>' : k.status === "blockiert" ? '<button class="btn" type="button" data-m="frei">✅ Blockierung aufheben</button>' : "") +
      '<button class="btn" type="button" data-m="melden">🚩 Melden</button>' +
      '<button class="btn" type="button" data-m="leeren">🧹 Chat-Verlauf löschen</button>' +
      '<button class="btn danger" type="button" data-m="entfernen">🗑️ Kontakt entfernen</button></div>' +
      '<div class="sheet-foot"><button class="btn primary" type="button" data-m="zu">Schließen</button></div>',
      function (w) {
        w.onclick = async function (e) {
          var b = e.target.closest("[data-m]"); if (!b) return;
          var m = b.dataset.m;
          if (m === "zu") zu();
          else if (m === "pruef") { k.geprueft = true; await speichereKontakt(k); zu(); chatKopf(); liste(); KW.toast("Als geprüft markiert ✅"); }
          else if (m === "block") { if (confirm(k.name + " blockieren? Dann kann " + k.name + " dir nichts mehr schicken.")) { zu(); blockieren(cid, true); } }
          else if (m === "frei") { zu(); blockieren(cid, false); }
          else if (m === "melden") meldenFenster(cid);
          else if (m === "leeren") { if (confirm("Alle Nachrichten in diesem Chat auf diesem Handy löschen?")) { await L.chatWeg(cid); nachrichten[cid] = []; zu(); verlauf(true); liste(); } }
          else if (m === "entfernen") {
            if (!confirm(k.name + " entfernen? Ihr könnt euch dann nicht mehr schreiben, bis einer einen neuen Kontakt-Code schickt.")) return;
            try { await B.weg("kontakte/" + ich.cid + "/" + cid); await L.chatWeg(cid); await L.weg("kontakte", cid); delete kontakte[cid]; delete nachrichten[cid]; zu(); chatZu(); KW.toast(k.name + " wurde entfernt."); }
            catch (err) { KW.toast("Das hat nicht geklappt: " + fehlerText(err)); }
          }
        };
      });
  }
  async function blockieren(cid, an) {
    var k = kontakte[cid]; if (!k) return;
    try { await B.setz("kontakte/" + ich.cid + "/" + cid, an ? "blockiert" : true); k.status = an ? "blockiert" : "ok"; await speichereKontakt(k); chatKopf(); liste(); KW.toast(an ? k.name + " ist blockiert." : k.name + " ist wieder freigegeben."); }
    catch (e) { KW.toast("Das hat nicht geklappt: " + fehlerText(e)); }
  }
  function meldenFenster(cid) {
    var k = kontakte[cid], letzteN = (nachrichten[cid] || []).slice(-10);
    oeffne('<h2>' + esc(k.name) + ' melden</h2><p class="muted" style="font-size:.9rem">Die Meldung geht an das OMNIVIA-Team. Nur was du hier mitschickst, können wir sehen – sonst ist alles verschlüsselt.</p>' +
      '<label class="field"><span>Was ist passiert?</span><select class="inp" id="mGrund"><option>Beleidigung oder Mobbing</option><option>Unangenehme oder unpassende Nachrichten</option><option>Jemand gibt sich als jemand anderes aus</option><option>Spam oder Werbung</option><option>Etwas anderes</option></select></label>' +
      '<label class="field"><span>Was möchtest du noch sagen? (freiwillig)</span><textarea class="inp" id="mText" maxlength="600"></textarea></label>' +
      (letzteN.length ? '<label class="hak"><input type="checkbox" id="mMit" checked> Die letzten ' + letzteN.length + " Nachrichten aus diesem Chat mitschicken</label>" : "") +
      '<label class="hak"><input type="checkbox" id="mBlock" checked> ' + esc(k.name) + " auch blockieren</label>" +
      '<div class="warn">Wenn du dich bedroht fühlst: Sag es sofort einem Erwachsenen, dem du vertraust. Hilfe gibt es auch kostenlos bei der <b>Nummer gegen Kummer: 116 111</b>.</div>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="mAbbr">Abbrechen</button><button class="btn primary" type="button" id="mOk">Meldung senden</button></div>',
      function (w) {
        w.querySelector("#mAbbr").onclick = zu;
        w.querySelector("#mOk").onclick = async function () {
          this.disabled = true;
          var mit = w.querySelector("#mMit"), text = "";
          if (mit && mit.checked) text = letzteN.map(function (n) { return "[" + new Date(n.zeit).toLocaleString("de-DE") + "] " + (n.von === ich.cid ? ich.name + " (meldet)" : k.name) + ": " + n.text; }).join("\n").slice(-3500);
          try {
            await B.neu("meldungen", { von: ich.cid, ueber: cid, name: k.name.slice(0, 30), grund: w.querySelector("#mGrund").value, notiz: w.querySelector("#mText").value.slice(0, 600), text: text, zeit: B.TS });
            if (w.querySelector("#mBlock").checked) await blockieren(cid, true);
            zu(); KW.toast("Danke – deine Meldung ist angekommen.");
          } catch (e) { this.disabled = false; KW.toast("Die Meldung ging nicht durch: " + fehlerText(e)); }
        };
      });
  }

  /* Meldungen ansehen – nur für den Chef (der Server erlaubt das sonst niemandem) */
  var meldungen = null;
  function meldungenDa(m) {
    meldungen = m; var n = m ? Object.keys(m).length : 0;
    $("meldeBanner").hidden = !m || (!n && !B.demo);
    $("meldeText").innerHTML = "<b>Chef-Ansicht:</b> " + (n ? n + " offene Meldung" + (n > 1 ? "en" : "") : "keine Meldungen");
  }
  $("meldeOeffnen").onclick = function () {
    var ids = Object.keys(meldungen || {}).sort(function (a, b) { return (meldungen[b].zeit || 0) - (meldungen[a].zeit || 0); });
    oeffne("<h2>🛡️ Meldungen</h2>" + (ids.length ? ids.map(function (id) {
      var x = meldungen[id];
      return '<div class="card meldung"><b>' + esc(x.grund) + "</b> · über „" + esc(x.name) + "“<br><small class=\"muted\">" + new Date(x.zeit).toLocaleString("de-DE") + " · gemeldet von Konto " + esc(String(x.von).slice(0, 6)) + "…, betroffen " + esc(String(x.ueber).slice(0, 6)) + "…</small>" +
        (x.notiz ? "<p>" + esc(x.notiz) + "</p>" : "") + (x.text ? "<pre>" + esc(x.text) + "</pre>" : "") + '<button class="btn small" type="button" data-w="' + esc(id) + '">Erledigt – löschen</button></div>';
    }).join("") : '<p class="muted">Keine offenen Meldungen.</p>') + '<p class="muted" style="font-size:.85rem">Bei Drohungen oder Gefahr: nicht selbst ermitteln – einen Erwachsenen einschalten, im Notfall die Polizei (110).</p><div class="sheet-foot"><button class="btn primary" type="button" id="mzu">Schließen</button></div>',
      function (w) {
        w.querySelector("#mzu").onclick = zu;
        w.onclick = function (e) { var b = e.target.closest("[data-w]"); if (b && confirm("Meldung löschen?")) B.weg("meldungen/" + b.dataset.w).then(function () { b.closest(".meldung").remove(); }); };
      });
  };

  /* ---------- Einstellungen ---------- */
  $("knopfEinst").onclick = function () {
    oeffne('<div style="display:flex;gap:12px;align-items:center;margin-bottom:14px">' + ava(ich) + '<div><b style="font-size:1.1rem">' + esc(ich.name) + '</b><br><small class="muted">Dein Profil</small></div></div>' +
      '<div class="menue">' +
      '<button class="btn" type="button" data-e="profil">✏️ Name, Bild und Farbe ändern</button>' +
      '<label class="btn" style="cursor:pointer"><input type="checkbox" id="eLesen"' + (ich.lesen !== false ? " checked" : "") + ' style="width:20px;height:20px;accent-color:var(--app);margin:0 6px 0 0"> Lesebestätigungen senden</label>' +
      '<button class="btn" type="button" data-e="code">🔑 Wiederherstellungs-Code anzeigen</button>' +
      '<button class="btn" type="button" data-e="neucode">🔄 Alle meine Kontakt-Codes ungültig machen</button>' +
      '<button class="btn danger" type="button" data-e="abmelden">🚪 Von diesem Gerät abmelden</button></div>' +
      '<p class="muted" style="font-size:.82rem;margin-top:14px">FIDELIA Chat – Schritt 1. Gruppen, Fotos und Sprachnachrichten kommen als Nächstes.</p>' +
      '<div class="sheet-foot"><button class="btn primary" type="button" data-e="zu">Schließen</button></div>',
      function (w) {
        w.querySelector("#eLesen").onchange = function () { ich.lesen = this.checked; speichereIch(); KW.toast(this.checked ? "Andere sehen, wenn du gelesen hast." : "Andere sehen nicht mehr, wann du gelesen hast."); };
        w.onclick = async function (e) {
          var b = e.target.closest("[data-e]"); if (!b) return;
          var a = b.dataset.e;
          if (a === "zu") zu();
          else if (a === "profil") profilFenster(ich);
          else if (a === "code") codeZeigenFenster(false);
          else if (a === "neucode") { try { await server(); for (var i = 0; i < meineCodes.length; i++) await B.weg("codes/" + meineCodes[i].k).catch(function () {}); meineCodes = []; await eigeneDaten(); KW.toast("Erledigt – alte Kontakt-Codes und Links gelten nicht mehr."); } catch (err) { KW.toast("Gerade keine Verbindung."); } }
          else if (a === "abmelden") {
            if (!confirm("Wirklich abmelden? Deine Nachrichten auf diesem Gerät werden gelöscht. Zurück kommst du nur mit deinem Wiederherstellungs-Code.")) return;
            try { if (B) await B.weg("geraete/" + ich.cid + "/" + B.uid); } catch (err) { /* egal */ }
            abos.forEach(function (u) { u(); });
            await L.allesWeg(); location.reload();
          }
        };
      });
  };

  start().catch(function (e) { $("lade").textContent = "Fehler beim Start: " + (e && e.message || e); });
})();
