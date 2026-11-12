// FIDELIA Werkzeugkasten (intern): Webseiten aus Vorlagen bauen, Angebote schreiben, Flyer drucken.
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = KW.esc;
  var KEY = "kw-baukasten";
  var KUNDEN_URL = "https://kometenwerk.github.io/kunden/";

  /* ================= Vorlagen ================= */
  var VORLAGEN = {
    verein: { name: "Verein", farbe: "#1d4ed8", titel: "TSV Musterdorf e. V.", slogan: "Sport, Gemeinschaft und Spaß – seit 1952", ueber: "Wir sind ein Sportverein mit rund 300 Mitgliedern. Bei uns ist jeder willkommen – egal wie alt und wie sportlich.", liste: "Fußball (Jugend und Herren)\nTurnen für Kinder\nNordic Walking\nTischtennis", listeTitel: "Unsere Abteilungen", extraTitel: "Termine", extra: "Sa 14.12. 15:00 – Weihnachtsfeier im Vereinsheim\nSo 12.01. 11:00 – Neujahrsempfang\nFr 07.03. 19:00 – Jahreshauptversammlung", knopf: "Mitglied werden", knopfLink: "mailto:" },
    laden: { name: "Laden / Betrieb", farbe: "#b45309", titel: "Bäckerei Sonnenschein", slogan: "Frisch gebacken, jeden Morgen", ueber: "Seit drei Generationen backen wir mit Liebe und regionalen Zutaten. Kommen Sie vorbei!", liste: "Brot und Brötchen\nKuchen und Torten auf Bestellung\nKaffee zum Mitnehmen\nFrühstück am Wochenende", listeTitel: "Unser Angebot", extraTitel: "Öffnungszeiten", extra: "Mo–Fr: 6:30–18:00\nSa: 6:30–13:00\nSo: 8:00–11:00", knopf: "Jetzt anrufen", knopfLink: "tel:" },
    ferien: { name: "Ferienwohnung", farbe: "#0f766e", titel: "Ferienwohnung Seeblick", slogan: "Erholung mit Blick aufs Wasser", ueber: "Unsere helle 60-m²-Wohnung liegt nur fünf Minuten vom See entfernt – ideal für Paare und kleine Familien.", liste: "2 Schlafzimmer, bis 4 Personen\nVoll ausgestattete Küche\nBalkon mit Seeblick\nWLAN und Parkplatz\nHaustiere auf Anfrage", listeTitel: "Ausstattung", extraTitel: "Preise", extra: "Nebensaison: 75 € pro Nacht\nHauptsaison (Juni–August): 95 € pro Nacht\nEndreinigung: 50 €\nMindestaufenthalt: 3 Nächte", knopf: "Anfrage senden", knopfLink: "mailto:" }
  };
  var S = Object.assign({
    seite: Object.assign({ vorlage: "verein", adresse: "Hauptstraße 1, 12345 Musterdorf", tel: "", mail: "", bild: "", impName: "", impAnschrift: "", impVertreten: "" }, VORLAGEN.verein),
    angebot: { nr: "", kunde: "", kundeAdresse: "", datum: "", gueltig: "4 Wochen", posten: [{ text: "Webseite mit 3–5 Unterseiten (Entwurf, Umsetzung, Handy-Ansicht)", menge: 1, preis: 180 }, { text: "Einrichtung der Internet-Adresse (Domain) – Kosten der Domain zahlt der Kunde direkt beim Anbieter", menge: 1, preis: 20 }], hinweis: "Änderungen nach der Fertigstellung: 10 € pro Änderung oder 7 € im Monat für bis zu 3 Änderungen.", absender: "FIDELIA Digital (OMNIVIA Group)", absenderName: "", kleinunternehmer: true },
    flyer: { art: "alles", format: "a4", preise: true }
  }, KW.load(KEY, {}));
  var sichern = function () { KW.save(KEY, S); };

  /* ================= Reiter ================= */
  document.querySelectorAll("[data-tab]").forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll("[data-tab]").forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      document.querySelectorAll(".b-tab").forEach(function (t) { t.hidden = t.id !== "tab-" + b.dataset.tab; });
      ({ seite: seiteZeigen, angebot: angebotZeigen, flyer: flyerZeigen })[b.dataset.tab]();
    };
  });

  function feld(id, label, wert, art) {
    return '<div class="field"><label for="' + id + '">' + label + "</label>" + (art === "text" ? '<textarea class="inp" id="' + id + '">' + esc(wert || "") + "</textarea>" : '<input class="inp" id="' + id + '" value="' + esc(wert || "") + '"' + (art ? ' type="' + art + '"' : "") + ">") + "</div>";
  }
  function bindeFelder(wurzel, ziel, nachher) {
    wurzel.querySelectorAll("[data-f]").forEach(function (el) {
      el.addEventListener("input", function () { ziel[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; sichern(); nachher(); });
      el.addEventListener("change", function () { ziel[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value; sichern(); nachher(); });
    });
  }
  function f(id, label, wert, art) { return feld("f_" + id, label, wert, art).replace('id="f_' + id + '"', 'id="f_' + id + '" data-f="' + id + '"'); }

  /* ================= 1. Webseite ================= */
  function seiteZeigen() {
    var p = S.seite, t = $("#tab-seite");
    t.innerHTML = '<div class="b-zwei"><div class="b-form card" style="padding:14px">' +
      '<div class="b-vorlagen">' + Object.keys(VORLAGEN).map(function (k) { return '<button type="button" class="btn" data-vorlage="' + k + '" aria-pressed="' + (p.vorlage === k) + '">' + VORLAGEN[k].name + "</button>"; }).join("") + "</div>" +
      '<p class="muted" style="margin-top:0">Vorlage wählen, Texte vom Kunden eintragen, rechts siehst du sofort die Seite.</p>' +
      "<h3>Kopf</h3>" + f("titel", "Name", p.titel) + f("slogan", "Unterzeile", p.slogan) +
      '<div class="field"><label for="f_farbe">Farbe</label><input type="color" id="f_farbe" data-f="farbe" value="' + esc(p.farbe) + '"></div>' +
      '<div class="field"><label>Titelbild (optional)</label><label class="btn small">Bild wählen<input type="file" id="f_bild" accept="image/*" hidden></label> ' + (p.bild ? '<button type="button" class="btn small" id="bildWeg">Bild entfernen</button>' : "") + "</div>" +
      "<h3>Inhalt</h3>" + f("ueber", "Über uns", p.ueber, "text") + f("listeTitel", "Überschrift der Liste", p.listeTitel) + f("liste", "Liste (eine Zeile pro Punkt)", p.liste, "text") + f("extraTitel", "Überschrift zweiter Kasten", p.extraTitel) + f("extra", "Zweiter Kasten (eine Zeile pro Punkt)", p.extra, "text") +
      "<h3>Kontakt</h3>" + f("adresse", "Adresse", p.adresse) + f("tel", "Telefon", p.tel) + f("mail", "E-Mail", p.mail) + f("knopf", "Text vom großen Knopf", p.knopf) +
      '<h3>Impressum (Pflicht!)</h3><div class="b-hinweis">Diese Angaben muss der <b>Kunde</b> liefern und prüfen. Eine Webseite ohne richtiges Impressum kann Abmahnungen bringen. Die Datenschutz-Erklärung ist nur ein Muster für eine einfache Seite ohne Tracker – der Kunde muss sie prüfen (lassen).</div>' +
      f("impName", "Verantwortlich (Name / Verein mit Rechtsform)", p.impName) + f("impAnschrift", "Ladungsfähige Anschrift", p.impAnschrift) + f("impVertreten", "Vertreten durch (z. B. 1. Vorsitzende/r) / Registernummer", p.impVertreten) +
      '</div><div class="b-vorschau" id="vorschau"><div class="leiste"><button type="button" class="btn small" id="vPc">💻 Computer</button><button type="button" class="btn small" id="vHandy">📱 Handy</button><span style="flex:1"></span><button type="button" class="btn small primary" id="laden">⬇ Webseite herunterladen</button></div><iframe id="frame" title="Vorschau der Webseite"></iframe></div></div>' +
      '<div class="b-hinweis"><b>Wie kommt die Seite ins Internet?</b> Die heruntergeladene Datei heißt <code>index.html</code> und enthält alles (auch das Bild). Kostenlos geht es z. B. mit GitHub Pages oder Netlify; mit eigener Adresse (z. B. „tsv-musterdorf.de“) bei einem Anbieter mit Webspace hochladen. Die Domain sollte auf den <b>Kunden</b> laufen, nicht auf dich.</div>';
    t.querySelectorAll("[data-vorlage]").forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.vorlage !== p.vorlage && !confirm("Vorlage wechseln? Die Beispieltexte ersetzen die jetzigen Texte (Kontakt und Impressum bleiben).")) return;
        Object.assign(p, VORLAGEN[b.dataset.vorlage], { vorlage: b.dataset.vorlage }); delete p.name; sichern(); seiteZeigen();
      };
    });
    bindeFelder(t, p, vorschau);
    $("#f_bild").onchange = function () { var d = this.files && this.files[0]; if (!d) return; bildKlein(d, 1600).then(function (u) { p.bild = u; sichern(); seiteZeigen(); }); };
    if ($("#bildWeg")) $("#bildWeg").onclick = function () { p.bild = ""; sichern(); seiteZeigen(); };
    $("#vPc").onclick = function () { $("#vorschau").classList.remove("handy"); };
    $("#vHandy").onclick = function () { $("#vorschau").classList.add("handy"); };
    $("#laden").onclick = function () {
      if (!p.impName || !p.impAnschrift) { if (!confirm("Das Impressum ist noch nicht ausgefüllt. Trotzdem herunterladen (nur als Entwurf)?")) return; }
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([seiteHtml(p)], { type: "text/html" })); a.download = "index.html"; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    };
    vorschau();
  }
  var vT = null;
  function vorschau() { clearTimeout(vT); vT = setTimeout(function () { var fr = $("#frame"); if (fr) fr.srcdoc = seiteHtml(S.seite); }, 200); }
  function bildKlein(d, max) {
    return new Promise(function (ok) { var u = URL.createObjectURL(d), i = new Image(); i.onload = function () { var s = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement("canvas"); c.width = i.width * s; c.height = i.height * s; c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL("image/jpeg", .82)); }; i.src = u; });
  }
  function zeilen(t) { return String(t || "").split("\n").map(function (z) { return z.trim(); }).filter(Boolean); }
  // Lesbare Schrift auf der Farbe: weiß oder fast-schwarz
  function textAuf(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; var L = function (c) { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; var l = .2126 * L(r) + .7152 * L(g) + .0722 * L(b); return (1.05 / (l + .05)) >= 4.5 ? "#ffffff" : "#111111"; }

  function seiteHtml(p) {
    var farbe = /^#[0-9a-f]{6}$/i.test(p.farbe) ? p.farbe : "#1d4ed8", auf = textAuf(farbe);
    var tel = (p.tel || "").replace(/[^\d+]/g, ""), mail = (p.mail || "").trim();
    var knopfHref = p.vorlage === "laden" && tel ? "tel:" + tel : mail ? "mailto:" + mail : tel ? "tel:" + tel : "#kontakt";
    var karte = p.adresse ? "https://www.openstreetmap.org/search?query=" + encodeURIComponent(p.adresse) : "";
    var jahr = new Date().getFullYear();
    return "<!doctype html>\n<html lang=\"de\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>" + esc(p.titel) + "</title>\n<meta name=\"description\" content=\"" + esc(p.slogan + " – " + p.ueber).slice(0, 160) + "\">\n<style>\n" +
      ":root{--f:" + farbe + ";--auf:" + auf + "}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;font-size:18px;line-height:1.6;color:#1a1a1a;background:#fff}" +
      "a{color:var(--f)}.wrap{max-width:960px;margin:0 auto;padding:0 20px}.skip{position:absolute;left:-999px}.skip:focus{left:10px;top:10px;background:#fff;padding:8px;z-index:9}" +
      "header{background:var(--f);color:var(--auf);padding:" + (p.bild ? "0" : "56px 0 48px") + "}header .bild{position:relative;min-height:340px;display:flex;align-items:flex-end;background:#000 center/cover no-repeat}header .bild::after{content:'';position:absolute;inset:0;background:linear-gradient(transparent 30%,rgba(0,0,0,.65))}header .bild .wrap{position:relative;z-index:1;color:#fff;padding-bottom:36px;width:100%}" +
      "h1{font-size:clamp(2rem,6vw,3.2rem);line-height:1.1;margin:0 0 10px}header p{font-size:1.25rem;margin:0 0 22px;opacity:.95}.knopf{display:inline-block;background:#fff;color:#111;font-weight:700;padding:14px 26px;border-radius:999px;text-decoration:none}.knopf:focus-visible,a:focus-visible{outline:3px solid #ff8a3c;outline-offset:3px}" +
      "nav{position:sticky;top:0;background:#fff;border-bottom:1px solid #e5e5e5;z-index:5}nav ul{display:flex;gap:18px;list-style:none;margin:0 auto;padding:12px 20px;max-width:960px;overflow-x:auto}nav a{text-decoration:none;font-weight:600;white-space:nowrap}" +
      "section{padding:44px 0}section:nth-of-type(even){background:#f6f7f9}h2{font-size:1.7rem;margin:0 0 16px;color:var(--f)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:22px}" +
      "ul.punkte{list-style:none;padding:0;margin:0}ul.punkte li{padding:10px 0 10px 32px;position:relative;border-bottom:1px solid #e5e5e5}ul.punkte li::before{content:'';position:absolute;left:4px;top:19px;width:12px;height:12px;border-radius:50%;background:var(--f)}" +
      ".kasten{background:#fff;border:1px solid #e5e5e5;border-radius:14px;padding:20px}footer{background:#111;color:#ddd;padding:32px 0;font-size:.95rem}footer a{color:#fff}details{margin-top:10px}summary{cursor:pointer;font-weight:600}" +
      "@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}\n</style>\n</head>\n<body>\n<a class=\"skip\" href=\"#inhalt\">Zum Inhalt springen</a>\n" +
      "<header>" + (p.bild ? '<div class="bild" style="background-image:url(' + p.bild + ')" role="img" aria-label="Titelbild ' + esc(p.titel) + '"><div class="wrap">' : '<div class="wrap">') +
      "<h1>" + esc(p.titel) + "</h1><p>" + esc(p.slogan) + '</p><a class="knopf" href="' + esc(knopfHref) + '">' + esc(p.knopf || "Kontakt") + "</a></div>" + (p.bild ? "</div>" : "") + "</header>\n" +
      '<nav aria-label="Seitenmenü"><ul><li><a href="#ueber">Über uns</a></li><li><a href="#liste">' + esc(p.listeTitel) + '</a></li><li><a href="#extra">' + esc(p.extraTitel) + '</a></li><li><a href="#kontakt">Kontakt</a></li></ul></nav>\n<main id="inhalt">\n' +
      '<section id="ueber"><div class="wrap"><h2>Über uns</h2>' + zeilen(p.ueber).map(function (z) { return "<p>" + esc(z) + "</p>"; }).join("") + "</div></section>\n" +
      '<section id="liste"><div class="wrap"><h2>' + esc(p.listeTitel) + '</h2><ul class="punkte">' + zeilen(p.liste).map(function (z) { return "<li>" + esc(z) + "</li>"; }).join("") + "</ul></div></section>\n" +
      '<section id="extra"><div class="wrap"><h2>' + esc(p.extraTitel) + '</h2><div class="kasten"><ul class="punkte">' + zeilen(p.extra).map(function (z) { return "<li>" + esc(z) + "</li>"; }).join("") + "</ul></div></div></section>\n" +
      '<section id="kontakt"><div class="wrap"><h2>Kontakt</h2><div class="grid"><div class="kasten">' + (p.adresse ? "<p><b>Adresse</b><br>" + esc(p.adresse) + (karte ? '<br><a href="' + esc(karte) + '" target="_blank" rel="noopener">Auf der Karte zeigen</a>' : "") + "</p>" : "") +
      (tel ? '<p><b>Telefon</b><br><a href="tel:' + esc(tel) + '">' + esc(p.tel) + "</a></p>" : "") + (mail ? '<p><b>E-Mail</b><br><a href="mailto:' + esc(mail) + '">' + esc(mail) + "</a></p>" : "") + "</div></div></div></section>\n</main>\n" +
      '<footer><div class="wrap"><details id="impressum"><summary>Impressum</summary><p><b>Angaben gemäß § 5 DDG</b><br>' + esc(p.impName || "[Name / Verein mit Rechtsform eintragen]") + "<br>" + esc(p.impAnschrift || "[Anschrift eintragen]") + (p.impVertreten ? "<br>" + esc(p.impVertreten) : "") + "</p><p>Kontakt: " + (tel ? esc(p.tel) + " · " : "") + esc(mail || "[E-Mail eintragen]") + "</p></details>" +
      '<details id="datenschutz"><summary>Datenschutz</summary><p>Diese Webseite verwendet keine Cookies, keine Tracker und keine eingebetteten Dienste von Dritten. Beim Aufruf verarbeitet der Webhoster technisch notwendige Daten (z. B. IP-Adresse, Uhrzeit), um die Seite auszuliefern. Wenn Sie uns per E-Mail oder Telefon kontaktieren, nutzen wir Ihre Angaben nur, um Ihre Anfrage zu beantworten. Verantwortlich ist die im Impressum genannte Stelle. Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Beschwerde bei einer Datenschutz-Aufsichtsbehörde.</p><p><small>[Muster – vor der Veröffentlichung prüfen und Angaben zum Webhoster ergänzen.]</small></p></details>' +
      "<p style=\"margin-top:18px\">© " + jahr + " " + esc(p.titel) + ' · Webseite: <a href="' + KUNDEN_URL + '">FIDELIA Digital</a></p></div></footer>\n</body>\n</html>\n';
  }

  /* ================= 2. Angebot ================= */
  function euro(n) { return (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €"; }
  function angebotZeigen() {
    var a = S.angebot, t = $("#tab-angebot");
    if (!a.datum) a.datum = new Date().toISOString().slice(0, 10);
    if (!a.nr) a.nr = "A-" + new Date().getFullYear() + "-" + String(Math.floor(Math.random() * 900) + 100);
    t.innerHTML = '<div class="b-zwei"><div class="b-form card" style="padding:14px">' +
      '<div class="b-hinweis"><b>Wichtig, solange du noch nicht volljährig bist:</b> Sprich jeden Auftrag vorher mit deinen Eltern ab – sie unterschreiben das Angebot mit. Frag sie auch, ob du die Einnahmen anmelden musst (Gewerbe, Steuer). Ich bin keine Rechtsberatung.</div>' +
      f("nr", "Angebots-Nr.", a.nr) + f("datum", "Datum", a.datum, "date") + f("kunde", "Kunde (Name / Verein / Firma)", a.kunde) + f("kundeAdresse", "Anschrift des Kunden", a.kundeAdresse, "text") +
      '<h3>Leistungen</h3><div id="posten"></div><button type="button" class="btn small" id="postenNeu">+ Leistung</button>' +
      '<div class="zeile" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><span class="muted" style="width:100%">Schnell einfügen:</span>' + PAKETE.map(function (x, i) { return '<button type="button" class="chip" data-paket="' + i + '">' + esc(x[0]) + "</button>"; }).join("") + "</div>" +
      f("hinweis", "Hinweis unten (z. B. Wartung)", a.hinweis, "text") + f("gueltig", "Angebot gültig für", a.gueltig) + f("absender", "Absender", a.absender) + f("absenderName", "Dein Name", a.absenderName) +
      '<label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-f="kleinunternehmer"' + (a.kleinunternehmer ? " checked" : "") + "> Ohne Umsatzsteuer ausweisen (Kleinunternehmer – mit Eltern klären)</label>" +
      '<div style="margin-top:14px"><button type="button" class="btn primary" id="drucken">🖨 Drucken / als PDF speichern</button></div></div>' +
      '<div><div class="papier a4 druck" id="angebotBlatt"></div></div></div>';
    bindeFelder(t, a, blatt);
    postenZeigen();
    $("#postenNeu").onclick = function () { a.posten.push({ text: "", menge: 1, preis: 0 }); sichern(); postenZeigen(); blatt(); };
    t.querySelectorAll("[data-paket]").forEach(function (b) { b.onclick = function () { var x = PAKETE[+b.dataset.paket]; a.posten.push({ text: x[1], menge: 1, preis: x[2] }); sichern(); postenZeigen(); blatt(); }; });
    $("#drucken").onclick = function () { window.print(); };
    blatt();
    function postenZeigen() {
      $("#posten").innerHTML = '<div class="b-posten muted" style="font-size:.8rem"><span>Leistung</span><span>Preis (€)</span><span>Menge</span><span></span></div>' + a.posten.map(function (x, i) { return '<div class="b-posten"><input class="inp" data-p="text" data-i="' + i + '" value="' + esc(x.text) + '"><input class="inp" data-p="preis" data-i="' + i + '" value="' + esc(String(x.preis).replace(".", ",")) + '" inputmode="decimal"><input class="inp" data-p="menge" data-i="' + i + '" value="' + esc(x.menge) + '" inputmode="numeric"><button type="button" class="btn small" data-pweg="' + i + '" aria-label="Leistung entfernen">×</button></div>'; }).join("");
      $("#posten").querySelectorAll("[data-p]").forEach(function (el) { el.oninput = function () { var x = a.posten[+el.dataset.i], v = el.value; x[el.dataset.p] = el.dataset.p === "text" ? v : (parseFloat(v.replace(",", ".")) || 0); sichern(); blatt(); }; });
      $("#posten").querySelectorAll("[data-pweg]").forEach(function (b) { b.onclick = function () { a.posten.splice(+b.dataset.pweg, 1); sichern(); postenZeigen(); blatt(); }; });
    }
  }
  var PAKETE = [
    ["Einfache Seite", "Einfache Webseite (1 Seite mit Kontakt, Handy-Ansicht)", 75],
    ["3–5 Seiten", "Webseite mit 3–5 Unterseiten (Entwurf, Umsetzung, Handy-Ansicht)", 180],
    ["Änderung", "Änderung an der Webseite (Texte, Bilder, Termine)", 10],
    ["Wartung / Monat", "Wartung pro Monat (bis zu 3 Änderungen)", 7],
    ["Tablet einrichten", "Tablet für ältere Menschen einrichten (große Ansicht, Kontakte, Fotos, Einweisung) – ca. 2 Stunden", 30],
    ["Technik-Hilfe / Std.", "Technik-Hilfe oder Nachhilfe (pro Stunde)", 12],
    ["Speisekarte", "Digitale Speisekarte mit QR-Aufstellern (FIDELIA Speisekarte) einrichten und drucken", 40],
    ["Turnier", "Turnier planen (Spielplan, Tabelle) und am Turniertag Ergebnisse auf dem Beamer zeigen (FIDELIA Turnier)", 25],
    ["Quiz-Show", "Quiz-Show mit Buzzern für eine Feier: Fragen vorbereiten und Technik aufbauen (FLARESSA Buzzer)", 30],
    ["Fotobox", "Fotobox für eine Feier einrichten – Tablet mit Ständer stellt der Kunde, Fotos danach als ZIP (FLARESSA Fotobox)", 20]
  ];
  function blatt() {
    var a = S.angebot, sum = a.posten.reduce(function (s, x) { return s + (x.menge || 0) * (x.preis || 0); }, 0);
    var d = a.datum ? new Date(a.datum + "T12:00").toLocaleDateString("de-DE") : "";
    $("#angebotBlatt").innerHTML = '<div class="kopf"><div><div style="font-size:22pt;font-weight:600;color:#7c2d92">Angebot</div><div>Nr. ' + esc(a.nr) + "<br>Datum: " + esc(d) + '</div></div><div style="text-align:right"><b>' + esc(a.absender) + "</b>" + (a.absenderName ? "<br>" + esc(a.absenderName) : "") + "<br>kometenwerk.kontakt@gmail.com<br>kometenwerk.github.io/kunden</div></div>" +
      "<p><b>Für:</b><br>" + esc(a.kunde || "[Kunde]") + "<br>" + esc(a.kundeAdresse || "").replace(/\n/g, "<br>") + "</p>" +
      "<p>Vielen Dank für Ihr Interesse! Gerne biete ich Ihnen folgende Leistungen an:</p>" +
      '<table><thead><tr><th>Leistung</th><th class="r">Menge</th><th class="r">Einzelpreis</th><th class="r">Gesamt</th></tr></thead><tbody>' + a.posten.map(function (x) { return "<tr><td>" + esc(x.text) + '</td><td class="r">' + esc(x.menge) + '</td><td class="r">' + euro(x.preis || 0) + '</td><td class="r">' + euro((x.menge || 0) * (x.preis || 0)) + "</td></tr>"; }).join("") +
      '<tr class="summe"><td colspan="3">Gesamtbetrag</td><td class="r">' + euro(sum) + "</td></tr></tbody></table>" +
      (a.kleinunternehmer ? '<p style="font-size:.85rem">Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.</p>' : "") +
      (a.hinweis ? "<p>" + esc(a.hinweis).replace(/\n/g, "<br>") + "</p>" : "") +
      "<p>Zahlung nach Fertigstellung und Abnahme. Texte, Bilder und die Angaben fürs Impressum liefert der Auftraggeber; er ist für deren Rechte und Richtigkeit verantwortlich.</p><p>Dieses Angebot ist " + esc(a.gueltig) + " gültig.</p>" +
      '<div class="unterschrift"><div>Ort, Datum, Unterschrift Auftraggeber</div><div>Unterschrift ' + esc(a.absenderName || "Auftragnehmer") + " und eines Elternteils</div></div>";
  }

  /* ================= 3. Flyer ================= */
  var FLYER = {
    alles: { ico: "💡", ic: ["🌐", "👵", "🛠️", "🍽️", "🎉"], farbe: "#101826", titel: "Ich helfe dir digital", unter: "Webseiten, Technik-Hilfe und Apps für Feste – aus der Region, geduldig erklärt, ohne Werbung und ohne Abo.", punkte: ["Webseite für Verein, Laden oder Ferienwohnung – ab 75 €", "Tablet für Oma und Opa einrichten – ab 30 €", "Technik-Hilfe & Nachhilfe – 12 € pro Stunde", "Speisekarte mit QR-Code – 40 €", "Turnier, Quiz-Show oder Fotobox fürs Fest – ab 20 €"], preis: "Das erste Gespräch ist kostenlos." },
    webseite: { ico: "🌐", ic: ["⚡", "📱", "🛡️", "📅", "✏️"], farbe: "#7c2d92", titel: "Ihre eigene Webseite", unter: "Für Vereine, Läden, Ferienwohnungen und Handwerker – modern, schnell und fürs Handy gemacht.", punkte: ["Fertig in 1–3 Wochen", "Sieht auf Handy, Tablet und PC gut aus", "Keine Werbung, keine Tracker", "Termine, Öffnungszeiten, Kontakt – alles drin", "Änderungen später schnell erledigt"], preis: "Ab 75 € · erstes Gespräch kostenlos" },
    technik: { ico: "🛠️", ic: ["📱", "💬", "🖼️", "🖨️", "📚"], farbe: "#0369a1", titel: "Technik-Hilfe & Nachhilfe", unter: "Handy, Tablet oder Computer streikt? Ich erkläre es geduldig und in Ruhe.", punkte: ["Handy und Tablet einrichten", "WhatsApp, E-Mail und Videoanrufe erklären", "Fotos sichern und ordnen", "Drucker und WLAN verbinden", "Nachhilfe in Informatik und Mathe"], preis: "12 € pro Stunde" },
    feste: { ico: "🎉", ic: ["🍽️", "🏆", "🔔", "📸", "🚫"], farbe: "#b45309", titel: "Digital für Feste & Vereine", unter: "Speisekarte zum Scannen, Turnierplan auf dem Beamer, Quiz-Show mit Buzzern und Fotobox – ich richte alles ein.", punkte: ["Digitale Speisekarte mit QR-Aufstellern", "Turnier: Spielplan, Tabelle, Beamer", "Quiz-Show mit Buzzern für die Feier", "Fotobox auf dem Tablet", "Ohne Werbung, ohne Abo"], preis: "Ab 20 € pro Einsatz" },
    tablet: { ico: "👵", ic: ["📲", "📞", "🖼️", "⏰", "🏠"], farbe: "#4d7c0f", titel: "Das Tablet für Oma und Opa", unter: "Große Knöpfe statt Durcheinander: Familie anrufen, Fotos ansehen, Wetter – ganz einfach.", punkte: ["Einrichtung mit FIDELIA Einfach", "Familie mit Foto – ein Tipp zum Anrufen", "Fotos der Enkel als Diashow", "Erinnerungen an Termine", "Persönliche Einweisung zu Hause"], preis: "Einrichtung ab 30 € (ca. 2 Stunden)" }
  };
  function poster(x, qr, fl) { // großes A4-Poster: mehr Gestaltung, aber ruhig
    var deko = '<svg class="p-deko" viewBox="0 0 400 300" aria-hidden="true"><ellipse cx="270" cy="120" rx="150" ry="52" transform="rotate(-18 270 120)" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-dasharray="3 9"/><path d="M60 40 L215 108" stroke="rgba(255,255,255,.35)" stroke-width="10" stroke-linecap="round"/><path d="M95 30 L222 96" stroke="#ff8a3c" stroke-width="4" stroke-linecap="round" opacity=".9"/><circle cx="232" cy="112" r="15" fill="#ff8a3c"/><circle cx="227" cy="107" r="4" fill="#fff" opacity=".8"/><circle cx="110" cy="210" r="2.5" fill="#fff" opacity=".6"/><circle cx="360" cy="40" r="2" fill="#fff" opacity=".7"/><circle cx="330" cy="230" r="3" fill="#fff" opacity=".5"/><path d="M372 262 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fff" opacity=".7"/></svg>';
    var zeilen = x.punkte.map(function (p, i) {
      var m = / – ((ab )?[\d,]+ €.*)$/.exec(p), text = m ? p.slice(0, m.index) : p;
      return '<div class="p-z"><span class="p-ic" style="background:' + x.farbe + '1a">' + (x.ic && x.ic[i] || "✔") + "</span><span>" + esc(text) + "</span>" + (m && fl.preise ? '<span class="p-preis">' + esc(m[1]) + "</span>" : "") + "</div>";
    }).join("");
    var schritte = [["1", "Melden", "per E-Mail oder QR-Code"], ["2", "Kostenlos besprechen", "was du brauchst"], ["3", "Fertig!", "ich richte alles ein"]].map(function (s) { return '<div class="p-s"><b style="background:' + x.farbe + '">' + s[0] + "</b><div><strong>" + s[1] + "</strong><small>" + s[2] + "</small></div></div>"; }).join("");
    var abreiss = fl.abreiss !== false ? '<div class="p-ab">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function () { return "<div><span><b>Digitale Hilfe</b><br>kometenwerk.kontakt@gmail.com</span></div>"; }).join("") + "</div>" : "";
    return '<div class="poster' + (abreiss ? "" : " ohne-ab") + '"><div class="p-kopf" style="background:linear-gradient(135deg,' + x.farbe + ',' + x.farbe + 'cc)">' + deko + '<div class="p-kt"><div class="marke">FIDELIA Digital · OMNIVIA Group</div><h2>' + esc(x.titel) + "</h2><p>" + esc(x.unter) + '</p></div><div class="p-gross" aria-hidden="true">' + (x.ico || "") + "</div></div>" +
      '<div class="p-inhalt">' + zeilen + (fl.preise && x.preis ? '<div class="p-hinweis">' + esc(x.preis) + "</div>" : "") + '</div><div class="p-schritte">' + schritte + '</div><div class="p-kontakt">' + qr + '<div><div class="p-k1">Einfach melden</div><div class="p-k2">kometenwerk.kontakt@gmail.com</div><div class="p-k3">kometenwerk.github.io/kunden · ohne Werbung, ohne Abo</div></div></div>' + abreiss + "</div>";
  }
  function flyerZeigen() {
    var fl = S.flyer, t = $("#tab-flyer");
    t.innerHTML = '<div class="card" style="padding:14px"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      Object.keys(FLYER).map(function (k) { return '<button type="button" class="btn' + (fl.art === k ? " primary" : "") + '" data-art="' + k + '">' + esc(FLYER[k].titel) + "</button>"; }).join("") +
      '<span style="flex:1"></span><select class="inp" id="fFormat" style="width:auto"><option value="a4"' + (fl.format === "a4" ? " selected" : "") + '>1 × A4 (Aushang)</option><option value="a6"' + (fl.format === "a6" ? " selected" : "") + '>4 × A6 auf A4 (zum Verteilen)</option></select>' +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="fPreis"' + (fl.preise ? " checked" : "") + "> Preis zeigen</label>" +
      (fl.format !== "a6" ? '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="fAbreiss"' + (fl.abreiss !== false ? " checked" : "") + "> Abreißzettel</label>" : "") +
      '<button type="button" class="btn primary" id="fDruck">🖨 Drucken</button></div><p class="muted" style="margin:8px 0 0">Tipp: Beim Drucken „Ränder: Keine“ und „Hintergrundgrafiken“ einschalten. Der QR-Code führt zur Kunden-Seite. Flyer nur dort aufhängen, wo es erlaubt ist (Supermarkt-Brett, Vereinsheim – vorher fragen).</p></div>' +
      '<div class="papier druck" id="flyerBlatt"></div>';
    t.querySelectorAll("[data-art]").forEach(function (b) { b.onclick = function () { fl.art = b.dataset.art; sichern(); flyerZeigen(); }; });
    $("#fFormat").onchange = function () { fl.format = this.value; sichern(); flyerZeigen(); };
    $("#fPreis").onchange = function () { fl.preise = this.checked; sichern(); flyerZeigen(); };
    $("#fDruck").onclick = function () { window.print(); };
    if ($("#fAbreiss")) $("#fAbreiss").onchange = function () { fl.abreiss = this.checked; sichern(); flyerZeigen(); };
    var x = FLYER[fl.art], qr = "";
    try { var q = window.qrcode(0, "M"); q.addData(KUNDEN_URL + (fl.art === "tablet" ? "#tablet" : fl.art === "technik" ? "#hilfe" : fl.art === "feste" ? "#vereine" : "")); q.make(); qr = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) {}
    var einer = '<div class="flyer"><div class="fk" style="background:' + x.farbe + '"><div class="marke">FIDELIA Digital · OMNIVIA Group</div><h2>' + esc(x.titel) + "</h2><p>" + esc(x.unter) + '</p></div><div class="fb"><ul>' + x.punkte.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" + (fl.preise ? '<div class="preis">' + esc(x.preis) + "</div>" : "") + '</div><div class="ff">' + qr + '<div class="k"><b>Einfach melden:</b><br>kometenwerk.kontakt@gmail.com<br>kometenwerk.github.io/kunden</div></div></div>';
    $("#flyerBlatt").innerHTML = fl.format === "a6" ? '<div class="a6-bogen">' + einer + einer + einer + einer + "</div>" : poster(x, qr, fl);
  }

  seiteZeigen();
})();
