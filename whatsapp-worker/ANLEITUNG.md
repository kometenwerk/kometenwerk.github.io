# WhatsApp-Anbindung (Cloudflare Worker)

Der Worker nimmt Meta-WhatsApp-Webhooks an, antwortet nur auf Textnachrichten
von der festgelegten eigenen WhatsApp-ID und verwendet ausschließlich die
Rollen Sofie, Paul und Nova. Die Rollen werden mit `/sofie`, `/paul` oder
`/nova` gewählt; ohne Befehl antwortet Sofie. Es gibt keinen Endpunkt zum
proaktiven Anschreiben und keine Verbindung zu Firebase oder zur Team-Webseite.

## Voraussetzungen

- Cloudflare-Konto und Wrangler (`npm install --global wrangler`)
- Meta-App mit WhatsApp Cloud API und eigener Business-Telefonnummer
- Gemini API-Schlüssel. Die Gemini API kann kostenpflichtig sein; vor Nutzung
  Kosten und Limits im Google-Konto prüfen.
- Die eigene WhatsApp-ID im Meta-Webhook-Format (Ländervorwahl, nur Ziffern)

GitHub Pages kann den Webhook nicht betreiben. Die Worker-Secrets dürfen nicht
in die Website, in Git oder in Chat-Nachrichten geschrieben werden.
Ein temporärer WhatsApp-Testzugriffstoken aus dem Meta-API-Setup läuft ab und
ist daher nicht für einen dauerhaften 24/7-Betrieb geeignet. Dafür muss in Meta
ein dauerhaft verwalteter Zugriff (zum Beispiel über einen Systembenutzer mit
den nötigen WhatsApp-Berechtigungen) eingerichtet und regelmäßig geprüft
werden. Testnummern können nur ausdrücklich freigegebene Empfänger erreichen.

## Einrichten

1. Node.js LTS installieren und danach ein neues PowerShell-Fenster öffnen.
   In den Worker-Ordner wechseln:

   ```powershell
   cd "C:\Users\david\OneDrive\Dokumente\GitHub\kometenwerk.github.io\whatsapp-worker"
   ```

2. Wrangler mit `npx wrangler login` mit deinem Cloudflare-Konto verbinden.
   Falls `npx` fragt, ob Wrangler geladen werden darf, bestätige den Start.
3. Einen eigenen, schwer zu erratenden Verify-Token erzeugen und für jede
   Einstellung einen geheimen Wert setzen:

   ```text
   npx wrangler secret put META_APP_SECRET
   npx wrangler secret put META_VERIFY_TOKEN
   npx wrangler secret put WHATSAPP_ACCESS_TOKEN
   npx wrangler secret put WHATSAPP_PHONE_NUMBER_ID
   npx wrangler secret put OWNER_WA_ID
   npx wrangler secret put GEMINI_API_KEY
   ```

   Wrangler fragt den Wert interaktiv ab. Keine Werte in Befehlszeilen, Git,
   Screenshots oder Chat-Nachrichten eintragen.

4. Mit `npx wrangler deploy` bereitstellen. Die Webhook-URL lautet danach
   `https://<worker-name>.<account-subdomain>.workers.dev/webhook`.
5. Diese URL und den Wert von `META_VERIFY_TOKEN` in der Meta-App unter
   WhatsApp → Konfiguration als Callback-URL und Verify-Token eintragen.
   Das Nachrichtenfeld `messages` abonnieren.
6. Für den ersten Test eine Textnachricht von der eigenen, freigegebenen
   WhatsApp-Nummer an die Cloud-API-Testnummer senden, zum Beispiel
   `/paul Was ist der nächste Schritt?`.

Die Rollenwahl kann `/sofie`, `/paul` oder `/nova` sein. Ohne Rollenbefehl
antwortet Sofie. Nur die unter `OWNER_WA_ID` konfigurierte Absender-ID wird
akzeptiert.

Meta kann Testnummern, Empfänger und Vorlagen einschränken. Außerhalb des
zulässigen WhatsApp-Servicefensters kann Meta eine genehmigte Vorlage verlangen.
Der Worker sendet deshalb ausschließlich die Antwort auf eine eingehende
Nachricht, keine selbst gestarteten Benachrichtigungen.

## Grenzen und Datenschutz

- Nur Nachrichten des konfigurierten `OWNER_WA_ID` werden verarbeitet. Andere
  Absender werden ignoriert.
- Der Worker hat keine eigene Datenbank und speichert Nachrichtentexte nicht
  absichtlich. Cloudflare kann nach den Worker-Einstellungen technische
  Aufruf-/Fehlerdaten erfassen. Meta, Cloudflare und Google verarbeiten die
  Daten technisch gemäß ihren jeweiligen Bedingungen.
- Anhänge, Gruppen und Statusmeldungen werden nicht verarbeitet.
- Eingehende Nachrichtentexte werden zur Antwortgenerierung an Gemini gesendet.
- Der Worker kann weder den lokalen Planer noch Firebase, den Team-Chat,
  YouTube oder E-Mail lesen. Er führt keine externen Aktionen aus.
- Gemini-Ausgaben können falsch sein; wichtige Antworten bitte prüfen.
- Es gibt keine dauerhafte Dubletten-Sperre. Meta kann Webhooks erneut senden;
  im Fall einer Wiederholung kann dieselbe Antwort nochmals verschickt werden.
