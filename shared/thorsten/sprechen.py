#!/usr/bin/env python3
"""Thorstens Stimme für das Video-Studio.

Liest shared/thorsten/saetze.json, spricht jeden Satz mit derselben Piper-Stimme
wie im Nachrichten-Heft (Modell de_DE-mls-medium, Sprecher 162) und legt ihn als
MP3 in shared/thorsten/ton/ ab. Schon vorhandene Sätze mit gleichem Text werden
nicht neu gesprochen. Dazu entsteht shared/thorsten/index.json, die das Studio liest.

Läuft über den GitHub-Ablauf „Thorstens Stimme“ (.github/workflows/thorsten-stimme.yml).
"""

import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
ROOT = HIER.parent.parent
TON = HIER / "ton"
INDEX = HIER / "index.json"
STIMMEN = ROOT / ".stimmen"


def log(t):
    print(t, flush=True)


def sprechbar(text):
    t = str(text)
    for a, b in [("–", ","), ("—", ","), ("…", "."), ("„", ""), ("“", ""), ("”", ""),
                 ("»", ""), ("«", ""), ('"', ""), ("%", " Prozent"), ("&", " und ")]:
        t = t.replace(a, b)
    t = re.sub(r"\s+", " ", t).strip()
    if t and t[-1] not in ".!?:,":
        t += "."
    return t


def main():
    daten = json.loads((HIER / "saetze.json").read_text("utf8"))
    st = daten.get("stimme") or {}
    modell = st.get("modell", "de_DE-mls-medium")
    sprecher = int(st.get("sprecher", 162))
    tempo = float(st.get("tempo", 0.9))
    saetze = daten["saetze"]

    ids = [s["id"] for s in saetze]
    if len(ids) != len(set(ids)):
        sys.exit("Fehler: Eine id kommt doppelt vor.")
    for i in ids:
        if not re.fullmatch(r"[a-z0-9-]+", i):
            sys.exit(f"Fehler: Ungültige id „{i}“ (nur a–z, 0–9 und -).")

    alt = {}
    if INDEX.exists():
        try:
            alt = {e["id"]: e for e in json.loads(INDEX.read_text("utf8")).get("saetze", [])}
        except Exception:
            alt = {}

    from piper import PiperVoice
    from piper.config import SynthesisConfig
    from piper.download_voices import download_voice

    STIMMEN.mkdir(parents=True, exist_ok=True)
    datei = STIMMEN / f"{modell}.onnx"
    if not datei.exists():
        log(f"Lade Stimme {modell} …")
        download_voice(modell, STIMMEN)
    voice = PiperVoice.load(datei)
    rate = voice.config.sample_rate
    grund = getattr(voice.config, "length_scale", 1.0) or 1.0

    TON.mkdir(parents=True, exist_ok=True)
    neu, fertig = 0, []
    for s in saetze:
        text = sprechbar(s["text"])
        h = hashlib.sha1(f"{modell}|{sprecher}|{tempo}|{text}".encode("utf8")).hexdigest()[:12]
        ziel = TON / f"{s['id']}.mp3"
        vorher = alt.get(s["id"])
        if vorher and vorher.get("hash") == h and ziel.exists():
            fertig.append(vorher)
            continue
        conf = SynthesisConfig(length_scale=grund * tempo, noise_scale=0.667, noise_w_scale=0.8,
                               normalize_audio=True, speaker_id=sprecher)
        roh = b"".join(c.audio_int16_bytes for c in voice.synthesize(text, conf))
        pause = b"\x00\x00" * int(rate * 0.08)
        p = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
             "-af", "highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=8:release=180,"
                    "loudnorm=I=-15:TP=-1.5:LRA=11,alimiter=limit=0.97",
             "-c:a", "libmp3lame", "-b:a", "80k", str(ziel)],
            input=pause + roh + pause, capture_output=True, timeout=120)
        if p.returncode != 0 or not ziel.exists():
            sys.exit("ffmpeg-Fehler: " + p.stderr.decode("utf8", "ignore")[:300])
        dauer = round((len(roh) // 2 + 2 * len(pause) // 2) / rate, 2)
        fertig.append({"id": s["id"], "gruppe": s["gruppe"], "text": s["text"], "datei": f"ton/{s['id']}.mp3",
                       "dauer": dauer, "hash": h})
        neu += 1
        log(f"  {s['id']}: {dauer} s")

    # Alte Tondateien aufräumen, deren Satz es nicht mehr gibt
    behalten = {f"{i}.mp3" for i in ids}
    for f in TON.glob("*.mp3"):
        if f.name not in behalten:
            f.unlink()

    INDEX.write_text(json.dumps({"stimme": {"modell": modell, "sprecher": sprecher, "tempo": tempo},
                                 "hinweis": "Computerstimme (Piper). Wird automatisch erzeugt – nicht von Hand ändern.",
                                 "saetze": fertig}, ensure_ascii=False, indent=1), "utf8")
    log(f"Fertig: {neu} neu gesprochen, {len(fertig)} Sätze insgesamt.")


if __name__ == "__main__":
    main()
