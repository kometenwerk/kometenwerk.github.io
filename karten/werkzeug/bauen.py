#!/usr/bin/env python3
"""OMNIVIA Karten – baut aus einem OpenStreetMap-Auszug (.osm.pbf) die Daten für die App.

Ergebnis in <ziel>/:
  index.json            Überblick: Kachelraster, Kacheln, Stand, Quelle
  netz/<y>_<x>.bin.gz   Straßennetz in Kacheln (alle Straßen und Wege)
  netz/fern.bin.gz      Fernstraßen (Autobahn bis Kreisstraße 2. Ordnung) für lange Autostrecken
  suche/<ab>.json.gz    Straßen, Hausnummern und Orte zum Suchen, nach den ersten 2 Buchstaben
  orte.json             Städte, Dörfer, Ortsteile

Aufruf: python3 bauen.py auszug.osm.pbf ziel/
Braucht: pip install osmium
Daten: © OpenStreetMap-Mitwirkende, ODbL 1.0
"""
import gzip, json, math, os, re, struct, sys, time, unicodedata
from collections import defaultdict
import osmium

KACHEL_LAT = 0.05   # etwa 5,5 km
KACHEL_LON = 0.075  # etwa 5,5 km in Süddeutschland

# Straßenklassen (0 = wichtigste)
KLASSE = {
    "motorway": 0, "motorway_link": 0, "trunk": 1, "trunk_link": 1,
    "primary": 2, "primary_link": 2, "secondary": 3, "secondary_link": 3,
    "tertiary": 4, "tertiary_link": 4, "unclassified": 5, "residential": 6,
    "living_street": 7, "service": 8, "track": 9, "cycleway": 10,
    "footway": 11, "pedestrian": 11, "path": 11, "steps": 11, "bridleway": 11, "road": 5,
}
FERN = 3  # Klassen 0..3 kommen ins Fernnetz
TEMPO = {0: 120, 1: 100, 2: 75, 3: 65, 4: 55, 5: 45, 6: 30, 7: 7, 8: 15, 9: 10}
LINK_TEMPO = 50

# Bits für eine Richtung
B_AUTO, B_RAD, B_FUSS, B_WOHN, B_ENG, B_LICHT, B_RADWEG, B_UNBEF = 1, 2, 4, 8, 16, 32, 64, 128
B2_TREPPE, B2_AUTOBAHN, B2_TUNNEL, B2_BRUECKE = 1, 2, 4, 8

UNBEFESTIGT = {"unpaved", "gravel", "fine_gravel", "dirt", "earth", "grass", "ground", "mud", "sand", "compacted", "woodchips", "pebblestone", "grass_paver"}
NEIN = {"no", "private", "agricultural", "forestry", "delivery", "destination_no"}


ARTEN = [
    ("amenity", {"hospital": "Krankenhaus", "clinic": "Klinik", "school": "Schule", "university": "Hochschule", "college": "Hochschule", "townhall": "Rathaus",
                 "library": "Bücherei", "cinema": "Kino", "theatre": "Theater", "fuel": "Tankstelle", "charging_station": "Ladesäule", "pharmacy": "Apotheke",
                 "police": "Polizei", "fire_station": "Feuerwehr", "swimming_pool": "Schwimmbad", "kindergarten": "Kindergarten", "childcare": "Kita",
                 "restaurant": "Restaurant", "cafe": "Café", "ice_cream": "Eisdiele", "fast_food": "Imbiss", "pub": "Kneipe", "bar": "Bar", "biergarten": "Biergarten",
                 "post_office": "Post", "post_box": "Briefkasten", "place_of_worship": "Kirche", "doctors": "Arztpraxis", "dentist": "Zahnarzt", "veterinary": "Tierarzt",
                 "bank": "Bank", "atm": "Geldautomat", "parking": "Parkplatz", "toilets": "Toilette", "community_centre": "Gemeindehaus", "social_facility": "Pflegeheim",
                 "nursing_home": "Pflegeheim", "marketplace": "Markt", "car_wash": "Waschanlage", "car_rental": "Autovermietung", "bicycle_rental": "Radverleih",
                 "music_school": "Musikschule", "driving_school": "Fahrschule", "arts_centre": "Kultur", "courthouse": "Gericht", "recycling": "Wertstoffe",
                 "grave_yard": "Friedhof", "playground": "Spielplatz", "drinking_water": "Trinkwasser", "taxi": "Taxi", "events_venue": "Halle", "youth_centre": "Jugendhaus"}),
    ("shop", {"supermarket": "Supermarkt", "convenience": "Laden", "bakery": "Bäckerei", "butcher": "Metzgerei", "kiosk": "Kiosk", "beverages": "Getränke",
              "hairdresser": "Friseur", "clothes": "Kleidung", "shoes": "Schuhe", "chemist": "Drogerie", "optician": "Optiker", "florist": "Blumen",
              "car": "Autohaus", "car_repair": "Werkstatt", "bicycle": "Fahrradladen", "doityourself": "Baumarkt", "hardware": "Baumarkt", "electronics": "Elektronik",
              "furniture": "Möbel", "books": "Buchladen", "toys": "Spielwaren", "sports": "Sportgeschäft", "mobile_phone": "Handyladen", "farm": "Hofladen",
              "garden_centre": "Gärtnerei", "pet": "Tierbedarf", "jewelry": "Schmuck", "gift": "Geschenke", "department_store": "Kaufhaus", "mall": "Einkaufszentrum",
              "beauty": "Kosmetik", "wine": "Wein", "deli": "Feinkost", "confectionery": "Süßwaren", "pastry": "Konditorei", "tobacco": "Tabak", "laundry": "Wäscherei",
              "travel_agency": "Reisebüro", "stationery": "Schreibwaren", "computer": "Computer", "tyres": "Reifen", "funeral_directors": "Bestatter"}),
    ("tourism", {"attraction": "Sehenswürdigkeit", "museum": "Museum", "theme_park": "Freizeitpark", "zoo": "Zoo", "viewpoint": "Aussicht", "hotel": "Hotel",
                 "guest_house": "Pension", "hostel": "Herberge", "apartment": "Ferienwohnung", "camp_site": "Camping", "caravan_site": "Wohnmobilplatz",
                 "information": "Touristen-Info", "picnic_site": "Grillplatz", "artwork": "Kunstwerk", "gallery": "Galerie", "alpine_hut": "Hütte", "wilderness_hut": "Hütte"}),
    ("leisure", {"stadium": "Stadion", "sports_centre": "Sporthalle", "sports_hall": "Sporthalle", "water_park": "Bad", "park": "Park", "pitch": "Sportplatz",
                 "playground": "Spielplatz", "swimming_pool": "Schwimmbad", "fitness_centre": "Fitnessstudio", "golf_course": "Golfplatz", "ice_rink": "Eisbahn",
                 "marina": "Hafen", "miniature_golf": "Minigolf", "nature_reserve": "Naturschutzgebiet", "bowling_alley": "Bowling", "climbing": "Klettern"}),
    ("healthcare", {"doctor": "Arztpraxis", "dentist": "Zahnarzt", "hospital": "Krankenhaus", "pharmacy": "Apotheke", "physiotherapist": "Physiotherapie", "clinic": "Klinik"}),
    ("historic", {"castle": "Burg", "ruins": "Ruine", "monument": "Denkmal", "memorial": "Denkmal", "church": "Kirche", "monastery": "Kloster", "city_gate": "Stadttor"}),
    ("aeroway", {"aerodrome": "Flugplatz"}),
    ("natural", {"peak": "Berg", "water": "See", "spring": "Quelle", "cave_entrance": "Höhle", "waterfall": "Wasserfall"}),
    ("water", {"lake": "See"}),
    ("waterway", {"waterfall": "Wasserfall"}),
    ("man_made", {"tower": "Turm", "observation_tower": "Aussichtsturm"}),
    ("building", {"church": "Kirche", "chapel": "Kapelle", "cathedral": "Kirche", "train_station": "Bahnhof", "school": "Schule"}),
]


def schild_aus(tag):
    """Erlaubte Geschwindigkeit laut Schild (0 = unbekannt) – für die Anzeige im Navi."""
    v = tag.get("maxspeed", "")
    m = re.match(r"^(\d+)", v)
    if m:
        z = int(m.group(1))
        if "mph" in v: z = int(z * 1.609)
        return max(5, min(200, z))
    return {"DE:urban": 50, "de:urban": 50, "DE:rural": 100, "de:rural": 100, "DE:living_street": 7}.get(v, 0)


def tempo_aus(tag, klasse, link):
    v = tag.get("maxspeed", "")
    m = re.match(r"^(\d+)", v)
    if m:
        z = int(m.group(1))
        if "mph" in v: z = int(z * 1.609)
        return max(5, min(130, z))
    if v in ("DE:urban", "de:urban"): return 50
    if v in ("DE:rural", "de:rural"): return 90
    if v in ("DE:living_street", "walk"): return 7
    if v == "none": return 130
    if link: return LINK_TEMPO
    return TEMPO.get(klasse, 20)


def zugang(tag, hw):
    """Gibt (auto_hin, auto_rueck, rad_hin, rad_rueck, fuss) zurück."""
    a = tag.get("access", "")
    alle_zu = a in NEIN
    k = KLASSE[hw]

    def erlaubt(schluessel, standard):
        for s in schluessel:
            w = tag.get(s)
            if w is not None:
                return w not in NEIN
        return standard and not alle_zu

    auto = k <= 9 and hw not in ("cycleway", "footway", "pedestrian", "path", "steps", "bridleway")
    if hw == "track": auto = tag.get("motor_vehicle") in ("yes", "permissive") or tag.get("motorcar") in ("yes", "permissive")
    if hw == "service" and tag.get("service") in ("parking_aisle", "drive-through", "emergency_access"): auto = auto and tag.get("service") == "parking_aisle"
    auto = erlaubt(("motorcar", "motor_vehicle", "vehicle"), auto)
    rad = k not in (0, 1) or tag.get("bicycle") in ("yes", "designated")
    if hw in ("footway", "pedestrian", "steps"): rad = tag.get("bicycle") in ("yes", "designated", "permissive")
    rad = erlaubt(("bicycle", "vehicle"), rad)
    fuss = k not in (0, 1) and hw not in ("motorway_link", "trunk_link")
    if hw in ("trunk", "trunk_link"): fuss = tag.get("foot") in ("yes", "designated")
    if tag.get("sidewalk") in ("no", "none") and k <= 2: fuss = False
    fuss = erlaubt(("foot",), fuss)

    ow = tag.get("oneway", "")
    if hw in ("motorway", "motorway_link") and ow == "": ow = "yes"
    if tag.get("junction") in ("roundabout", "circular") and ow == "": ow = "yes"
    ah = ar = auto
    if ow in ("yes", "1", "true"): ar = False
    elif ow == "-1": ah = False
    rh, rr = rad, rad
    owr = tag.get("oneway:bicycle", "")
    if owr in ("yes", "1"): rr = False
    elif owr == "no": pass
    elif ow in ("yes", "1", "true") and hw != "cycleway" and not tag.get("cycleway", "").startswith("opposite"): rr = False
    elif ow == "-1": rh = False
    return ah, ar, rh, rr, fuss


def norm(s):
    s = s.lower().replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    s = "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c))
    s = re.sub(r"strasse\b", "str", s)
    s = re.sub(r"str\.", "str", s)
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def schluessel(s):
    n = norm(s).replace(" ", "")
    return (n[:2] if len(n) >= 2 else (n + "_")[:2]) or "__"


class Leser(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.wege = []            # (ids, koords, klasse, tempo, bits_hin, bits_rueck, bits2, name)
        self.nutzung = defaultdict(int)
        self.adressen = []        # (strasse, nr, ort, plz, lat, lon)
        self.orte = []            # (name, art, lat, lon, einwohner)
        self.strassen = []        # (name, lat, lon)
        self.orte_punkte = []     # (name, art, lat, lon) für Gebäude/Orte zum Suchen
        self.bbox = [90, 180, -90, -180]
        self.anschluesse = []     # (name, lat, lon) Autobahn-Anschlussstellen, Kreuze, Raststätten
        self.ampeln = set()       # Knoten mit Ampel

    def node(self, n):
        t = n.tags
        if not len(t): return
        lat, lon = n.location.lat, n.location.lon
        if t.get("highway") == "traffic_signals" or t.get("crossing") == "traffic_signals":
            self.ampeln.add(n.id)
        if t.get("highway") in ("motorway_junction", "services", "rest_area") and "name" in t:
            self.anschluesse.append((t["name"], lat, lon))
        if "addr:housenumber" in t and ("addr:street" in t or "addr:place" in t):
            self.adressen.append((t.get("addr:street") or t.get("addr:place"), t["addr:housenumber"], t.get("addr:city", ""), t.get("addr:postcode", ""), lat, lon))
        p = t.get("place")
        if p in ("city", "town", "village", "suburb", "hamlet", "quarter", "neighbourhood", "isolated_dwelling") and "name" in t:
            ew = 0
            try: ew = int(re.sub(r"\D", "", t.get("population", "0")) or 0)
            except ValueError: pass
            self.orte.append((t["name"], p, lat, lon, ew))
        if t.get("amenity") or t.get("shop") or t.get("tourism") or t.get("leisure") or t.get("railway") or t.get("public_transport") or t.get("highway") or t.get("healthcare") or t.get("office") or t.get("craft") or t.get("historic") or t.get("natural") or t.get("aeroway") or t.get("man_made"):
            self.ziel(t, lat, lon)

    @staticmethod
    def art(t):
        if t.get("railway") in ("station", "halt"): return "Bahnhof"
        if t.get("public_transport") == "station" or t.get("amenity") == "bus_station": return "Haltestelle"
        if t.get("highway") == "bus_stop" or t.get("public_transport") == "platform" and t.get("bus") == "yes": return "Bushaltestelle"
        for schl, tab in ARTEN:
            w = t.get(schl)
            if w and w in tab: return tab[w]
        if t.get("shop") and t.get("shop") not in ("vacant", "no", "yes"): return "Geschäft"
        if t.get("healthcare"): return "Gesundheit"
        if t.get("office") in ("company", "yes", "government", "insurance", "lawyer", "estate_agent", "tax_advisor", "it", "architect", "notary"): return {"government": "Amt", "insurance": "Versicherung", "lawyer": "Anwalt", "notary": "Notar", "tax_advisor": "Steuerberater", "architect": "Architekt"}.get(t["office"], "Firma")
        if t.get("craft"): return "Handwerk"
        return None

    def ziel(self, t, la, lo):
        art = self.art(t)
        if not art: return
        name = t.get("name") or t.get("brand") or ""
        if art in ("Bushaltestelle",) and not name: return
        self.orte_punkte.append((name, art, la, lo))

    def way(self, w):
        t = w.tags
        hw = t.get("highway")
        try:
            pkt = [(nd.ref, nd.location.lat, nd.location.lon) for nd in w.nodes if nd.location.valid()]
        except osmium.InvalidLocationError:
            return
        if len(pkt) < 2: return
        if "addr:housenumber" in t and ("addr:street" in t or "addr:place" in t):
            la = sum(p[1] for p in pkt) / len(pkt); lo = sum(p[2] for p in pkt) / len(pkt)
            self.adressen.append((t.get("addr:street") or t.get("addr:place"), t["addr:housenumber"], t.get("addr:city", ""), t.get("addr:postcode", ""), la, lo))
        if t.get("highway") in ("services", "rest_area") and "name" in t:
            self.anschluesse.append((t["name"], sum(p[1] for p in pkt) / len(pkt), sum(p[2] for p in pkt) / len(pkt)))
        if "highway" not in t or t.get("highway") in ("services", "rest_area"):
            if t.get("amenity") or t.get("shop") or t.get("tourism") or t.get("leisure") or t.get("railway") or t.get("healthcare") or t.get("office") or t.get("craft") or t.get("historic") or t.get("natural") or t.get("aeroway") or t.get("man_made"):
                self.ziel(t, sum(p[1] for p in pkt) / len(pkt), sum(p[2] for p in pkt) / len(pkt))
        if hw not in KLASSE or t.get("area") == "yes": return
        if hw == "service" and t.get("service") == "parking_aisle" and "name" not in t: pass
        k = KLASSE[hw]
        ah, ar, rh, rr, fu = zugang(t, hw)
        if not (ah or ar or rh or rr or fu): return
        link = hw.endswith("_link")
        tempo = tempo_aus(t, k, link) | (schild_aus(t) << 8)  # unten: Rechentempo, oben: Schild
        b = 0
        if hw in ("residential", "living_street"): b |= B_WOHN
        if hw == "track" or (hw == "service" and t.get("service") in ("driveway", "alley")) or (t.get("width", "9").replace(",", ".").split(" ")[0].replace(".", "", 1).isdigit() and float(t.get("width", "9").replace(",", ".").split(" ")[0]) < 3): b |= B_ENG
        if t.get("lit") in ("yes", "24/7", "automatic"): b |= B_LICHT
        if hw == "cycleway" or t.get("bicycle") == "designated" or any(t.get(s, "") in ("lane", "track", "share_busway") for s in ("cycleway", "cycleway:right", "cycleway:left", "cycleway:both")): b |= B_RADWEG
        if t.get("surface") in UNBEFESTIGT or (hw == "track" and t.get("tracktype") not in ("grade1",)): b |= B_UNBEF
        b2 = 0
        if hw == "steps": b2 |= B2_TREPPE
        if k == 0: b2 |= B2_AUTOBAHN
        if t.get("tunnel") in ("yes", "building_passage"): b2 |= B2_TUNNEL
        if t.get("bridge") == "yes": b2 |= B2_BRUECKE
        hin = b | (B_AUTO if ah else 0) | (B_RAD if rh else 0) | (B_FUSS if fu else 0)
        rueck = b | (B_AUTO if ar else 0) | (B_RAD if rr else 0) | (B_FUSS if fu else 0)
        ref = t.get("ref", "").split(";")[0].strip()
        name = t.get("name", "")
        anzeige = (ref + (" · " + name if name and k >= 2 else "")) if ref else name
        ids = [p[0] for p in pkt]
        ko = [(p[1], p[2]) for p in pkt]
        self.wege.append((ids, ko, k, tempo, hin, rueck, b2, anzeige))
        for i, nid in enumerate(ids):
            self.nutzung[nid] += 1 if 0 < i < len(ids) - 1 else 2
        if name and k >= 2 and k <= 8:
            mi = ko[len(ko) // 2]
            self.strassen.append((name, mi[0], mi[1]))
        bb = self.bbox
        for la, lo in ko:
            if la < bb[0]: bb[0] = la
            if lo < bb[1]: bb[1] = lo
            if la > bb[2]: bb[2] = la
            if lo > bb[3]: bb[3] = lo


def abstand(a, b, c, d):
    x = (d - b) * math.cos(math.radians((a + c) / 2)) * 111320
    y = (c - a) * 110540
    return math.hypot(x, y)


def inseln_entfernen(nachbarn, n_knoten, mindestens=300):
    """Kleine abgeschnittene Netzteile (z. B. Hofzufahrt mitten in der Fußgängerzone) sind für
    dieses Verkehrsmittel nutzlos: Start oder Ziel dort einzurasten ergibt keine Route."""
    for bit, name in ((B_AUTO, "Auto"), (B_RAD, "Rad"), (B_FUSS, "Fuß")):
        eltern = list(range(n_knoten))
        def wurzel(x):
            while eltern[x] != x:
                eltern[x] = eltern[eltern[x]]
                x = eltern[x]
            return x
        for a, kanten in nachbarn.items():
            for e in kanten:
                if e[5] & bit:
                    ra, rb = wurzel(a), wurzel(e[0])
                    if ra != rb: eltern[ra] = rb
        groesse = defaultdict(int)
        for a, kanten in nachbarn.items():
            if any(e[5] & bit for e in kanten): groesse[wurzel(a)] += 1
        klein = {w for w, g in groesse.items() if g < mindestens}
        weg = 0
        for a, kanten in nachbarn.items():
            if wurzel(a) in klein:
                for i, e in enumerate(kanten):
                    if e[5] & bit:
                        kanten[i] = e[:5] + (e[5] & ~bit,) + e[6:]
                        weg += 1
        print(f"{name}: {len(klein)} kleine Inseln entfernt ({weg} Kanten), größtes Netz {max(groesse.values()) if groesse else 0} Knoten")
    for a in list(nachbarn):
        nachbarn[a] = [e for e in nachbarn[a] if e[5] & (B_AUTO | B_RAD | B_FUSS)]


def kachel(lat, lon):
    return (int(math.floor(lat / KACHEL_LAT)), int(math.floor(lon / KACHEL_LON)))


def bauen(quelle, ziel):
    t0 = time.time()
    r = Leser()
    r.apply_file(quelle, locations=True, idx="flex_mem")
    print(f"gelesen: {len(r.wege)} Wege, {len(r.adressen)} Adressen, {len(r.orte)} Orte, {len(r.orte_punkte)} Ziele ({time.time()-t0:.0f}s)")

    # 1) Knoten des Netzes: Enden und Kreuzungen
    knoten = {}  # osm-id -> (lat, lon)
    for ids, ko, *_ in r.wege:
        for i, nid in enumerate(ids):
            if i == 0 or i == len(ids) - 1 or r.nutzung[nid] > 1:
                knoten[nid] = ko[i]
    r.nutzung = None
    reihen = sorted(knoten.items(), key=lambda kv: (kachel(*kv[1]), kv[1][0], kv[1][1]))
    nr = {}
    kacheln = {}  # (y,x) -> [start, anzahl]
    for i, (nid, (la, lo)) in enumerate(reihen):
        nr[nid] = i
        k = kachel(la, lo)
        if k not in kacheln: kacheln[k] = [i, 0]
        kacheln[k][1] += 1
    lat_von = [p[1][0] for p in reihen]
    lon_von = [p[1][1] for p in reihen]
    n_knoten = len(reihen)
    print(f"Knoten: {n_knoten}, Kacheln: {len(kacheln)}")

    # 2) Kanten
    nachbarn = defaultdict(list)  # knoten -> [(ziel, laenge, zwischenpunkte, klasse, tempo, bits, bits2, name)]
    for ids, ko, k, tempo, hin, rueck, b2, name in r.wege:
        start = 0
        laenge = 0.0
        for i in range(1, len(ids)):
            laenge += abstand(ko[i - 1][0], ko[i - 1][1], ko[i][0], ko[i][1])
            if ids[i] in nr and (i == len(ids) - 1 or ids[i] in knoten):
                a, b = nr[ids[start]], nr[ids[i]]
                zw = ko[start + 1:i]
                if a != b or zw:
                    # Ampeln auf dem Stück (oberes Halbbyte von bits2), jeweils ohne den Startknoten
                    am_hin = min(15, sum(1 for x in ids[start + 1:i + 1] if x in r.ampeln)) << 4
                    am_rueck = min(15, sum(1 for x in ids[start:i] if x in r.ampeln)) << 4
                    if hin & (B_AUTO | B_RAD | B_FUSS):
                        nachbarn[a].append((b, laenge, zw, k, tempo, hin, b2 | am_hin, name))
                    if rueck & (B_AUTO | B_RAD | B_FUSS):
                        nachbarn[b].append((a, laenge, zw[::-1], k, tempo, rueck, b2 | am_rueck, name))
                start = i
                laenge = 0.0
    print(f"Ampeln: {len(r.ampeln)}")
    r.wege = None; r.ampeln = None
    inseln_entfernen(nachbarn, n_knoten)

    os.makedirs(os.path.join(ziel, "netz"), exist_ok=True)

    def schreiben(pfad, ids):
        namen, nidx = [], {}
        to, ln, tla, tlo, gs, gc, nm, kl, fl, sp, f2, ms = ([] for _ in range(12))
        geo = []
        start = [0]
        for k in ids:
            for (b, l, zw, kk, tempo, bits, b2, name) in nachbarn.get(k, ()):
                to.append(b); ln.append(l); tla.append(round(lat_von[b] * 1e6)); tlo.append(round(lon_von[b] * 1e6))
                gs.append(len(geo) // 2); gc.append(min(len(zw), 65535))
                for la, lo in zw[:65535]: geo += [round(la * 1e6), round(lo * 1e6)]
                if name not in nidx:
                    nidx[name] = len(namen); namen.append(name)
                nm.append(min(nidx[name], 65535)); kl.append(kk); fl.append(bits); sp.append(min(tempo & 255, 255)); ms.append(tempo >> 8); f2.append(b2)
            start.append(len(to))
        n, m = len(ids), len(to)
        nb = json.dumps(namen, ensure_ascii=False, separators=(",", ":")).encode()
        teile = [struct.pack("<4sIIII", b"KWN2", n, m, len(geo) // 2, len(nb))]
        def feld(fmt, werte):
            d = struct.pack("<%d%s" % (len(werte), fmt), *werte)
            return d + b"\0" * (-len(d) % 4)
        teile += [feld("I", ids), feld("i", [round(lat_von[k] * 1e6) for k in ids]), feld("i", [round(lon_von[k] * 1e6) for k in ids]), feld("I", start),
                  feld("I", to), feld("f", ln), feld("i", tla), feld("i", tlo), feld("I", gs), feld("H", gc), feld("H", nm),
                  feld("B", kl), feld("B", fl), feld("B", sp), feld("B", f2), feld("B", ms), feld("i", geo), nb]
        roh = b"".join(teile)
        with gzip.open(pfad, "wb", compresslevel=9) as f: f.write(roh)
        return os.path.getsize(pfad)

    liste = {}
    gesamt = 0
    for (y, x), (s, a) in sorted(kacheln.items()):
        g = schreiben(os.path.join(ziel, "netz", f"{y}_{x}.bin.gz"), list(range(s, s + a)))
        liste[f"{y}_{x}"] = [s, a, g]
        gesamt += g
    # Fernnetz: nur Kanten der Klassen 0..3 (Auto)
    fern_ids = set()
    alt = nachbarn
    fern = defaultdict(list)
    for a, kanten in alt.items():
        for e in kanten:
            if e[3] <= FERN and e[5] & B_AUTO:
                fern[a].append(e); fern_ids.add(a); fern_ids.add(e[0])
    nachbarn = fern
    fg = schreiben(os.path.join(ziel, "netz", "fern.bin.gz"), sorted(fern_ids))
    nachbarn = alt
    print(f"Netz: {gesamt/1e6:.1f} MB in Kacheln, Fernnetz {fg/1e6:.2f} MB ({len(fern_ids)} Knoten)")

    # 3) Suche
    orte = sorted(r.orte, key=lambda o: -o[4])
    STADT = {"city": 0, "town": 1, "village": 2, "suburb": 3, "quarter": 4, "hamlet": 5, "neighbourhood": 6, "isolated_dwelling": 7}
    grosse = [o for o in orte if o[1] in ("city", "town", "village", "hamlet", "suburb")]
    raster = defaultdict(list)
    for o in grosse: raster[(int(o[2] * 20), int(o[3] * 20))].append(o)

    def naechster_ort(la, lo):
        best, bd = "", 1e18
        gy, gx = int(la * 20), int(lo * 20)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                for o in raster.get((gy + dy, gx + dx), ()):
                    if o[1] in ("suburb",): continue
                    d = abstand(la, lo, o[2], o[3]) / (2.5 if o[1] in ("city", "town") else 1)
                    if d < bd: best, bd = o[0], d
        return best

    strassen = {}  # (name, ort) -> dict
    for s, hnr, ort, plz, la, lo in r.adressen:
        ort = ort or naechster_ort(la, lo)
        key = (s, ort)
        e = strassen.get(key)
        if not e:
            e = strassen[key] = {"n": s, "o": ort, "p": plz, "h": {}}
        if plz and not e["p"]: e["p"] = plz
        e["h"].setdefault(hnr, (round(la, 6), round(lo, 6)))
    namen_ort = defaultdict(list)
    for (s, o), e in strassen.items(): namen_ort[s].append(e)
    gesehen = set()
    for s, la, lo in r.strassen:
        ort = naechster_ort(la, lo)
        if (s, ort) in strassen or (s, ort) in gesehen: continue
        nahe = False
        for e in namen_ort.get(s, ()):
            h0 = next(iter(e["h"].values()))
            if abstand(la, lo, h0[0], h0[1]) < 2500: nahe = True; break
        if nahe: continue
        gesehen.add((s, ort))
        strassen[(s, ort)] = {"n": s, "o": ort, "p": "", "h": {}, "m": (round(la, 6), round(lo, 6))}

    def nr_sort(h):
        m = re.match(r"(\d+)(.*)", h)
        return (int(m.group(1)), m.group(2)) if m else (10**9, h)

    eimer = defaultdict(list)
    for e in strassen.values():
        hs = sorted(e["h"].items(), key=lambda kv: nr_sort(kv[0]))
        if hs:
            mi = hs[len(hs) // 2][1]
            eintrag = [e["n"], e["o"], e["p"], mi[0], mi[1], [[h, p[0], p[1]] for h, p in hs]]
        else:
            eintrag = [e["n"], e["o"], e["p"], e["m"][0], e["m"][1], []]
        eimer[schluessel(e["n"])].append(eintrag)
    doppelt = set()
    kategorien = defaultdict(list)
    for name, art, la, lo in r.orte_punkte:
        k = (name, art, round(la, 3), round(lo, 3))
        if k in doppelt: continue
        doppelt.add(k)
        ort = naechster_ort(la, lo)
        if name:
            eimer[schluessel(name)].append([name, ort, "", round(la, 6), round(lo, 6), None, art])
        kategorien[norm(art).replace(" ", "")].append([name, ort, round(la, 5), round(lo, 5), art])
    os.makedirs(os.path.join(ziel, "kategorie"), exist_ok=True)
    for k, l in kategorien.items():
        with gzip.open(os.path.join(ziel, "kategorie", f"{k}.json.gz"), "wt", encoding="utf-8", compresslevel=9) as f:
            json.dump(l, f, ensure_ascii=False, separators=(",", ":"))
    os.makedirs(os.path.join(ziel, "suche"), exist_ok=True)
    sg = 0
    for k, l in eimer.items():
        p = os.path.join(ziel, "suche", f"{k}.json.gz")
        with gzip.open(p, "wt", encoding="utf-8", compresslevel=9) as f:
            json.dump(l, f, ensure_ascii=False, separators=(",", ":"))
        sg += os.path.getsize(p)
    ortsliste = [[o[0], STADT[o[1]], round(o[2], 5), round(o[3], 5), o[4]] for o in orte]
    with open(os.path.join(ziel, "orte.json"), "w", encoding="utf-8") as f:
        json.dump(ortsliste, f, ensure_ascii=False, separators=(",", ":"))
    anschluss = defaultdict(list)
    for name, la, lo in r.anschluesse:
        p = [round(la, 5), round(lo, 5)]
        if p not in anschluss[norm(name)]: anschluss[norm(name)].append(p)
    with open(os.path.join(ziel, "anschluss.json"), "w", encoding="utf-8") as f:
        json.dump(anschluss, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Anschlussstellen: {len(anschluss)}")
    print(f"Suche: {len(strassen)} Straßen, {len(doppelt)} Ziele, {len(eimer)} Dateien, {sg/1e6:.1f} MB; {len(ortsliste)} Orte")

    index = {
        "version": 1, "stand": time.strftime("%Y-%m-%d"), "bau": int(time.time()), "quelle": os.path.basename(quelle),
        "lizenz": "© OpenStreetMap-Mitwirkende, ODbL 1.0",
        "kachel": [KACHEL_LAT, KACHEL_LON], "fernKlasse": FERN,
        "bbox": [round(v, 5) for v in r.bbox], "knoten": n_knoten,
        "kacheln": liste, "fern": fg, "suche": sorted(eimer.keys()),
        "kategorien": {k: [v[0][4], len(v)] for k, v in sorted(kategorien.items())},
    }
    with open(os.path.join(ziel, "index.json"), "w") as f:
        json.dump(index, f, separators=(",", ":"))
    print(f"fertig in {time.time()-t0:.0f}s")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    bauen(sys.argv[1], sys.argv[2])
