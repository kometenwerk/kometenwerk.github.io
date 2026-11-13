// Mitmach-Anfrage → landet in der Team-App unter 📥 Anfragen (gleiche Datenbank-Regel wie die Kunden-Anfragen).
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var esc = KW.esc;
  var DB = "https://krawallzoo-default-rtdb.europe-west1.firebasedatabase.app";
  var MAIL = "kometenwerk.kontakt@gmail.com";
  var geladen = Date.now(), laeuft = false;

  function wert(id) { return $(id).value.trim(); }
  function rollen() { return Array.prototype.slice.call(document.querySelectorAll('input[name="rolle"]:checked')).map(function (c) { return c.value; }); }
  function zeigen(klasse, html) { var a = $("antwort"); a.hidden = false; a.className = klasse; a.innerHTML = html; a.scrollIntoView({ behavior: "smooth", block: "center" }); }

  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (laeuft) return;
    var name = wert("fName"), alter = parseInt(wert("fAlter"), 10), schule = wert("fSchule"), klasse = wert("fKlasse"), mail = wert("fMail"), r = rollen();
    if (!name) { KW.toast("Schreib bitte deinen Vornamen."); $("fName").focus(); return; }
    if (!alter || alter < 6 || alter > 99) { KW.toast("Schreib bitte dein Alter als Zahl."); $("fAlter").focus(); return; }
    if (alter < 13) { zeigen("m-fehler", "<b>Schön, dass du Lust hast! 😊</b><p>Mitmachen geht bei uns erst ab 13 Jahren – so sind die Regeln für Jugendliche. Melde dich gern wieder, wenn du 13 bist!</p>"); return; }
    if (!schule || !klasse) { KW.toast("Schreib bitte Schule und Klasse dazu."); (schule ? $("fKlasse") : $("fSchule")).focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(mail)) { KW.toast("Die E-Mail-Adresse stimmt noch nicht."); $("fMail").focus(); return; }
    if (!r.length) { KW.toast("Kreuz bitte mindestens eine Sache an, die du machen willst."); return; }
    if (!$("fEltern").checked) { KW.toast("Bitte sag erst deinen Eltern Bescheid und setz dann den Haken."); $("fEltern").focus(); return; }
    if (!$("fDaten").checked) { KW.toast("Bitte setz noch den Haken beim Speichern der Angaben."); $("fDaten").focus(); return; }
    var zuletzt = KW.load("kw-mitmachen-gesendet", 0);
    if (Date.now() - zuletzt < 10 * 60 * 1000) { zeigen("m-fehler", "<b>Du hast gerade schon eine Anfrage geschickt.</b><p>Wir melden uns bei dir – warte bitte ein paar Minuten, wenn du noch etwas ergänzen willst.</p>"); return; }

    var text = ("Alter: " + alter + " · Schule: " + schule + ", Klasse " + klasse + " · Zeit: " + $("fUmfang").value + " · Eltern wissen Bescheid: ja" + (wert("fWarum") ? "\nWarum / Was kann ich: " + wert("fWarum") : "")).slice(0, 800);
    var eintrag = { firma: "omnivia", anliegen: "Mitmachen", paket: "–", bausteine: r.join(", ").slice(0, 400), name: name.slice(0, 80), kontakt: mail.slice(0, 120), alt: "", text: text, gespraech: (wert("fZeit") || "egal").slice(0, 40), gefunden: "Mitmach-Seite", zeit: { ".sv": "timestamp" } };
    var bot = wert("fWeb") || Date.now() - geladen < 4000;

    laeuft = true; $("senden").disabled = true; $("senden").textContent = "⏳ Wird geschickt …";
    var ctrl = "AbortController" in window ? new AbortController() : null; if (ctrl) setTimeout(function () { ctrl.abort(); }, 12000);
    (bot ? Promise.resolve({ ok: true }) : fetch(DB + "/anfragen.json", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(eintrag), signal: ctrl ? ctrl.signal : undefined }))
      .then(function (res) {
        if (!res.ok) throw new Error(res.status);
        KW.save("kw-mitmachen-gesendet", Date.now()); $("senden").textContent = "✔ Geschickt";
        $("form").querySelectorAll("input,textarea,select,button").forEach(function (x) { x.disabled = true; });
        zeigen("m-ok", "<b>Danke, " + esc(name) + "! Deine Anfrage ist angekommen. 🎉</b><p>Wir melden uns per E-Mail und machen ein kurzes Gespräch aus. Danach entscheiden wir gemeinsam, ob es passt.</p>");
      })
      .catch(function () {
        laeuft = false; $("senden").disabled = false; $("senden").textContent = "🙋 Anfrage schicken";
        var body = "Hallo,\n\nich möchte bei OMNIVIA mitmachen.\n\nName: " + name + "\nE-Mail: " + mail + "\nRollen: " + r.join(", ") + "\nGespräch: " + (wert("fZeit") || "egal") + "\n" + text;
        zeigen("m-fehler", "<b>Das hat gerade nicht geklappt.</b><p>Schick deine Anfrage stattdessen per E-Mail an <b>" + esc(MAIL) + "</b>. Dein E-Mail-Programm sollte sich öffnen; sonst kopier diesen Text:</p><pre>" + esc(body) + "</pre>");
        location.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent("Mitmachen bei OMNIVIA") + "&body=" + encodeURIComponent(body);
      });
  });
})();
