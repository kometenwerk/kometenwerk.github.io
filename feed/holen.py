#!/usr/bin/env python3
"""Holt alle Quellen aus feed/quellen.json und schreibt feed/daten/feeds.json.
Nur Überschrift, kurze Zusammenfassung (ohne HTML), Link und Zeit – keine Bilder, keine Werbung.
Läuft über den GitHub-Ablauf „Feed holen“. Eine kaputte Quelle stoppt die anderen nicht."""
import html, json, re, sys, time, urllib.request
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

HIER = Path(__file__).resolve().parent
ZIEL = HIER / "daten" / "feeds.json"
PRO_QUELLE = 25

def text(s, n=None):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    if n and len(s) > n: s = s[:n].rsplit(" ", 1)[0] + " …"
    return s

def zeit(s):
    if not s: return None
    s = s.strip()
    try: return int(parsedate_to_datetime(s).timestamp())
    except Exception: pass
    try: return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except Exception: return None

def lokal(tag): return tag.rsplit("}", 1)[-1].lower()

def lesen(xml):
    wurzel = ET.fromstring(xml)
    artikel = []
    for el in wurzel.iter():
        t = lokal(el.tag)
        if t not in ("item", "entry"): continue
        d = {lokal(k.tag): k for k in el}
        titel = text(d["title"].text if "title" in d else "")
        link = ""
        for k in el:
            if lokal(k.tag) == "link":
                link = (k.get("href") or k.text or "").strip()
                if k.get("rel") in (None, "alternate") and link: break
        inhalt = ""
        for name in ("description", "summary", "content", "encoded"):
            if name in d and (d[name].text or "").strip(): inhalt = d[name].text; break
        wann = None
        for name in ("pubdate", "published", "updated", "date"):
            if name in d: wann = zeit(d[name].text); break
        if titel and link.startswith("http"):
            artikel.append({"t": titel[:200], "s": text(inhalt, 280), "l": link[:500], "z": wann})
    return artikel

def holen(url):
    req = urllib.request.Request(url, headers={"User-Agent": "FIDELIA-Feed/1.0 (+https://kometenwerk.github.io/feed/)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()

def main(nur_datei=None):
    quellen = json.loads((HIER / "quellen.json").read_text("utf8"))["quellen"]
    alt = {}
    if ZIEL.exists():
        try: alt = {q["id"]: q for q in json.loads(ZIEL.read_text("utf8")).get("quellen", [])}
        except Exception: alt = {}
    jetzt = int(time.time()); fertig = []
    for q in quellen:
        try:
            xml = open(nur_datei, "rb").read() if nur_datei else holen(q["url"])
            art = lesen(xml)
            for a in art:
                if not a["z"] or a["z"] > jetzt + 3600: a["z"] = jetzt
            art.sort(key=lambda a: -a["z"])
            fertig.append({"id": q["id"], "name": q["name"], "thema": q["thema"], "ok": True, "artikel": art[:PRO_QUELLE]})
            print(f"  {q['id']}: {len(art)} Artikel", flush=True)
        except Exception as e:
            print(f"  {q['id']}: FEHLER {e}", flush=True)
            behalten = alt.get(q["id"], {}).get("artikel", [])
            fertig.append({"id": q["id"], "name": q["name"], "thema": q["thema"], "ok": False, "artikel": behalten})
    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    ZIEL.write_text(json.dumps({"stand": jetzt, "quellen": fertig}, ensure_ascii=False, separators=(",", ":")), "utf8")
    print("Fertig:", sum(len(q["artikel"]) for q in fertig), "Artikel")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
