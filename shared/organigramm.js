/* OMNIVIA – Organigramm für die Startseite.
   Liest das KI-Register (shared/team/rollen.js) und zeichnet:
   Chef → Leitung → OMNIVIA-Zentrale → vier Marken.
   Läuft synchron beim Laden, damit shared/site.js danach die Steckbriefe (.flip) und .reveal einbindet. */
(function () {
  "use strict";
  var T = window.OMNI_TEAM, ziel = document.getElementById("orgRest");
  if (!T || !ziel) return;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  var REIHE = ["omnivia", "flaressa", "fidelia", "aoris", "kometenwerk"];
  var TEXT = {
    "omnivia|Ideen & Planung": "Sammelt Ideen und plant Projekte in Schritten.",
    "omnivia|Technik-Leitung": "Hält die gemeinsame Technik aller Marken zusammen.",
    "omnivia|Qualität": "Testet alles auf vielen Geräten und für alle Menschen.",
    "omnivia|Sicherheit": "Schützt Apps und Nutzer – und darf Nein sagen.",
    "omnivia|Finanzen": "Achtet darauf, dass alles kostenlos bleibt.",
    "omnivia|Werbung": "Erzählt fair von unseren Projekten – ohne erfundene Bewertungen.",
    "omnivia|Recht & Team": "Achtet auf Regeln, Namen und Rechte.",
    "flaressa|Spielideen": "Erfindet Spiele, die Spaß machen und fair sind.",
    "flaressa|Technik": "Baut die Spiele im Browser und auf Roblox.",
    "flaressa|Grafik & Ton": "Figuren, Farben, Musik und Geräusche.",
    "flaressa|Tests & Community": "Spielt alles durch und hört auf die Spieler.",
    "fidelia|Apps": "Baut die Alltags-Apps wie Planer, Quiz und Küche.",
    "fidelia|Design": "Sorgt für schöne und einfache Bedienung.",
    "fidelia|Kundendienst": "Hilfe-Texte, Rückmeldungen und erste Schritte.",
    "fidelia|Kundenprojekte": "Betreut Websites und Apps für Vereine und Betriebe.",
    "aoris|KI-Technik": "KI, die direkt auf dem Gerät läuft.",
    "aoris|KI-Sicherheit": "Prüft, wie man KI austrickst – und wie man sie schützt.",
    "aoris|Betriebssystem": "Forscht an einem eigenen Betriebssystem.",
    "kometenwerk|Elektronik": "Schaltungen, Akkus und Kabel.",
    "kometenwerk|Mechanik": "Fahrwerk, Gehäuse und 3D-Druck.",
    "kometenwerk|Sensoren & KI": "Kamera, Sensoren und die KI des Rovers.",
    "kometenwerk|Forschung": "Plant Versuche und wertet sie aus.",
    "kometenwerk|Doku & Vorführung": "Hält alles fest und zeigt es vor."
  };
  var MARKE_TEXT = {
    omnivia: "Die Zentrale: Plan, Regeln, Sicherheit und Technik für alle.",
    flaressa: "Spiele",
    fidelia: "Apps & Websites",
    aoris: "KI-Forschung",
    kometenwerk: "Robotik"
  };
  var MARKE_EM = { omnivia: "🏛️", flaressa: "🎮", fidelia: "📱", aoris: "🧠", kometenwerk: "🤖" };

  var verz = 0;
  function av(c, art, groesse) {
    verz = (verz + 0.7) % 4;
    var kopf = art === "chef"
      ? '<path d="M32 4l2.4 5 5.4.6-4 3.7 1.1 5.4L32 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" fill="' + c + '"/><path d="M32 16v5" stroke="' + c + '" stroke-width="2.5"/>'
      : '<path d="M24 20l-5-9M40 20l5-9" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="10" r="3" fill="#ff8a3c"/><circle cx="45" cy="10" r="3" fill="' + c + '"/>';
    var koerper = art === "exp"
      ? '<rect x="13" y="20" width="38" height="32" rx="11" fill="' + c + '"/>'
      : '<path d="M22 20h20l10 16-10 16H22L12 36z" fill="' + c + '" stroke="' + c + '" stroke-width="2" stroke-linejoin="round"/>';
    return '<svg class="av" viewBox="0 0 64 64" width="' + groesse + '" height="' + groesse + '" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="' + c + '" opacity=".16"/>' + kopf + koerper +
      '<rect x="8" y="31" width="5" height="10" rx="2.5" fill="' + c + '" opacity=".7"/><rect x="51" y="31" width="5" height="10" rx="2.5" fill="' + c + '" opacity=".7"/><rect x="18" y="27" width="28" height="18" rx="8" fill="#101826" opacity=".85"/>' +
      '<g class="eyes" style="animation-delay:' + verz.toFixed(1) + 's"><path d="M23 36q3-4 6 0M35 36q3-4 6 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></g>' +
      '<path d="M28 41q4 2.5 8 0" fill="none" stroke="#ff8a3c" stroke-width="2" stroke-linecap="round"/></svg>';
  }
  function rueck(r, zu) {
    return '<span class="face back" aria-hidden="true"><span class="bk-t">Achtet bei jedem Projekt auf</span>' +
      (r.achtet || []).map(function (a) { return '<span class="pk">' + esc(a) + '</span>'; }).join("") + '<span class="dreh">' + zu + '</span></span>';
  }
  function gross(r, c, zusatz) {
    return '<div class="flip gross" role="button" tabindex="0" aria-pressed="false" aria-label="Steckbrief von ' + esc(r.name) + ' umdrehen"><div class="flip-in"><div class="face front"><div class="person-row"><div class="av-wrap">' +
      av(c, "chef", 64) + '<span class="em" aria-hidden="true">' + esc(r.em) + '</span></div><div><h3>' + esc(r.name) + ' <span class="ki">KI</span></h3><p class="rolle">' + esc(r.rolle) + '</p>' +
      (zusatz ? '<p>' + esc(zusatz) + '</p>' : "") + '</div></div><span class="dreh" aria-hidden="true">↻ Umdrehen</span></div>' + rueck(r, "↺ zurück") + '</div></div>';
  }
  function leiter(r, c) {
    return '<div class="flip" role="button" tabindex="0" aria-pressed="false" aria-label="Steckbrief von ' + esc(r.name) + ' umdrehen"><div class="flip-in"><div class="face front"><div class="leiter"><div class="av-wrap">' +
      av(c, "leit", 56) + '<span class="em" aria-hidden="true">' + esc(r.em) + '</span></div><div><b>' + esc(r.name) + '</b> <span class="ki">KI</span><br><span class="rolle">' + esc(r.rolle) + '</span></div></div>' +
      '<span class="dreh" aria-hidden="true">＋ Steckbrief</span></div>' + rueck(r, "− schließen") + '</div></div>';
  }
  function experte(r, c) {
    return '<li><div class="flip klein" role="button" tabindex="0" aria-pressed="false" aria-label="Steckbrief von ' + esc(r.name) + ' umdrehen"><div class="flip-in"><div class="face front"><div class="exp"><div class="av-wrap sm">' +
      av(c, "exp", 40) + '</div><div><b>' + esc(r.name) + '</b> <span class="ki">KI</span><br><span class="rolle">' + esc(r.rolle) + '</span></div></div>' +
      '<span class="dreh" aria-hidden="true">＋ Steckbrief</span></div>' + rueck(r, "− schließen") + '</div></div></li>';
  }

  // Rollen nach Marke und Abteilung sortieren (Reihenfolge wie im Register)
  var nachFirma = {};
  T.rollen.forEach(function (r) {
    var f = nachFirma[r.firma] || (nachFirma[r.firma] = { abts: {}, reihe: [], alle: [] });
    f.alle.push(r);
    if (!f.abts[r.abt]) { f.abts[r.abt] = []; f.reihe.push(r.abt); }
    f.abts[r.abt].push(r);
  });
  var gesamt = T.rollen.length;
  document.querySelectorAll("[data-ki-zahl]").forEach(function (el) { el.textContent = gesamt; });

  var om = T.firmen.omnivia, omC = om.farbe;
  var leitung = (nachFirma.omnivia && nachFirma.omnivia.abts.Leitung) || [];
  var vertretung = leitung.filter(function (r) { return r.id === om.leitung; });
  var buero = leitung.filter(function (r) { return r.id !== om.leitung; });

  var h = "";
  // Ebene 2: Vertretung und Büro
  h += '<div class="org-linie" aria-hidden="true"></div>';
  h += '<p class="org-ebene reveal">Leitung</p>';
  h += '<div class="org-leitung">' + vertretung.concat(buero).map(function (r) {
    return '<article class="person-flip reveal">' + gross(r, omC, r.id === om.leitung ? "Springt ein, wenn der Chef nicht da ist – aber entscheidet nichts Großes allein." : "") + '</article>';
  }).join("") + '</div>';

  // Ebene 3 + 4: Zentrale und Marken als Knoten
  function knoten(id) {
    var f = T.firmen[id], n = (nachFirma[id] || { alle: [] }).alle.length;
    if (id === "omnivia") n -= leitung.length;
    var chefin = T.rollen.filter(function (r) { return r.id === f.leitung; })[0];
    return '<button type="button" class="org-knoten" role="tab" id="tab-' + id + '" aria-controls="panel-' + id + '" aria-selected="false" style="--c:' + f.farbe + ';--t:' + f.tinte + '">' +
      '<span class="ok-em" aria-hidden="true">' + MARKE_EM[id] + '</span><span class="ok-name">' + esc(f.voll) + '</span>' +
      '<span class="ok-was">' + esc(MARKE_TEXT[id] || "") + '</span>' +
      '<span class="ok-info">' + "Leitung: " + esc(chefin ? chefin.name : "") + ' · ' + n + ' KIs</span></button>';
  }
  h += '<div class="org-linie" aria-hidden="true"></div>';
  h += '<div class="org-baum reveal" role="tablist" aria-label="Bereiche des KI-Teams">';
  h += '<div class="org-zentrale">' + knoten("omnivia") + '</div>';
  h += '<div class="org-linie kurz" aria-hidden="true"></div>';
  h += '<div class="org-marken">' + REIHE.slice(1).map(knoten).join("") + '</div></div>';

  // Panels mit den Abteilungen (alle gleich mitzeichnen, damit site.js alle Steckbriefe einbindet)
  REIHE.forEach(function (id) {
    var f = T.firmen[id], d = nachFirma[id];
    if (!d) return;
    var c = f.farbe;
    var chefin = id === "omnivia" ? null : d.alle.filter(function (r) { return r.id === f.leitung; })[0];
    var abts = d.reihe.filter(function (a) { return !(id === "omnivia" && a === "Leitung"); }).map(function (a) {
      return { name: a, leute: d.abts[a].filter(function (r) { return !chefin || r.id !== chefin.id; }) };
    }).filter(function (a) { return a.leute.length; });
    var n = abts.reduce(function (s, a) { return s + a.leute.length; }, 0) + (chefin ? 1 : 0);
    var p = '<div class="org-panel" role="tabpanel" id="panel-' + id + '" aria-labelledby="tab-' + id + '" style="--c:' + c + '" hidden>';
    p += '<div class="org-panel-kopf"><span class="ok-em" aria-hidden="true">' + MARKE_EM[id] + '</span><div><h3>' + esc(f.voll) + '</h3><p>' + n + ' KIs in ' + abts.length + ' Abteilungen</p></div></div>';
    if (chefin) p += '<div class="org-markenchef">' + gross(chefin, c, "Leitet " + f.name + " und berichtet an die Zentrale und den Chef.") + '</div>';
    p += '<div class="abts">' + abts.map(function (a) {
      var erst = a.leute[0], rest = a.leute.slice(1);
      return '<article class="abt" style="--c:' + c + '"><header><span class="abt-em" aria-hidden="true">' + esc(erst.em) + '</span><div><h4>' + esc(a.name) + '</h4>' +
        (TEXT[id + "|" + a.name] ? '<p>' + esc(TEXT[id + "|" + a.name]) + '</p>' : "") + '</div></header>' +
        '<div class="leiter-wrap">' + leiter(erst, c) + '</div>' +
        (rest.length ? '<details><summary>' + (rest.length === 1 ? '1 Experte zeigen' : 'Alle ' + rest.length + ' Experten zeigen') + '</summary><ul class="experten">' + rest.map(function (r) { return experte(r, c); }).join("") + '</ul></details>' : "") +
        '</article>';
    }).join("") + '</div></div>';
    h += p;
  });

  ziel.innerHTML = h;

  // Umschalten zwischen den Bereichen
  var tabs = Array.prototype.slice.call(ziel.querySelectorAll(".org-knoten"));
  function waehle(id, fokus) {
    tabs.forEach(function (t) {
      var an = t.id === "tab-" + id;
      t.setAttribute("aria-selected", an ? "true" : "false");
      t.tabIndex = an ? 0 : -1;
      if (an && fokus) t.focus();
    });
    ziel.querySelectorAll(".org-panel").forEach(function (p) { p.hidden = p.id !== "panel-" + id; });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { waehle(t.id.slice(4)); });
    t.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      waehle(tabs[(i + d + tabs.length) % tabs.length].id.slice(4), true);
    });
  });
  waehle("omnivia");
})();
