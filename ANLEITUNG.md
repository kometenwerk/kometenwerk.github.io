# Kometenwerk – Startseite und Apps hochladen

Alles in diesem Ordner gehört in **ein** Repository: `kometenwerk.github.io`
(in der Organisation kometenwerk, Public).

## Hochladen
1. Repository `kometenwerk.github.io` öffnen → „Add file“ → „Upload files“.
2. **Alles** aus diesem Ordner hineinziehen – auch die Ordner
   `shared`, `icons`, `planer`, `notizen`, `quiz`, `werkstatt`, `ki`,
   `beats`, `fokus`, `taschengeld`, `team` und `Krawallzoo`.
3. Unten auf „Commit changes“ klicken.
4. Settings → Pages: Branch `main`, Ordner `/ (root)` → Save.

## Danach erreichbar
- Startseite mit Suche: https://kometenwerk.github.io/
- Krawallzoo:  https://kometenwerk.github.io/Krawallzoo/
- Planer:    https://kometenwerk.github.io/planer/
- Notizen:   https://kometenwerk.github.io/notizen/
- Quiz:      https://kometenwerk.github.io/quiz/
- Werkstatt: https://kometenwerk.github.io/werkstatt/
- KI:        https://kometenwerk.github.io/ki/
- Beats:     https://kometenwerk.github.io/beats/
- Fokus:     https://kometenwerk.github.io/fokus/
- Taschengeld: https://kometenwerk.github.io/taschengeld/

Jede App hat oben den Knopf „Als App installieren“.

## Gut zu wissen
- Die Daten (Hausaufgaben, Notizen, Lernkarten) bleiben auf dem Gerät.
  Unten in jeder App gibt es „Sicherung speichern“ und „Sicherung laden“.
- Das Wissens-Quiz und die Suche holen sich die Inhalte aus dem
  Nachrichten-Heft. Das klappt erst, wenn das Repository **ND** in die
  Organisation kometenwerk umgezogen ist.
- Der Ordner `shared` enthält Stil und Helfer für alle Apps – nicht löschen.
- Die Datei `sw.js` im Hauptordner räumt nur einen alten Offline-Speicher auf – drin lassen.
- Das Nachrichten-Heft gehört NICHT hier hinein, es hat sein eigenes Repository `ND`.

## Entwickler-Chat (Kometen-Team)
Adresse: https://kometenwerk.github.io/team/ (steht absichtlich nicht im App-Menü
und wird von Google nicht angezeigt – er ist nur für euer Team).

Damit der Chat funktioniert, muss in Firebase einmal die neue Regel-Datei rein:
1. https://console.firebase.google.com → Projekt **krawallzoo** öffnen.
2. Links „Realtime Database“ → oben „Regeln“.
3. Alles markieren und löschen, dann den kompletten Inhalt von
   `database.rules.json` (liegt neben dieser ZIP) einfügen → „Veröffentlichen“.
   Die Datei enthält die alten Krawallzoo-Regeln **plus** die neuen Chat-Regeln.
4. Chat öffnen → **du zuerst!** Wer zuerst kommt, gründet das Team und wird Chef.
5. Freunden den Link schicken. Sie schicken eine Anfrage, du vergleichst den
   4-stelligen Code auf ihrem Bildschirm und tippst auf „Aufnehmen“.

Gut zu wissen: Chat und Krawallzoo teilen sich die kostenlose Firebase-Grenze
von etwa 100 Verbindungen gleichzeitig.
