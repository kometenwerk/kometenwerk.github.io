#!/usr/bin/env python3
"""Thorstens Stimme für das Video-Studio.

Liest shared/thorsten/saetze.json, spricht jeden Satz mit derselben Piper-Stimme
wie die Video-Meldungen im Nachrichten-Heft (Piper-Modell de_DE-thorsten-high) und legt ihn als
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
    modell = st.get("modell", "de_DE-thorsten-high")
    sprecher = st.get("sprecher")  # nur bei Modellen mit mehreren Sprechern
    sprecher = int(sprecher) if sprecher is not None else None
    tempo = float(st.get("tempo", 0.9))
    schneller = float(st.get("schneller", 1.0))  # zusätzlich beschleunigen, ohne dass die Stimme höher klingt
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
        h = hashlib.sha1(f"{modell}|{sprecher}|{tempo}|{schneller}|{text}".encode("utf8")).hexdigest()[:12]
        ziel = TON / f"{s['id']}.mp3"
        vorher = alt.get(s["id"])
        if vorher and vorher.get("hash") == h and ziel.exists():
            fertig.append(dict(vorher, **{k: s[k] for k in ("gruppe", "text", "zahl") if k in s}))
            continue
        conf = SynthesisConfig(length_scale=grund * tempo, noise_scale=0.667, noise_w_scale=0.8,
                               normalize_audio=True, **({"speaker_id": sprecher} if sprecher is not None else {}))
        roh = b"".join(c.audio_int16_bytes for c in voice.synthesize(text, conf))
        # Stille vorn und hinten weg, dann beschleunigen (atempo verändert die Tonhöhe nicht)
        tempi, rest = [], schneller
        while rest > 2.0:
            tempi.append("atempo=2.0"); rest /= 2.0
        if abs(rest - 1.0) > 0.01:
            tempi.append(f"atempo={rest:.3f}")
        filter_ = ",".join(["silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.04",
                            "areverse", "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.12", "areverse"]
                           + tempi + ["highpass=f=80", "acompressor=threshold=-20dB:ratio=3:attack=8:release=180",
                                      "loudnorm=I=-15:TP=-1.5:LRA=11", "alimiter=limit=0.97", "adelay=60"])
        p = subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", "pipe:0",
             "-af", filter_, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "80k", str(ziel)],
            input=roh, capture_output=True, timeout=120)
        if p.returncode != 0 or not ziel.exists():
            sys.exit("ffmpeg-Fehler: " + p.stderr.decode("utf8", "ignore")[:300])
        q = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(ziel)],
                           capture_output=True, text=True)
        try:
            dauer = round(float(q.stdout.strip()), 2)
        except ValueError:
            dauer = round(len(roh) / 2 / rate / schneller, 2)
        eintrag = {"id": s["id"], "gruppe": s["gruppe"], "text": s["text"], "datei": f"ton/{s['id']}.mp3",
                   "dauer": dauer, "hash": h}
        if "zahl" in s:
            eintrag["zahl"] = s["zahl"]
        fertig.append(eintrag)
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
