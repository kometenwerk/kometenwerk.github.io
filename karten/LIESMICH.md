# OMNIVIA Karten

Karte und Navi für Südbaden (Regierungsbezirk Freiburg) mit **eigenem Routenplaner**.

| Datei | Aufgabe |
|---|---|
| `index.html`, `app.js`, `karten.css` | Oberfläche (Karte mit MapLibre, Kartenbilder von OpenFreeMap) |
| `netz.js` | Eigener Routenplaner: A*-Suche auf dem OpenStreetMap-Straßennetz, Auto/Rad/zu Fuß, Abbiege-Hinweise |
| `suche.js` | Suche nach Orten, Straßen, Hausnummern und Zielen – läuft komplett auf dem Gerät |
| `navi.js` | Navigation während der Fahrt: Fortschritt auf der Route, nächste Abbiegung, Ansagen |
| `verkehr.js` | Baustellen, Staus und Sperrungen der Autobahn GmbH, Erklärung der Route |
| `werkzeug/bauen.py` | Baut aus dem OSM-Auszug die Daten in `daten/` (Kacheln à ca. 5,5 km + Fernstraßennetz) |
| `werkzeug/verkehr.mjs` | Holt die Verkehrsmeldungen als Ersatzkopie `daten/verkehr.json` |
| `tests/` | `node --test karten/tests/*.test.mjs` (mit echten Daten: `KARTEN_DATEN=pfad`) |

Die Daten baut GitHub automatisch (Workflow „Karten-Daten“, monatlich; „Karten-Verkehr“, stündlich).

So rechnet der Routenplaner: In der Nähe von Start und Ziel (7 km) werden alle Straßen benutzt,
dazwischen beim Auto nur Fernstraßen (Autobahn bis Kreisstraße). Gesperrte Autobahnstücke werden
gemieden, Staus und Baustellen kosten Zeit. Einstellungen: keine Schleichwege durch Wohngebiete,
keine engen Wege, keine Autobahn, ruhige Radwege, beleuchtete Wege, ohne Treppen.

Navigation: „Los“ folgt dem GPS, sagt Abbiegungen an (Ansagen abschaltbar), fragt nach, bevor sie
umplant (von der Route abgekommen: Neuberechnung nach 10 s, wenn du nichts sagst; neue Staus: nur auf Nachfrage).
„Probefahrt“ fährt die Route im Zeitraffer ab. Ampeln aus OSM kosten je ca. 15 s.

Kartendaten © OpenStreetMap-Mitwirkende (ODbL 1.0). Verkehrsdaten: Autobahn GmbH des Bundes.
