# Rezept-Helfer einrichten (einmalig, kostenlos)

Damit „Link einfügen“ in der Kometen-Küche funktioniert, braucht es einen kleinen Helfer im Internet.
Ein Browser darf fremde Seiten nämlich nicht selbst auslesen. Der Helfer holt die Rezeptseite
und gibt **nur** die Rezept-Daten zurück (Titel, Zutaten, Schritte, Bild) – nie die ganze Seite.

Du hast für das Nachrichten-Heft schon ein Cloudflare-Konto – genau dort kommt er hin.

1. https://dash.cloudflare.com öffnen und anmelden.
2. Links **Workers & Pages** → **Erstellen** → **Worker erstellen**.
3. Name: `rezept-helfer` → **Bereitstellen**.
4. **Code bearbeiten** → alles löschen → den Inhalt von `rezept-helfer-worker.js` einfügen → **Bereitstellen**.
5. Oben steht jetzt die Adresse, z. B. `https://rezept-helfer.DEINNAME.workers.dev`. Kopieren.
6. Auf GitHub die Datei `kueche/einstellungen.json` öffnen, die Adresse bei `"helfer"` eintragen, speichern.

Fertig! Nach 1–2 Minuten funktioniert „Link einfügen“ für alle.

**Sicherheit:** Der Helfer antwortet nur, wenn die Anfrage von `kometenwerk.github.io` kommt.
Er speichert nichts. Der kostenlose Cloudflare-Tarif reicht für 100.000 Anfragen am Tag.
