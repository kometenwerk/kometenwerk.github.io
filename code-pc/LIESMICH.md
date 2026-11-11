# Kometenwerk Code

Eigenes PC-Programm zum Arduino-Programmieren (wie die Arduino IDE), im Kometenwerk-Aussehen und mit Erklärungen auf Deutsch.

- **✓ Prüfen** übersetzt den Code mit dem echten Arduino-Übersetzer. Die Fehler werden auf Deutsch erklärt, z. B. „`brind` gibt es bei Serial nicht. Meintest du `Serial.begin`?“.
- **➜ Hochladen** auf Uno, Nano, Mega, Leonardo und Micro. Board und Port werden erkannt.
- **Serieller Monitor**, Sketchbook in „Dokumente/Kometenwerk Code“, Vorlagen, Bibliotheken suchen und installieren.
- **Aus FIDELIA Notizen:** Auf der Code-Seite gibt es „➜ Hochladen“ → „Im PC-Programm öffnen“. Das läuft über den Link `kometenwerk-code://oeffnen?name=…&code=…`.

## Aufbau
| Datei | Aufgabe |
|---|---|
| `src/main.cjs` | Fenster, Dateien, `arduino-cli` (einrichten, compile, upload, monitor, lib) |
| `src/preload.cjs` | sichere Brücke `window.KC` |
| `src/app.js`, `src/editor.js`, `src/style.css`, `src/index.html` | Oberfläche |
| `src/code-kern.js` | **Kopie** aus `notizen/code-kern.js`, mit Farben, Vorschlägen und der eigenen Prüfung. Bei Änderungen beide Dateien gleich halten. |
| `src/uebersetzer.js` | gcc- und avrdude-Meldungen auf Deutsch |
| `werkzeug/` | `arduino-cli`, das holt sich GitHub Actions beim Bauen |

## Bauen
GitHub Actions (`.github/workflows/kometenwerk-code.yml`) baut bei jeder Änderung in `code-pc/` automatisch:
- Windows: Setup und eine Version ohne Installation
- Linux: AppImage

Beides liegt dann unter **Releases → „Kometenwerk Code – neueste Version“**.

Lokal:
```
npm install
npm start
```
Dafür muss `arduino-cli` im PATH sein oder in `werkzeug/` liegen.

Tests: `npm test`
