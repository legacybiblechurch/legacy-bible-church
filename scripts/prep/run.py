"""
Worship prep pipeline.  Run with no args on a schedule; it does both passes:

  Pass A (draft)  - for every Sheet row not yet approved: find candidate videos and
                    draft lyrics for each. Writes drafts/<slug>.json + drafts/status.json.
                    Never touches js/songs-data.js.

  Pass B (apply)  - for every row with Review = "Approve": take the chosen video
                    (Sheet "Video" column, else the top candidate), apply any "Fixes",
                    write the final entry into js/songs-data.js and rebuild
                    js/worship-songs.js.

  python3 run.py draft     # only pass A
  python3 run.py apply     # only pass B
  python3 run.py           # both

Env: YOUTUBE_API_KEY, GEMINI_API_KEY (or ANTHROPIC_API_KEY), [GROQ_API_KEY]
"""

from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import sys
import traceback
from pathlib import Path

import lib_songs
import reconcile as rec
import sheet as sheet_mod
import videos as yt
from resolve import resolve
from transcript import fetch_transcript

REPO = Path(__file__).resolve().parents[2]
DRAFTS = REPO / "drafts"
STATUS = DRAFTS / "status.json"

MAX_CANDIDATES = 5
RECONCILE_TOP = 2          # only draft lyrics for the N best candidates (API cost / rate limits)
ALLOW_AUDIO = bool(os.environ.get("GROQ_API_KEY"))


def next_sunday(today: dt.date | None = None) -> str:
    today = today or dt.date.today()
    return (today + dt.timedelta(days=(6 - today.weekday()) % 7)).isoformat()


def _sig(candidate_ids: list[str], reference: list | None) -> str:
    h = hashlib.sha256()
    h.update("|".join(candidate_ids).encode())
    h.update(json.dumps(reference or [], sort_keys=True).encode())
    return h.hexdigest()[:16]


def _draft_path(slug: str) -> Path:
    return DRAFTS / f"{slug}.json"


def _load_draft(slug: str) -> dict | None:
    p = _draft_path(slug)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            return None
    return None


# ---------------------------------------------------------------- pass A


def draft_row(row: sheet_mod.Row, songs: dict) -> dict:
    slug, title, is_new = resolve(row.song)
    row.slug, row.title, row.is_new = slug, title, is_new
    reference = None if is_new else songs[slug]["lyrics"]

    # candidate videos
    forced = yt.video_id(row.video) if row.video else None
    candidates: list[dict] = []
    if forced:
        d = yt.details(forced)
        if d:
            candidates.append(d)
    for c in yt.search(title, max_results=MAX_CANDIDATES):
        if c["videoId"] not in {x["videoId"] for x in candidates}:
            candidates.append(c)
    candidates = candidates[:MAX_CANDIDATES + (1 if forced else 0)]

    prev = _load_draft(slug)
    signature = _sig([c["videoId"] for c in candidates], reference)
    if prev and prev.get("signature") == signature and not row.redo:
        prev["input"] = row.song
        prev["forced"] = forced
        return prev  # unchanged — skip re-reconcile

    # draft lyrics for the top candidates
    for i, c in enumerate(candidates):
        c["lyrics"] = None
        c["transcriptSource"] = "none"
        c["confidence"] = 0
        c["notes"] = ""
        c["order"] = ""
        rank_ok = i < RECONCILE_TOP or c["videoId"] == forced
        if not rank_ok:
            continue
        try:
            tr = fetch_transcript(c["url"], allow_audio=ALLOW_AUDIO)
            if not tr:
                import transcript as _t
                c["notes"] = f"No transcript ({_t.LAST_ERROR or 'no captions'})."
                continue
            c["transcriptSource"] = tr["source"]
            r = rec.reconcile(title, reference, tr, fixes=row.fixes)
            # auto-captions too garbled to reconcile -> re-transcribe the audio
            if r["confidence"] < 55 and ALLOW_AUDIO and tr["source"] == "asr":
                tr2 = fetch_transcript(c["url"], allow_audio=True, force_audio=True)
                if tr2:
                    r2 = rec.reconcile(title, reference, tr2, fixes=row.fixes)
                    if r2["confidence"] > r["confidence"]:
                        tr, r = tr2, r2
                        c["transcriptSource"] = tr2["source"]
            c.update(lyrics=r["lyrics"], confidence=r["confidence"],
                     notes=r["notes"], order=r["order"])
        except Exception as e:  # noqa: BLE001 — one bad video shouldn't kill the run
            c["notes"] = f"Draft failed: {e}"

    draft = {
        "slug": slug,
        "title": title,
        "input": row.song,
        "isNew": is_new,
        "forced": forced,
        "signature": signature,
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "candidates": candidates,
    }
    DRAFTS.mkdir(exist_ok=True)
    _draft_path(slug).write_text(json.dumps(draft, indent=2, ensure_ascii=False))
    return draft


# ---------------------------------------------------------------- pass B


def apply_row(row: sheet_mod.Row, songs: dict) -> tuple[str, str]:
    """Returns (slug, message). Writes into songs-data.js on success."""
    slug, title, is_new = resolve(row.song)
    forced = yt.video_id(row.video) if row.video else None

    # already applied? (song in library with the chosen video) -> idempotent no-op
    if not row.redo and slug in songs:
        cur_vid = yt.video_id(songs[slug].get("youtube", ""))
        if cur_vid and (cur_vid == forced or not forced):
            return slug, f"approved — https://www.youtube.com/watch?v={cur_vid}"

    draft = _load_draft(slug)
    if not draft:
        return slug, "approved but no draft yet — will apply next run"

    cands = draft["candidates"]
    chosen = None
    if forced:
        chosen = next((c for c in cands if c["videoId"] == forced), None) or yt.details(forced)
    if not chosen:
        chosen = next((c for c in cands if c.get("lyrics")), None) or (cands[0] if cands else None)
    if not chosen:
        return slug, "approved but no usable video found"

    lyrics = chosen.get("lyrics")
    if row.fixes.strip() or not lyrics:
        reference = None if is_new else (songs[slug]["lyrics"] if slug in songs else None)
        tr = fetch_transcript(chosen["url"], allow_audio=ALLOW_AUDIO)
        if not tr and not lyrics:
            return slug, "approved but the chosen video has no transcript"
        if tr:
            r = rec.reconcile(title, reference, tr, fixes=row.fixes)
            lyrics = r["lyrics"]

    lib_songs.upsert_song(slug, title=title, youtube=chosen["url"], lyrics=lyrics)
    return slug, f"approved — {chosen['url']}"


# ---------------------------------------------------------------- driver


def write_status(entries: list[dict], sunday: str) -> None:
    DRAFTS.mkdir(exist_ok=True)
    STATUS.write_text(json.dumps({
        "updatedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "sunday": sunday,
        "songs": entries,
    }, indent=2, ensure_ascii=False))


def main(mode: str) -> None:
    rows = sheet_mod.load()
    songs = lib_songs.load_songs()
    sunday = next_sunday()
    do_draft = mode in ("draft", "both")
    do_apply = mode in ("apply", "both")

    status: list[dict] = []
    approved_slugs: list[str] = []

    for row in rows:
        entry = {"input": row.song, "review": row.review, "chosenVideo": row.video,
                 "status": "queued", "confidence": None, "message": ""}
        try:
            if do_apply and row.approved:
                slug, msg = apply_row(row, songs)
                entry.update(slug=slug, status="approved", message=msg)
                if "approved —" in msg:
                    approved_slugs.append(slug)
                else:
                    # not fully applied yet — still needs a draft
                    if do_draft:
                        d = draft_row(row, songs)
                        entry["confidence"] = _best_conf(d)
            elif do_draft:
                d = draft_row(row, songs)
                best = _best_conf(d)
                entry.update(slug=d["slug"], status="draft",
                             confidence=best,
                             message=f'{len(d["candidates"])} candidate(s)')
            status.append(entry)
        except Exception as e:  # noqa: BLE001
            entry.update(status="error", message=str(e))
            status.append(entry)
            traceback.print_exc()

    if do_apply and approved_slugs:
        # rebuild the live setlist from the approved rows, in sheet order
        ordered = []
        for row in rows:
            if row.approved:
                s, _, _ = resolve(row.song)
                if s in approved_slugs and s not in ordered:
                    ordered.append(s)
        lib_songs.write_setlist(ordered, sunday=sunday)

    write_status(status, sunday)
    print(json.dumps(status, indent=2, ensure_ascii=False))


def _best_conf(draft: dict) -> int | None:
    confs = [c.get("confidence", 0) for c in draft.get("candidates", []) if c.get("lyrics")]
    return max(confs) if confs else None


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "both"
    main({"draft": "draft", "apply": "apply", "both": "both"}.get(arg, "both"))
