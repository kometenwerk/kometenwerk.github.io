# Lokaler YouTube-Uploadhelfer

Der Helfer läuft auf `http://localhost:4390` und lädt ausgewählte Videos mit YouTube Data API v3 **immer privat** hoch. Er stellt keinen öffentlich erreichbaren Server bereit. OAuth-Datei und Tokens liegen außerhalb des Repositorys in `%LOCALAPPDATA%\Kometenwerk\YouTube\`.

## Einmalige Einrichtung

1. Node.js LTS installieren, falls `node` und `npm` noch nicht verfügbar sind.
2. Im Terminal in diesen Ordner wechseln und `npm install` ausführen.
3. `npm start` ausführen und `http://127.0.0.1:4390` im Browser öffnen.
4. Im Helfer die heruntergeladene Google-OAuth-JSON-Datei auswählen und **Datei lokal einrichten** drücken. Sie wird durch den lokalen Helfer außerhalb des Repositorys unter `%LOCALAPPDATA%\Kometenwerk\YouTube\` gespeichert.
5. **Mit Google verbinden** wählen und im Google-Fenster das Google-Konto anmelden, das den YouTube-Kanal verwaltet. Die Autorisierung umfasst nur `youtube.upload`.
6. Ein Video, Titel und Beschreibung auswählen. Der Upload ist fest auf **privat** eingestellt; die Veröffentlichung erfolgt anschließend manuell in YouTube Studio.

Beim ersten Start kann Google bei einer OAuth-App im Testmodus eine Warnseite anzeigen. Das ist bei einem eigenen, noch nicht geprüften OAuth-Projekt erwartbar; nur fortfahren, wenn oben das eigene Projekt/App angezeigt wird.

## Trennen / Daten löschen

In der Oberfläche **Verbindung trennen** wählen. Dadurch wird der lokale Token gelöscht und der aktuelle Zugriff widerrufen. Die OAuth-Client-JSON bleibt erhalten, bis sie manuell aus dem lokalen AppData-Ordner entfernt wird.

## Grenzen

- Das ist ein lokaler Upload-Helfer, keine Hintergrundautomation und keine direkte Fernsteuerung durch das Team-Webchat. Dein PC und das Terminal müssen während eines Uploads laufen.
- Die Teamseite kann weiterhin Titel, Beschreibung und Videoideen erstellen; die fertigen Inhalte müssen in diesen lokalen Helfer übertragen werden.
- Die API-Quota und Googles Projekt-/Upload-Beschränkungen gelten weiterhin. Uploads aus nicht verifizierten API-Projekten können auf privat beschränkt sein.
- OAuth-Datei und Tokens enthalten Zugangsdaten. Sie werden bewusst nicht im Repository abgelegt.
