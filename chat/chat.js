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
  function ava(k, klein, gross) {
    var b = bildSicher(k.bild), em = k.em || "🙂", abc = /^[A-ZÄÖÜ0-9]{1,2}$/.test(em);
    return '<span class="ava' + (klein ? " klein" : "") + (gross ? " riesig" : "") + (abc ? " abc" : "") + '" style="background:' + esc(/^#[0-9a-f]{6}$/i.test(k.farbe || "") ? k.farbe : "#4338ca") + '" aria-hidden="true">' + (b ? '<img src="' + b + '" alt="">' : esc(em)) + "</span>";
  }
  function uhr(t) { var d = new Date(t); return ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2); }
  function tagText(t) {
    var d = new Date(t), h = new Date(); h.setHours(0, 0, 0, 0);
    var x = new Date(d); x.setHours(0, 0, 0, 0);
    var diff = Math.round((h - x) / TAG);
    if (diff === 0) return "Heute"; if (diff === 1) return "Gestern";
    return d.toLocaleDateString("de-DE", { weekday: diff < 7 ? "long" : undefined, day: "numeric", month: "long", year: d.getFullYear() !== h.getFullYear() ? "numeric" : undefined });
  }
  function kurzZeit(t) { var d = new Date(t); return Date.now() - t < TAG && d.getDate() === new Date().getDate() ? uhr(t) : tagText(t); }
  function istVerboten(e) { return /permission|PERMISSION_DENIED/i.test(String(e && (e.code || e.message) || e)); }
  function fehlerText(e, wobei) {
    var m = String(e && (e.code || e.message) || e);
    if (istVerboten(e)) return wobei === "senden" ? "Die Nachricht kam nicht an – vielleicht seid ihr nicht mehr verbunden." : wobei === "anfrage" ? "Der Code gilt nicht mehr, oder du wurdest blockiert." : "Das ist gerade nicht erlaubt. Wenn das öfter passiert, sag dem OMNIVIA-Team Bescheid.";
    if (/network|offline|timeout|antwortet nicht|Failed to fetch|Laden fehlgeschlagen/i.test(m)) return "Keine Verbindung – bist du online?";
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
    if (!ich.codeOk) { startSeite(3); return; }
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

  /* ---------- Profilbild: Foto, Emoji oder Buchstaben ---------- */
  var BILD_OK = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
  function bildSicher(b) { return typeof b === "string" && b.length < 40000 && BILD_OK.test(b) ? b : null; }
  function initialen(name) { var t = String(name || "").trim().split(/\s+/); return ((t[0] || "?")[0] + (t[1] ? t[1][0] : (t[0] || "")[1] || "")).toUpperCase(); }
  // Bild-Auswahl: baut sich in el ein, meldet Änderungen über onWahl({em, farbe, bild})
  function bildWahl(el, wahl, name) {
    var art = wahl.bild ? "foto" : /^[A-ZÄÖÜ0-9]{1,2}$/.test(wahl.em || "") ? "abc" : "emoji";
    function vorschau() { el.querySelector(".bw-vor").innerHTML = ava({ em: art === "abc" ? initialen(name()) : wahl.em, farbe: wahl.farbe, bild: art === "foto" ? wahl.bild : null }, false, true); }
    function malen() {
      el.innerHTML = '<div class="bw-vor"></div>' +
        '<div class="tabs bw-tabs" role="tablist"><button type="button" role="tab" data-a="foto" aria-selected="' + (art === "foto") + '">📷 Foto</button><button type="button" role="tab" data-a="emoji" aria-selected="' + (art === "emoji") + '">😀 Emoji</button><button type="button" role="tab" data-a="abc" aria-selected="' + (art === "abc") + '">Aa Buchstaben</button></div>' +
        '<div class="bw-inhalt"></div>' +
        (art === "foto" ? "" : '<div class="field" style="margin-top:12px"><span>Farbe</span><div class="farbwahl">' + FARBEN.map(function (x, i) { return '<button type="button" data-f="' + x + '" style="background:' + x + '" aria-label="Farbe ' + (i + 1) + '" aria-pressed="' + (x === wahl.farbe) + '"></button>'; }).join("") + "</div></div>");
      var inh = el.querySelector(".bw-inhalt");
      if (art === "emoji") inh.innerHTML = '<div class="emojis">' + EMOJIS.map(function (x) { return '<button type="button" data-e="' + x + '" aria-label="' + x + '" aria-pressed="' + (x === wahl.em) + '">' + x + "</button>"; }).join("") + "</div>";
      else if (art === "abc") inh.innerHTML = '<p class="muted" style="font-size:.9rem;margin:10px 0 0">Deine Anfangsbuchstaben in deiner Farbe.</p>';
      else inh.innerHTML = '<div class="bw-foto"><label class="btn"><input type="file" accept="image/*" hidden>' + (wahl.bild ? "Anderes Foto wählen" : "Foto auswählen") + '</label><p class="muted" style="font-size:.85rem;margin:8px 0 0">💡 Tipp: Ein Bild ohne dein Gesicht ist sicherer. Dein Foto sehen nur deine Kontakte – verschlüsselt.</p></div><div class="zuschnitt" hidden></div>';
      vorschau();
      var datei = inh.querySelector("input[type=file]");
      if (datei) datei.onchange = function () { var f = this.files && this.files[0]; if (f) zuschneiden(f, inh.querySelector(".zuschnitt"), function (b) { wahl.bild = b; malen(); }); };
    }
    el.onclick = function (e) {
      var t = e.target.closest("[data-a]"); if (t) { art = t.dataset.a; if (art !== "foto") wahl.bild = null; if (art === "abc") wahl.em = initialen(name()); else if (art === "emoji" && /^[A-ZÄÖÜ0-9]{1,2}$/.test(wahl.em)) wahl.em = EMOJIS[0]; malen(); return; }
      var em = e.target.closest("[data-e]"); if (em) { wahl.em = em.dataset.e; el.querySelectorAll("[data-e]").forEach(function (x) { x.setAttribute("aria-pressed", x === em); }); vorschau(); return; }
      var f = e.target.closest("[data-f]"); if (f) { wahl.farbe = f.dataset.f; el.querySelectorAll("[data-f]").forEach(function (x) { x.setAttribute("aria-pressed", x === f); }); vorschau(); }
    };
    malen();
    return { neu: function () { if (art === "abc") { wahl.em = initialen(name()); vorschau(); } }, art: function () { return art; } };
  }
  // Foto im Kreis zurechtschieben und zoomen, dann klein rechnen
  function zuschneiden(datei, el, fertig) {
    var url = URL.createObjectURL(datei), img = new Image();
    img.onload = function () {
      var G = 260, s0 = Math.max(G / img.width, G / img.height), zoom = 1, x = 0, y = 0;
      el.hidden = false;
      el.innerHTML = '<canvas width="' + G + '" height="' + G + '" class="zs-flaeche" aria-label="Foto verschieben"></canvas><label class="field" style="margin:10px 0"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value="1" class="zs-zoom"></label><div class="sheet-foot" style="margin:0"><button class="btn" type="button" data-z="nein">Abbrechen</button><button class="btn primary" type="button" data-z="ja">Übernehmen</button></div>';
      var c = el.querySelector("canvas"), g = c.getContext("2d");
      function grenzen() { var w = img.width * s0 * zoom, h = img.height * s0 * zoom; x = Math.min((w - G) / 2, Math.max(-(w - G) / 2, x)); y = Math.min((h - G) / 2, Math.max(-(h - G) / 2, y)); }
      function malen(ziel, gr) {
        var k = gr / G, w = img.width * s0 * zoom * k, h = img.height * s0 * zoom * k;
        ziel.clearRect(0, 0, gr, gr); ziel.drawImage(img, gr / 2 - w / 2 + x * k, gr / 2 - h / 2 + y * k, w, h);
      }
      function zeigen() { grenzen(); malen(g, G); g.save(); g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.rect(0, 0, G, G); g.arc(G / 2, G / 2, G / 2 - 4, 0, Math.PI * 2, true); g.fill("evenodd"); g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.arc(G / 2, G / 2, G / 2 - 4, 0, Math.PI * 2); g.stroke(); g.restore(); }
      var ziehen = null;
      c.onpointerdown = function (e) { ziehen = { x: e.clientX - x, y: e.clientY - y }; c.setPointerCapture(e.pointerId); };
      c.onpointermove = function (e) { if (!ziehen) return; x = e.clientX - ziehen.x; y = e.clientY - ziehen.y; zeigen(); };
      c.onpointerup = c.onpointercancel = function () { ziehen = null; };
      c.onwheel = function (e) { e.preventDefault(); zoom = Math.min(3, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 0.93))); el.querySelector(".zs-zoom").value = zoom; zeigen(); };
      el.querySelector(".zs-zoom").oninput = function () { zoom = +this.value; zeigen(); };
      el.onclick = function (e) {
        var b = e.target.closest("[data-z]"); if (!b) return;
        if (b.dataset.z === "nein") { el.hidden = true; el.innerHTML = ""; URL.revokeObjectURL(url); return; }
        var gr = 160, q = 0.82, out, z = document.createElement("canvas");
        for (var v = 0; v < 8; v++) {
          z.width = z.height = gr; var zg = z.getContext("2d"); zg.fillStyle = "#fff"; zg.fillRect(0, 0, gr, gr); malen(zg, gr);
          out = z.toDataURL("image/webp", q);
          if (out.indexOf("data:image/webp") !== 0) out = z.toDataURL("image/jpeg", q);
          if (out.length <= 14000) break;
          q -= 0.1; if (q < 0.45) { q = 0.7; gr -= 24; }
        }
        URL.revokeObjectURL(url); fertig(out);
      };
      zeigen();
    };
    img.onerror = function () { KW.toast("Dieses Bild kann ich nicht öffnen. Versuch ein anderes."); };
    img.src = url;
  }

  /* ---------- Start: Konto anlegen in Schritten ---------- */
  var onb = { schritt: 0, name: "", wahl: null };
  function startSeite(schritt) {
    seite("seiteStart");
    onb.wahl = onb.wahl || { em: EMOJIS[Math.floor(Math.random() * EMOJIS.length)], farbe: FARBEN[Math.floor(Math.random() * FARBEN.length)], bild: null };
    schrittZeigen(schritt || 0);
  }
  function punkte(n) { var h = '<div class="onb-punkte" aria-label="Schritt ' + n + ' von 4">'; for (var i = 1; i <= 4; i++) h += '<span class="' + (i <= n ? "an" : "") + '"></span>'; return h + "</div>"; }
  function schrittZeigen(n, rueck) {
    onb.schritt = n;
    var el = $("onb"), h = "";
    if (n === 0) {
      h = '<div class="onb-hero"><div class="onb-logo" aria-hidden="true"><span class="b1">💬</span><span class="b2">🔒</span></div><h2>Chatten ohne<br>Telefonnummer</h2><p>Mit Familie und Freunden – verschlüsselt, ohne Werbung.</p></div>' +
        '<div class="onb-chips"><span>🙈 Keine Nummer</span><span>🤝 Nur Leute, die du kennst</span><span>🔒 Ende-zu-Ende</span></div>' +
        (einladung ? '<div class="onb-einl">🎉 <b>Du wurdest eingeladen!</b> Leg dir ein Konto an – die Kontaktanfrage geht danach automatisch raus.</div>' : '<div class="onb-einl leise">Am Anfang nur mit Einladung: Lass dir den Kontakt-Code von jemandem zeigen, der FIDELIA Chat schon benutzt.</div>') +
        '<div class="knoepfe"><button class="btn primary gross" type="button" data-s="1">Los geht\'s</button><button class="btn" type="button" data-s="zurueck">Ich habe schon ein Konto</button></div>';
    } else if (n === 1) {
      h = punkte(1) + '<h2 class="onb-titel">Wie sollen dich deine Freunde sehen?</h2>' +
        '<label class="field"><span>Dein Spitzname</span><input class="inp gross" id="oName" maxlength="30" autocomplete="nickname" value="' + esc(onb.name) + '" placeholder="z. B. Luki oder Mia"></label>' +
        '<p class="muted klein">Bitte nicht deinen vollen echten Namen. Bist du unter 16? Dann sprich vorher mit deinen Eltern – sie müssen zustimmen.</p>' +
        '<div class="onb-fuss"><button class="btn" type="button" data-s="0">Zurück</button><button class="btn primary" type="button" data-s="2">Weiter</button></div>';
    } else if (n === 2) {
      h = punkte(2) + '<h2 class="onb-titel">Dein Profilbild</h2><div id="oBild"></div><div class="fehler" id="oFehler" hidden></div>' +
        '<div class="onb-fuss"><button class="btn" type="button" data-s="1">Zurück</button><button class="btn primary" type="button" data-s="anlegen" id="oAnlegen">Konto anlegen</button></div>';
    } else if (n === 3) {
      h = punkte(3) + '<h2 class="onb-titel">Dein geheimer Code</h2><p>Damit kommst du auf einem neuen Handy wieder in dein Konto. <b>Schreib ihn auf Papier</b> und heb ihn gut auf.</p>' +
        '<div class="codebox" id="cCode">' + esc(ich.code) + '</div><button class="btn small" type="button" data-s="kopie">📋 Kopieren</button>' +
        '<div class="warn">⚠️ Zeig ihn niemandem. Wir können ihn nicht zurücksetzen – wir kennen ihn selbst nicht.</div>' +
        '<div class="onb-fuss"><span></span><button class="btn primary" type="button" data-s="4">Ich hab ihn aufgeschrieben</button></div>';
    } else if (n === 4) {
      onb.gruppe = onb.gruppe || 2 + Math.floor(Math.random() * 3);
      h = punkte(4) + '<h2 class="onb-titel">Kurzer Test ✍️</h2><p>Schau auf deinen Zettel: Wie lautet die <b>' + onb.gruppe + '. Vierergruppe</b> deines Codes?</p>' +
        '<input class="inp gross code-eingabe" id="oTest" maxlength="4" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX" aria-label="' + onb.gruppe + '. Vierergruppe">' +
        '<div class="fehler" id="oFehler" hidden></div>' +
        '<div class="onb-fuss"><button class="btn" type="button" data-s="3">Code nochmal zeigen</button><button class="btn primary" type="button" data-s="pruefen">Prüfen</button></div>';
    } else if (n === 5) {
      h = '<div class="onb-hero fertig"><div class="onb-ava">' + ava(ich, false, true) + '</div><h2>Willkommen, ' + esc(ich.name) + '! 🎉</h2><p>' + (onb.einlName ? "Deine Kontaktanfrage an " + esc(onb.einlName) + " ist unterwegs." : "Jetzt fehlen nur noch deine Freunde.") + "</p></div>" +
        '<div class="knoepfe"><button class="btn primary gross" type="button" data-s="einladen">📲 Freunde einladen</button><button class="btn" type="button" data-s="chats">Zu meinen Chats</button></div>';
      konfetti();
    }
    el.innerHTML = '<div class="onb-karte ' + (rueck ? "rueck" : "vor") + '">' + h + "</div>";
    if (n === 1) { var f = $("oName"); setTimeout(function () { f.focus(); }, 250); f.onkeydown = function (e) { if (e.key === "Enter") weiter("2"); }; }
    if (n === 2) onb.bw = bildWahl($("oBild"), onb.wahl, function () { return onb.name; });
    if (n === 4) { var t = $("oTest"); setTimeout(function () { t.focus(); }, 250); t.onkeydown = function (e) { if (e.key === "Enter") weiter("pruefen"); }; }
  }
  $("onb").addEventListener("click", function (e) { var b = e.target.closest("[data-s]"); if (b) weiter(b.dataset.s, b); });
  function onbFehler(text) { var f = $("oFehler"); if (!f) { KW.toast(text); return; } f.hidden = false; f.innerHTML = text; f.classList.remove("wackel"); void f.offsetWidth; f.classList.add("wackel"); }
  async function weiter(s, knopf) {
    if (s === "zurueck") { zurueckholenFenster(); return; }
    if (s === "kopie") { if (navigator.clipboard) navigator.clipboard.writeText(ich.code).then(function () { KW.toast("Kopiert – füge ihn an einem sicheren Ort ein."); }); return; }
    if (s === "einladen") { fertigZurListe(); plusFenster("zeigen"); return; }
    if (s === "chats") { fertigZurListe(); return; }
    if (s === "2" && onb.schritt === 1) {
      onb.name = $("oName").value.trim().replace(/\s+/g, " ");
      if (!onb.name) { $("oName").classList.add("wackel"); setTimeout(function () { $("oName").classList.remove("wackel"); }, 500); KW.toast("Bitte gib einen Spitznamen ein."); return; }
    }
    if (s === "anlegen") {
      knopf.disabled = true; knopf.innerHTML = '<span class="dreh" aria-hidden="true"></span> Wird angelegt …';
      try { await kontoAnlegen(onb.name, onb.bw.art() === "abc" ? initialen(onb.name) : onb.wahl.em, onb.wahl.farbe, onb.wahl.bild); schrittZeigen(3); }
      catch (e) { knopf.disabled = false; knopf.textContent = "Nochmal versuchen"; onbFehler(e.message || "Das hat nicht geklappt."); }
      return;
    }
    if (s === "pruefen") {
      var soll = ich.code.split("-")[onb.gruppe - 1], ist = K.codeSauber("AAAA-AAAA-AAAA-AAAA-" + $("oTest").value);
      if (ist && ist.slice(-4) === soll) { ich.codeOk = true; await speichereIch(); if (einladung) await codeEinloesen(einladung, true); schrittZeigen(5); }
      else { onbFehler("Das stimmt nicht ganz. Schau nochmal auf deinen Zettel – oder lass dir den Code nochmal zeigen."); $("oTest").select(); }
      return;
    }
    var n = +s; if (!isNaN(n)) schrittZeigen(n, n < onb.schritt);
  }
  function fertigZurListe() { seite("seiteListe"); $("knopfEinst").hidden = false; liste(); if (!abos.length) verbinden(); }
  function konfetti() {
    var c = document.createElement("canvas"), g = c.getContext("2d"), W = c.width = innerWidth, H = c.height = innerHeight, t0 = performance.now();
    c.className = "konfetti"; document.body.appendChild(c);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { c.remove(); return; }
    var farben = ["#a21caf", "#ff8a3c", "#ffcf33", "#3ef2a0", "#5b8cff"], st = [];
    for (var i = 0; i < 140; i++) st.push({ x: W / 2 + (Math.random() - .5) * 80, y: H * .35, vx: (Math.random() - .5) * 13, vy: -Math.random() * 13 - 4, r: Math.random() * 6, w: 6 + Math.random() * 6, f: farben[i % 5] });
    (function bild(jetzt) {
      var t = (jetzt - t0) / 1000; g.clearRect(0, 0, W, H);
      st.forEach(function (p) { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.r += .15; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.f; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore(); });
      if (t < 3.2) requestAnimationFrame(bild); else c.remove();
    })(t0);
  }

  async function kontoAnlegen(name, em, farbe, bild) {
    try { await server(); } catch (e) { throw new Error("📡 Keine Verbindung zum Chat-Server. Bist du online? Dann versuch es gleich nochmal."); }
    var code = K.neuerCode(), paar = await K.neuesPaar(), ek = await K.oeffentlich(paar), fp = await K.fingerabdruck(ek), cid = K.id(12);
    var schloss = await K.schloss(code), tresor = await K.tresorName(code);
    var per = null;
    if (einladung) {
      var c = await B.hol("codes/" + einladung.k).catch(function () { return null; });
      if (!c || c.bis < Date.now()) { einladung = null; throw new Error("⏰ Dieser Einladungs-Code ist abgelaufen oder wurde schon benutzt. Lass dir einen neuen zeigen."); }
      per = einladung.k;
    }
    try { await B.setz("schloss/" + cid, schloss); await B.setz("geraete/" + cid + "/" + B.uid, schloss); }
    catch (e) { throw new Error(istVerboten(e) ? "🛠️ Der Chat-Server ist noch nicht eingerichtet. <small>(Für den Chef: Die Firebase-Regeln für den Chat fehlen noch – siehe ANLEITUNG.md.)</small>" : "📡 Keine Verbindung zum Chat-Server. Versuch es gleich nochmal."); }
    var profil = { name: name, em: em, farbe: farbe, ek: ek, fp: fp, zeit: B.TS };
    if (per) profil.per = per;
    try { await B.setz("nutzer/" + cid, profil); }
    catch (e) { throw new Error(per ? "⏰ Die Einladung gilt nicht mehr. Lass dir einen neuen Kontakt-Code zeigen." : "✉️ Du brauchst eine Einladung: Lass dir von jemandem, der FIDELIA Chat schon benutzt, den Kontakt-Code zeigen und scanne ihn – oder öffne seinen Link."); }
    var jwk = await K.privatExport(paar);
    await B.setz("tresor/" + tresor, await K.tresorZu(code, { cid: cid, priv: jwk, v: 1 }));
    priv = await K.privatImport(jwk, false);
    ich = { cid: cid, name: name, em: em, farbe: farbe, bild: bild || null, bildV: bild ? Date.now() : 0, ek: ek, fp: fp, code: code, codeOk: false, lesen: true, angelegt: Date.now() };
    await L.leg("ich", priv, "priv"); await speichereIch();
  }

  function codeZeigenFenster() {
    oeffne("<h2>Wiederherstellungs-Code</h2><p>Mit diesem Code kommst du auf einem neuen Handy wieder in dein Konto.</p>" +
      '<div class="codebox">' + esc(ich.code) + "</div>" +
      '<div class="warn">⚠️ Zeig ihn niemandem – wer den Code hat, kann dein Konto benutzen.</div>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="cKopie">Kopieren</button><span class="sp"></span><button class="btn primary" type="button" id="cWeiter">Schließen</button></div>',
      function (w) {
        w.querySelector("#cKopie").onclick = function () { navigator.clipboard && navigator.clipboard.writeText(ich.code).then(function () { KW.toast("Kopiert."); }); };
        w.querySelector("#cWeiter").onclick = zu;
      });
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
            ich = { cid: inhalt.cid, name: p.name, em: p.em, farbe: p.farbe, bild: null, bildV: 0, ek: p.ek, fp: p.fp, code: code, codeOk: true, lesen: true, angelegt: Date.now() };
            await L.leg("ich", priv, "priv"); await speichereIch();
            zu(); seite("seiteListe"); $("knopfEinst").hidden = false; liste(); verbinden();
            KW.toast("Willkommen zurück, " + p.name + "!");
          } catch (e) { knopf.disabled = false; knopf.textContent = "Zurückholen"; KW.toast(e.message || fehlerText(e)); }
        };
      });
  }

  /* Profilbild verschlüsselt an alle Kontakte schicken, die es noch nicht haben */
  var verteilt = false;
  async function bilderVerteilen() {
    if (verteilt || !B || !ich) return; verteilt = true;
    try {
      for (var cid in kontakte) {
        var k = kontakte[cid];
        if (k.status !== "ok" || !k.ek || (k.meinBildV || 0) === (ich.bildV || 0)) continue;
        try {
          var s = await K.gemeinsam(priv, ich.cid, k.cid, k.ek), id = B.neuKey("post/" + cid);
          var v = await K.verschluesseln(s, { typ: "profil", bild: ich.bild || "", name: ich.name, em: ich.em, farbe: ich.farbe, v: ich.bildV || 0 }, ich.cid + ">" + k.cid + ">" + id);
          await B.setz("post/" + cid + "/" + id, { von: ich.cid, iv: v.iv, ct: v.ct, zeit: B.TS });
          k.meinBildV = ich.bildV || 0; await speichereKontakt(k);
        } catch (e) { /* nächstes Mal */ }
      }
    } finally { verteilt = false; }
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
        k = kontakte[cid] = Object.assign(k || {}, { cid: cid, name: p.name, em: p.em, farbe: p.farbe, ek: p.ek, fp: p.fp, status: st, geprueft: geprueft, seit: Date.now() });
        if (ausstehend[cid]) { delete ausstehend[cid]; eigeneDaten(); }
        if (st === "ok" && !(nachrichten[cid] || []).length) KW.toast(p.em + " " + p.name + " ist jetzt dein Kontakt.");
        await speichereKontakt(k); geaendert = true;
      } else if (k.status !== st) { k.status = st; await speichereKontakt(k); geaendert = true; }
    }
    for (var c in kontakte) if (!(c in liste_) && kontakte[c].status !== "entfernt") { kontakte[c].status = "entfernt"; await speichereKontakt(kontakte[c]); geaendert = true; }
    profileAuffrischen();
    if (geaendert) { liste(); if (aktiv) chatKopf(); }
    bilderVerteilen();
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
      return '<button class="chatzeile' + (u ? " ungelesen" : "") + '" type="button" data-c="' + cid + '">' + ava(k) + '<span class="mitte"><span class="name">' + esc(k.name) + (k.geprueft ? ' <span title="Schlüssel geprüft" aria-label="geprüft">✅</span>' : "") + schild + '</span><span class="vor">' + esc(vor) + '</span></span><span class="rechts">' + (n ? esc(kurzZeit(n.zeit)) : "") + (u ? '<span class="zahl" aria-label="' + u + ' ungelesen">' + u + "</span>" : "") + "</span></button>";
    }).join("") : '<div class="empty"><span class="gross" aria-hidden="true">👋</span><b>Noch keine Chats</b>Tippe auf ＋ und zeig deinen Kontakt-Code – oder scanne den von jemandem, den du kennst.</div>';
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

  async function codeEinloesen(code, still) {
    einladung = null;
    if (!ich) { einladung = code; startSeite(); return; }
    try {
      await server();
      var c = await B.hol("codes/" + code.k);
      if (!c || c.bis < Date.now()) { KW.toast("Dieser Code ist abgelaufen oder wurde schon benutzt. Lass dir einen neuen zeigen."); return; }
      if (c.cid === ich.cid) { KW.toast("Das ist dein eigener Code 😄"); return; }
      var p = await B.hol("nutzer/" + c.cid);
      if (!p || (await K.fingerabdruck(p.ek)) !== code.fp) { KW.toast("⚠️ Dieser Code passt nicht zum Konto. Benutze ihn lieber nicht."); return; }
      if (still) { // direkt nach dem Anlegen mit Einladung: Anfrage ohne Rückfrage schicken
        ausstehend[c.cid] = code.fp; await eigeneDaten();
        await B.setz("anfragen/" + c.cid + "/" + ich.cid, { code: code.k, zeit: B.TS });
        if (c.einmal) await B.weg("codes/" + code.k).catch(function () {});
        onb.einlName = p.name; return;
      }
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
            } catch (e) { this.disabled = false; KW.toast("Die Anfrage ging nicht durch: " + fehlerText(e, "anfrage")); }
          };
        });
    } catch (e) { if (!still) KW.toast("Das hat nicht geklappt: " + fehlerText(e, "anfrage")); }
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
    $("chatAva").innerHTML = ava(k, true);
    $("chatName").textContent = k.name;
    $("chatUnter").textContent = k.status === "blockiert" ? "blockiert" : k.status === "entfernt" ? "nicht mehr verbunden" : (k.geprueft ? "✅ geprüft · " : "") + "🔒 verschlüsselt";
    var gesperrt = k.status !== "ok";
    $("eingabe").hidden = gesperrt; $("gesperrt").hidden = !gesperrt;
    $("gesperrt").innerHTML = k.status === "blockiert" ? 'Du hast ' + esc(k.name) + ' blockiert. <button class="btn small" type="button" id="entsperren">Freigeben</button>' : "Ihr seid nicht mehr verbunden. Für einen neuen Chat braucht ihr einen neuen Kontakt-Code.";
    var e = $("entsperren"); if (e) e.onclick = function () { blockieren(aktiv, false); };
  }
  var gezeigt = {};
  function verlauf(nachUnten) {
    var el = $("verlauf"), unten = nachUnten || el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    var l = nachrichten[aktiv] || [], h = '<div class="info">🔒 Nachrichten in diesem Chat sind Ende-zu-Ende verschlüsselt. Nur ihr beide könnt sie lesen.</div>', tag = "";
    var erstesMal = !gezeigt[aktiv]; gezeigt[aktiv] = gezeigt[aktiv] || {};
    l.forEach(function (n, i) {
      var t = tagText(n.zeit); if (t !== tag) { tag = t; h += '<div class="tag">' + esc(t) + "</div>"; }
      var mein = n.von === ich.cid, nurEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f){1,8}$/u.test(n.text) && !/^[0-9#*]+$/.test(n.text);
      var nx = l[i + 1], ende = !nx || nx.von !== n.von || nx.zeit - n.zeit > 300000 || tagText(nx.zeit) !== t;
      var neu = !erstesMal && !gezeigt[aktiv][n.id]; gezeigt[aktiv][n.id] = 1;
      var st = mein ? (n.st === -1 ? "⚠️ " + esc(n.fehler || "nicht zugestellt") + " – antippen" : n.st === 0 ? '<span aria-label="wird gesendet">🕓</span>' : n.st === 1 ? '<span aria-label="gesendet">✓</span>' : n.st === 2 ? '<span aria-label="angekommen">✓✓</span>' : '<span class="st3" aria-label="gelesen">✓✓</span>') : "";
      h += '<div class="blase' + (mein ? " ich" : "") + (ende ? " ende" : "") + (neu ? " neu" : "") + (n.st === -1 ? " fehler" : "") + (nurEmoji ? " gross" : "") + '" data-id="' + esc(n.id) + '"><span class="txt">' + esc(n.text) + '</span><span class="fuss">' + uhr(n.zeit) + (st ? " " + st : "") + "</span></div>";
    });
    if (erstesMal) l.forEach(function (n) { gezeigt[aktiv][n.id] = 1; });
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
    } catch (e) { n.st = -1; n.fehler = fehlerText(e, "senden"); }
    speichereNachricht(n);
    if (aktiv === n.chat) verlauf(); else liste();
  }

  async function empfangen(key, m) {
    if (!m || !m.von) return;
    var k = kontakte[m.von];
    var schon = (nachrichten[m.von] || []).some(function (x) { return x.id === key; });
    if (!k || !k.ek) { wartend[key] = m; return; } // Kontakt wird gerade noch geladen
    if (k.status !== "ok" || schon) { B.weg("post/" + ich.cid + "/" + key).catch(function () {}); return; }
    var text, inhalt = null;
    try {
      var s = await K.gemeinsam(priv, ich.cid, k.cid, k.ek);
      inhalt = await K.entschluesseln(s, m.iv, m.ct, m.von + ">" + ich.cid + ">" + key);
      text = String(inhalt.t || "");
    } catch (e) { text = "⚠️ Diese Nachricht konnte nicht entschlüsselt werden."; }
    if (inhalt && inhalt.typ === "profil") { // neues Profilbild – kommt nicht in den Verlauf
      B.weg("post/" + ich.cid + "/" + key).catch(function () {});
      if ((inhalt.v || 0) >= (k.bildV || 0)) {
        k.bild = bildSicher(inhalt.bild); k.bildV = inhalt.v || 0;
        if (typeof inhalt.name === "string" && inhalt.name.trim() && inhalt.name.length <= 30) k.name = inhalt.name;
        if (typeof inhalt.em === "string" && inhalt.em && inhalt.em.length <= 16) k.em = inhalt.em;
        if (/^#[0-9a-f]{6}$/.test(inhalt.farbe || "")) k.farbe = inhalt.farbe;
        await speichereKontakt(k); liste(); if (aktiv === k.cid) chatKopf();
      }
      return;
    }
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
    oeffne('<div style="text-align:center">' + ava(k, false, true) + '<h2 style="margin:10px 0 2px">' + esc(k.name) + '</h2><p class="muted" style="margin:0 0 14px">' + (k.geprueft ? "✅ Schlüssel geprüft" : "Schlüssel noch nicht geprüft") + "</p></div>" +
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

  function profilFenster() {
    var wahl = { em: ich.em, farbe: ich.farbe, bild: ich.bild || null }, bw;
    oeffne('<h2>Dein Profil</h2><label class="field"><span>Spitzname</span><input class="inp" id="pName" maxlength="30" value="' + esc(ich.name) + '"></label><div id="pBild"></div>' +
      '<div class="sheet-foot"><button class="btn" type="button" id="pAbbr">Abbrechen</button><button class="btn primary" type="button" id="pOk">Speichern</button></div>',
      function (w) {
        bw = bildWahl(w.querySelector("#pBild"), wahl, function () { return w.querySelector("#pName").value; });
        w.querySelector("#pName").oninput = function () { bw.neu(); };
        w.querySelector("#pAbbr").onclick = zu;
        w.querySelector("#pOk").onclick = async function () {
          var name = w.querySelector("#pName").value.trim().replace(/\s+/g, " ");
          if (!name) { KW.toast("Bitte gib einen Spitznamen ein."); return; }
          var em = bw.art() === "abc" ? initialen(name) : wahl.em, bild = bw.art() === "foto" ? wahl.bild : null;
          this.disabled = true;
          try {
            await server();
            if (name !== ich.name) await B.setz("nutzer/" + ich.cid + "/name", name);
            if (em !== ich.em) await B.setz("nutzer/" + ich.cid + "/em", em);
            if (wahl.farbe !== ich.farbe) await B.setz("nutzer/" + ich.cid + "/farbe", wahl.farbe);
            var neuesBild = (bild || null) !== (ich.bild || null) || name !== ich.name || em !== ich.em || wahl.farbe !== ich.farbe;
            ich.name = name; ich.em = em; ich.farbe = wahl.farbe;
            if (neuesBild) { ich.bild = bild || null; ich.bildV = Date.now(); }
            await speichereIch(); zu(); KW.toast("Profil gespeichert ✨");
            if (neuesBild) bilderVerteilen();
          } catch (e) { this.disabled = false; KW.toast("Speichern hat nicht geklappt: " + fehlerText(e)); }
        };
      });
  }

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
          else if (a === "code") codeZeigenFenster();
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
