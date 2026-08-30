"""
Get the words that are actually sung in a YouTube video, in performance order.

Strategy, best to worst:
  1. Human-written caption track  (yt-dlp --write-subs)      -> source="subs"
  2. YouTube auto-caption track   (yt-dlp --write-auto-subs)  -> source="asr"
  3. Whisper on the downloaded audio via Groq                 -> source="whisper"
     (only when allow_audio=True and GROQ_API_KEY is set)

Returns: { "source", "is_asr", "cues": [{"t": float_seconds, "text": str}], "text": str }
or None if nothing could be obtained.

We keep the *cues* (timestamped lines) rather than collapsing to prose, so the reconcile
step can see genuine repeats / vamps instead of having them deduped away.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path


def _run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=240, **kw)


def _have(binary: str) -> bool:
    return shutil.which(binary) is not None


# ---------------------------------------------------------------- caption parsing


def _parse_json3(raw: str) -> list[dict]:
    data = json.loads(raw)
    cues = []
    for ev in data.get("events", []):
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        text = re.sub(r"\s+", " ", text)
        if text and text != "\n":
            cues.append({"t": round(ev.get("tStartMs", 0) / 1000, 2), "text": text})
    return cues


def _parse_vtt(raw: str) -> list[dict]:
    cues, cur_t, buf = [], None, []

    def flush():
        nonlocal buf, cur_t
        if cur_t is not None and buf:
            txt = re.sub(r"<[^>]+>", "", " ".join(buf))
            txt = re.sub(r"\s+", " ", txt).strip()
            if txt:
                cues.append({"t": cur_t, "text": txt})
        buf = []

    for line in raw.splitlines():
        line = line.strip()
        m = re.match(r"(\d+):(\d+):(\d+)[.,](\d+)\s*-->", line)
        if m:
            flush()
            h, mn, s, ms = (int(x) for x in m.groups())
            cur_t = h * 3600 + mn * 60 + s + ms / 1000
        elif not line or line.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or re.fullmatch(r"\d+", line):
            continue
        else:
            buf.append(line)
    flush()

    # drop consecutive exact-duplicate cues (rolling-caption artifact) but keep
    # a line that genuinely recurs later after something else in between
    out = []
    for c in cues:
        if out and c["text"] == out[-1]["text"]:
            continue
        out.append(c)
    return out


def _cues_to_text(cues: list[dict]) -> str:
    return "\n".join(c["text"] for c in cues)


# ---------------------------------------------------------------- yt-dlp captions


# yt-dlp needs a non-default client or YouTube replies "The page needs to be reloaded"
_EXTRACTOR_ARGS = "youtube:player_client=android,web"


def _load_cues(path: Path) -> list[dict]:
    raw = path.read_text(errors="ignore")
    return _parse_json3(raw) if path.suffix == ".json3" else _parse_vtt(raw)


def _ytdlp_captions(url: str) -> dict | None:
    if not _have("yt-dlp"):
        return None
    with tempfile.TemporaryDirectory() as tmp:
        _run([
            "yt-dlp", "--skip-download",
            "--write-subs", "--write-auto-subs",
            "--sub-langs", "en.*,en",
            "--sub-format", "json3/vtt/best",
            "--write-info-json",
            "--extractor-args", _EXTRACTOR_ARGS,
            "--no-warnings", "--no-progress",
            "-o", f"{tmp}/v.%(ext)s", url,
        ])
        d = Path(tmp)
        info_f = next(d.glob("*.info.json"), None)
        manual_langs: set[str] = set()
        if info_f:
            try:
                info = json.loads(info_f.read_text())
                manual_langs = set((info.get("subtitles") or {}).keys())
            except Exception:
                pass

        subs = [f for f in d.iterdir() if f.suffix in (".json3", ".vtt")]
        # a track is "manual" if its language tag is in the info json's subtitles map
        def is_manual(f: Path) -> bool:
            lang = f.name.split(".")[1] if len(f.name.split(".")) > 2 else ""
            return lang in manual_langs

        manual = sorted((f for f in subs if is_manual(f)), key=lambda p: p.suffix != ".json3")
        auto = sorted((f for f in subs if not is_manual(f)), key=lambda p: p.suffix != ".json3")

        for group, is_asr in ((manual, False), (auto, True)):
            for f in group:
                cues = _load_cues(f)
                if len(cues) >= 3:
                    return {
                        "source": "asr" if is_asr else "subs",
                        "is_asr": is_asr,
                        "cues": cues,
                        "text": _cues_to_text(cues),
                    }
    return None


# ---------------------------------------------------------------- whisper via Groq


def _download_audio(url: str, dest_dir: str) -> Path | None:
    """Grab the smallest usable audio-only stream. No ffmpeg needed - Groq's Whisper
    accepts m4a/webm/opus directly, so we don't re-encode."""
    if not _have("yt-dlp"):
        return None
    out = f"{dest_dir}/audio.%(ext)s"
    fmt = "bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/worstaudio"
    if _have("ffmpeg"):
        _run(["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "5",
              "--extractor-args", _EXTRACTOR_ARGS,
              "--no-warnings", "--no-progress", "-o", out, url])
    else:
        _run(["yt-dlp", "-f", fmt, "--extractor-args", _EXTRACTOR_ARGS,
              "--no-warnings", "--no-progress", "-o", out, url])
    files = [p for p in Path(dest_dir).glob("audio.*") if p.stat().st_size > 1000]
    return files[0] if files else None


GROQ_WHISPER_MODEL = os.environ.get("GROQ_WHISPER_MODEL", "whisper-large-v3")


def _groq_whisper(audio: Path) -> dict | None:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return None
    url = "https://api.groq.com/openai/v1/audio/transcriptions"
    fields = {"model": GROQ_WHISPER_MODEL, "response_format": "verbose_json",
              "temperature": "0"}

    res = None
    try:
        import requests  # type: ignore
        with audio.open("rb") as fh:
            r = requests.post(url, headers={"Authorization": f"Bearer {key}"},
                              data=fields, files={"file": (audio.name, fh, "audio/mpeg")},
                              timeout=600)
        r.raise_for_status()
        res = r.json()
    except Exception:
        # curl fallback (old-TLS dev machines / no requests)
        cmd = ["curl", "-sS", "--max-time", "600", url,
               "-H", f"Authorization: Bearer {key}"]
        for k, v in fields.items():
            cmd += ["-F", f"{k}={v}"]
        cmd += ["-F", f"file=@{audio}"]
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=660).stdout
        try:
            res = json.loads(out)
        except json.JSONDecodeError:
            return None
    if not res:
        return None

    segs = res.get("segments") or []
    cues = [{"t": round(s.get("start", 0), 2), "text": s.get("text", "").strip()}
            for s in segs if s.get("text", "").strip()]
    if not cues and res.get("text"):
        cues = [{"t": 0.0, "text": res["text"].strip()}]
    if not cues:
        return None
    return {"source": "whisper", "is_asr": True, "cues": cues, "text": _cues_to_text(cues)}


# ---------------------------------------------------------------- public


def _whisper_from_url(url: str) -> dict | None:
    with tempfile.TemporaryDirectory() as tmp:
        audio = _download_audio(url, tmp)
        if not audio:
            return None
        try:
            return _groq_whisper(audio)
        except Exception:
            return None


def fetch_transcript(url: str, *, allow_audio: bool = False,
                     force_audio: bool = False) -> dict | None:
    """
    allow_audio  - fall back to Whisper only if no captions exist
    force_audio  - go straight to Whisper (used to re-try a song whose auto-captions
                   were too garbled to reconcile)
    """
    if force_audio and allow_audio:
        got = _whisper_from_url(url)
        if got:
            return got
    for _ in range(3):
        got = _ytdlp_captions(url)
        if got:
            return got
    if allow_audio:
        return _whisper_from_url(url)
    return None


if __name__ == "__main__":
    import sys

    u = sys.argv[1] if len(sys.argv) > 1 else "https://www.youtube.com/watch?v=LULK2nZ6sCc"
    allow = "--audio" in sys.argv
    got = fetch_transcript(u, allow_audio=allow)
    if not got:
        print("no transcript")
    else:
        print(f'source={got["source"]} is_asr={got["is_asr"]} cues={len(got["cues"])}')
        print("\n".join(f'  {c["t"]:>7.1f}  {c["text"]}' for c in got["cues"][:40]))
