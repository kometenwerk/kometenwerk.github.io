/* FIDELIA Küche – Rezepte aus Text verstehen (Zutaten, Schritte, Portionen, Zeit) */
(function () {
  "use strict";
  var EINHEITEN = "kg|g|mg|ml|cl|dl|l|liter|gramm|kilogramm|el|tl|esslöffel|teelöffel|prise|prisen|msp|messerspitze|pck|päckchen|pkg|packung|stk|stück|becher|dose|dosen|bund|zehe|zehen|scheibe|scheiben|tasse|tassen|glas|gläser|handvoll|spritzer|würfel|blatt|blätter|zweig|zweige|tropfen|cup|cups|tbsp|tsp|oz|lb";
  var BRUCH = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
  var ZAHL = "(\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d+(?:[.,]\\d+)?\\s*[½¼¾⅓⅔⅛]?|[½¼¾⅓⅔⅛])";
  var RE_ZUTAT = new RegExp("^\\s*(?:[-•*·–]\\s*)?" + ZAHL + "(?:\\s*(?:-|–|bis)\\s*" + ZAHL + ")?\\s*(" + EINHEITEN + ")?\\.?(?=\\s|$)\\s*(.*)$", "i");
  var RE_OHNE_MENGE = /^\s*(?:[-•*·–]\s*)?(etwas|n\.\s?b\.|nach belieben|evtl\.|ggf\.|eine? prise|salz|pfeffer)\b/i;

  function zahl(t) {
    if (!t) return null;
    t = String(t).trim().replace(",", ".");
    var m;
    if ((m = t.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/))) return +m[1] + m[2] / m[3];
    if ((m = t.match(/^(\d+)\s*\/\s*(\d+)$/))) return m[1] / m[2];
    if ((m = t.match(/^(\d+(?:\.\d+)?)\s*([½¼¾⅓⅔⅛])$/))) return +m[1] + BRUCH[m[2]];
    if (BRUCH[t] != null) return BRUCH[t];
    var n = parseFloat(t); return isFinite(n) ? n : null;
  }
  function einheitNorm(e) {
    if (!e) return "";
    var k = e.toLowerCase().replace(/\.$/, "");
    var M = { gramm: "g", kilogramm: "kg", liter: "l", "esslöffel": "EL", el: "EL", "teelöffel": "TL", tl: "TL", prisen: "Prise", prise: "Prise", "päckchen": "Pck.", pck: "Pck.", pkg: "Pck.", packung: "Pck.", stk: "Stück", "stück": "Stück", msp: "Msp.", messerspitze: "Msp.", tbsp: "EL", tsp: "TL" };
    return M[k] || (k.length <= 2 ? k : e.charAt(0).toUpperCase() + e.slice(1).toLowerCase());
  }
  /* Eine Zutaten-Zeile zerlegen: "200 g Mehl" → {menge:200, einheit:"g", name:"Mehl"} */
  function zutat(zeile) {
    var roh = String(zeile).replace(/\s+/g, " ").replace(/^[-•*·–]\s*/, "").trim();
    var m = roh.match(RE_ZUTAT);
    if (m && m[4] != null && (m[4].trim() || m[3])) {
      return { menge: zahl(m[1]), bis: zahl(m[2]), einheit: einheitNorm(m[3]), name: m[4].trim(), roh: roh };
    }
    return { menge: null, bis: null, einheit: "", name: roh, roh: roh };
  }
  function istZutatZeile(z) {
    if (z.length > 70) return false;
    if (/^\d+\s*[.)]\s+\S/.test(z) && z.length > 30) return false; // nummerierter Schritt
    return RE_ZUTAT.test(z) || RE_OHNE_MENGE.test(z);
  }
  function minuten(t) {
    t = String(t || "");
    var iso = t.match(/^P(?:T)?(?:(\d+)H)?(?:(\d+)M)?/i);
    if (iso && (iso[1] || iso[2])) return (+(iso[1] || 0)) * 60 + (+(iso[2] || 0));
    var h = t.match(/(\d+(?:[.,]\d+)?)\s*(?:std|stunde)/i), m = t.match(/(\d+)\s*(?:min)/i), s = 0;
    if (h) s += parseFloat(h[1].replace(",", ".")) * 60;
    if (m) s += +m[1];
    return s || null;
  }
  function portionen(t) {
    var m = String(t || "").match(/(?:für|ergibt|reicht für|portionen:?|personen:?|stücke?:?)\s*(?:ca\.\s*)?(\d+)/i) || String(t || "").match(/(\d+)\s*(?:portionen|personen|stücke?|stück|pers\.)/i);
    return m ? +m[1] : null;
  }

  /* Ganzen Text (gescannt oder eingefügt) in ein Rezept verwandeln */
  function ausText(text) {
    var zeilen = String(text || "").replace(/\r/g, "").split("\n").map(function (z) { return z.replace(/\s+/g, " ").trim(); });
    var r = { titel: "", portionen: null, zeit: null, zutaten: [], schritte: [] };
    var modus = "", schrittText = [], i;
    for (i = 0; i < zeilen.length; i++) {
      var z = zeilen[i];
      if (!z) { if (modus === "schritte" && schrittText.length) { r.schritte.push(schrittText.join(" ")); schrittText = []; } continue; }
      if (!r.portionen && portionen(z) && z.length < 60) r.portionen = portionen(z);
      if (!r.zeit && /(zeit|dauer)/i.test(z) && z.length < 70 && minuten(z) && !/^\d+\s*[.)]/.test(z) && modus !== "schritte") r.zeit = minuten(z);
      if (/^zutaten\b/i.test(z)) { modus = "zutaten"; var rest = z.replace(/^zutaten\s*(f(ü|u)r[^:]*)?:?\s*/i, ""); if (rest && istZutatZeile(rest)) r.zutaten.push(zutat(rest)); continue; }
      if (/^(zubereitung|anleitung|so geht'?s|arbeitsschritte|schritte|herstellung|und so geht'?s)\b/i.test(z)) { modus = "schritte"; continue; }
      if (!r.titel && !modus && !istZutatZeile(z) && z.length < 70 && !/^(für|portionen|zubereitungszeit|arbeitszeit|gesamtzeit)/i.test(z)) { r.titel = z.replace(/[:.]$/, ""); continue; }
      if (/^(für|portionen|zubereitungszeit|arbeitszeit|gesamtzeit|backzeit|kochzeit|ruhezeit)\b/i.test(z) && z.length < 70 && modus !== "schritte") continue;
      if (modus === "zutaten" || (!modus && istZutatZeile(z))) {
        if (modus === "zutaten" && !istZutatZeile(z) && z.length > 60) { modus = "schritte"; }
        else { r.zutaten.push(zutat(z)); continue; }
      }
      // Schritte: neuer Schritt bei Nummer, sonst Zeile anhängen (OCR bricht Sätze um)
      modus = modus || "schritte";
      var neu = z.match(/^(?:schritt\s*)?(\d{1,2}|[A-Z])\s*[.):]\s+(.*)$/);
      if (neu && (/\d/.test(neu[1]) || schrittText.length)) { if (schrittText.length) r.schritte.push(schrittText.join(" ")); schrittText = [neu[2]]; }
      else if (schrittText.length && /[.!]$/.test(schrittText[schrittText.length - 1]) && /^[A-ZÄÖÜ]/.test(z) && schrittText.join(" ").length > 40) { r.schritte.push(schrittText.join(" ")); schrittText = [z]; }
      else schrittText.push(z);
    }
    if (schrittText.length) r.schritte.push(schrittText.join(" "));
    r.schritte = r.schritte.map(function (s) { return s.replace(/\s+([,.!?])/g, "$1").replace(/(\w)- (\w)/g, "$1$2").trim(); }).filter(function (s) { return s.length > 2; });
    r.zutaten = r.zutaten.filter(function (z) { return z.name.length > 0; });
    return r;
  }

  /* Mengen umrechnen und hübsch anzeigen */
  var BRUCH_ZEIGEN = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
  function schoen(n, einheit) {
    if (n == null) return "";
    if (/^(g|ml)$/.test(einheit) && n >= 50) return String(Math.round(n / 5) * 5);
    if (/^(g|ml)$/.test(einheit) && n >= 10) return String(Math.round(n));
    var ganz = Math.floor(n + 1e-9), rest = n - ganz;
    if (!/^(g|ml|kg|l|cl|dl|mg)$/.test(einheit)) {
      if (rest < 0.08) return String(ganz || (n > 0 ? "1" : "0"));
      if (rest > 0.92) return String(ganz + 1);
      for (var i = 0; i < BRUCH_ZEIGEN.length; i++) if (Math.abs(rest - BRUCH_ZEIGEN[i][0]) < 0.09) return (ganz ? ganz + " " : "") + BRUCH_ZEIGEN[i][1];
    }
    return String(Math.round(n * 10) / 10).replace(".", ",");
  }
  function mengeText(z, faktor) {
    if (z.menge == null) return "";
    var a = schoen(z.menge * faktor, z.einheit), b = z.bis != null ? "–" + schoen(z.bis * faktor, z.einheit) : "";
    return a + b + (z.einheit ? " " + z.einheit : "");
  }

  /* Zeiten in Schritten finden („20 Minuten backen“) */
  function timer(schritt) {
    var out = [], re = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?\s*(Minuten|Minute|Min\.?|Stunden|Stunde|Std\.?|Sekunden|Sek\.?)(?![a-zäöü])/gi, m;
    while ((m = re.exec(schritt))) {
      var w = parseFloat(String(m[2] || m[1]).replace(",", ".")), e = m[3].toLowerCase(), sek = /^s/.test(e) && !/^std|^stu/.test(e) ? w : /^(std|stu)/.test(e) ? w * 3600 : w * 60;
      if (sek > 0 && sek <= 24 * 3600) out.push({ text: m[0], sek: Math.round(sek) });
    }
    return out;
  }

  window.Rezept = { ausText: ausText, zutat: zutat, mengeText: mengeText, timer: timer, minuten: minuten, portionen: portionen };
})();
