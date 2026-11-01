"""Sunday Starts Saturday: the Saturday-evening email.

Builds this Sunday's pamphlet from what Worship Studio published and emails it
to the list. The page prepare.html shows the same thing live.

    python3 scripts/sunday_mail.py --dry-run            # write out/sunday-starts-saturday.html, send nothing
    python3 scripts/sunday_mail.py --to you@example.com # one test send
    python3 scripts/sunday_mail.py                      # send to everyone on the list

Reads (no key needed):
    https://worship.legacybiblechurch.com/js/worship-service.js   the order of worship
    https://worship.legacybiblechurch.com/js/songs-data.js        song titles and YouTube links

Environment (GitHub Actions secrets):
    SMTP_USER     the sending Gmail address (the church account)
    SMTP_PASS     a Gmail app password for that account
    SUNDAY_LIST   the recipients, one per line or comma separated
    MAIL_FROM     optional, default "Legacy Bible Church <SMTP_USER>"
    SMTP_HOST / SMTP_PORT   optional, default smtp.gmail.com 465

Refuses to send when the published order was set before last Sunday's service,
because that means last Sunday's order is still up. Nothing is ever
invented: a missing item is simply left out.
"""
from __future__ import annotations

import argparse
import html
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from zoneinfo import ZoneInfo

WORSHIP = "https://worship.legacybiblechurch.com"
SITE = "https://legacybiblechurch.com"
ZONE = ZoneInfo("America/Los_Angeles")
COMMITS = "https://api.github.com/repos/legacybiblechurch/worship/commits?path=js/worship-service.js&per_page=1"
NASB_NOTICE = ("Scripture quotations taken from the (NASB®) New American Standard Bible®, "
               "Copyright © 1960, 1971, 1977, 1995 by The Lockman Foundation. Used by permission. "
               "All rights reserved. lockman.org")


def get(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "lbc-sunday-mail"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def load_service() -> tuple[list, dict]:
    src = get(f"{WORSHIP}/js/worship-service.js")
    m = re.search(r"window\.WORSHIP_SERVICE\s*=\s*(\[[\s\S]*?\]);", src)
    order = json.loads(m.group(1)) if m else []
    m = re.search(r"window\.WORSHIP_SAVED\s*=\s*(\{[\s\S]*?\});\s*$", src)
    saved = json.loads(m.group(1)) if m else {}
    return order, saved


def load_songs() -> dict:
    src = get(f"{WORSHIP}/js/songs-data.js")
    songs = {}
    for m in re.finditer(r'"([a-z0-9-]+)":\s*\{\s*title:\s*"((?:[^"\\]|\\.)*)"(?:,\s*youtube:\s*"([^"]*)")?', src):
        songs[m.group(1)] = {"title": json.loads('"' + m.group(2) + '"'), "youtube": m.group(3) or ""}
    return songs


def next_sunday(now: datetime) -> datetime:
    local = now.astimezone(ZONE)
    ahead = (6 - local.weekday()) % 7  # Monday=0 ... Sunday=6
    return (local + timedelta(days=ahead)).replace(hour=0, minute=0, second=0, microsecond=0)


def last_service(now: datetime) -> datetime:
    """Noon on the most recent Sunday before now, church time. An order set
    before that was for a Sunday that has already happened."""
    local = now.astimezone(ZONE)
    back = (local.weekday() + 1) % 7  # days since Sunday
    sunday = (local - timedelta(days=back)).replace(hour=12, minute=0, second=0, microsecond=0)
    return sunday if sunday < local else sunday - timedelta(days=7)


def published_at() -> datetime | None:
    try:
        data = json.loads(get(COMMITS))
        when = data[0]["commit"]["committer"]["date"]
        return datetime.fromisoformat(when.replace("Z", "+00:00"))
    except Exception:
        return None


def items_of(order: list, saved: dict, songs: dict) -> list[dict]:
    """The pamphlet lines, in service order. Each: kind, kicker, title, sub, verses, link, note."""
    keep = [it for it in order if it.get("type") in ("song", "scripture", "sermon", "words")]
    sermon_at = next((i for i, it in enumerate(keep) if it["type"] == "sermon"), -1)
    out = []
    for i, it in enumerate(keep):
        t = it["type"]
        if t == "scripture":
            verses = [v for v in it.get("verses") or [] if str(v.get("text", "")).strip()]
            out.append({"kind": t, "kicker": "Scripture Reading", "title": it.get("ref") or "Scripture Reading",
                        "sub": f"Read in the {it['version']}" if it.get("version") else "",
                        "verses": [(v.get("n"), re.sub(r"\s+", " ", str(v["text"])).strip()) for v in verses],
                        "notice": NASB_NOTICE if re.search("NASB", it.get("version") or "", re.I) else "",
                        "note": "" if verses else "Read it before you come."})
        elif t == "song":
            s = songs.get(it.get("slug"), {"title": str(it.get("slug", "")).replace("-", " "), "youtube": ""})
            kicker = "Song" if sermon_at < 0 else ("Opening Song" if i < sermon_at else "Closing Song")
            out.append({"kind": t, "kicker": kicker, "title": s["title"], "link": s.get("youtube", "")})
        elif t == "sermon":
            passage = it.get("passage") or ""
            out.append({"kind": t, "kicker": "Sermon", "title": it.get("title") or "Sermon", "sub": passage,
                        "note": f"Read {passage} tonight so the sermon lands on ground you already know." if passage else ""})
        elif t == "words":
            w = saved.get(it.get("id"), {})
            out.append({"kind": t, "kicker": "Together", "title": w.get("title") or "The Lord’s Table"})
    return out


def build_html(date_label: str, items: list[dict]) -> str:
    e = html.escape
    gold, ink, dim, line = "#9a7b2f", "#1b1b1b", "#6a6a6a", "#e6e2d8"
    rows = []
    for it in items:
        parts = [f'<p style="margin:0 0 6px;font:700 11px/1 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:{gold}">{e(it["kicker"])}</p>',
                 f'<p style="margin:0 0 4px;font:600 21px/1.3 Georgia,serif;color:{ink}">{e(it["title"])}</p>']
        if it.get("sub"):
            parts.append(f'<p style="margin:0 0 6px;font:15px/1.5 Arial,sans-serif;color:{dim}">{e(it["sub"])}</p>')
        for n, text in it.get("verses", []):
            parts.append(f'<p style="margin:0 0 8px;font:16px/1.7 Georgia,serif;color:{ink}"><sup style="color:{gold};font-size:11px">{e(str(n))}</sup> {e(text)}</p>')
        if it.get("notice"):
            parts.append(f'<p style="margin:10px 0 0;font:11px/1.5 Arial,sans-serif;color:#9a9a9a">{e(it["notice"])}</p>')
        if it.get("note"):
            parts.append(f'<p style="margin:8px 0 0;font:15px/1.6 Arial,sans-serif;color:{dim}">{e(it["note"])}</p>')
        if it.get("link"):
            parts.append(f'<p style="margin:8px 0 0;font:15px/1.6 Arial,sans-serif"><a href="{e(it["link"])}" style="color:{gold};font-weight:600;text-decoration:none">Listen before Sunday →</a></p>')
        rows.append(f'<tr><td style="padding:22px 0;border-top:1px solid {line}">{"".join(parts)}</td></tr>')
    body = "".join(rows) if rows else f'<tr><td style="padding:22px 0;font:italic 16px/1.6 Georgia,serif;color:{dim}">This Sunday has not been set yet.</td></tr>'
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Sunday Starts Saturday</title></head>
<body style="margin:0;padding:0;background:#f4f1ea">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;padding:36px 32px">
<tr><td>
  <p style="margin:0 0 8px;font:700 11px/1 Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:{gold}">Legacy Bible Church &middot; {e(date_label)}</p>
  <h1 style="margin:0 0 6px;font:400 34px/1.15 Georgia,serif;color:{ink}">Sunday Starts Saturday</h1>
  <p style="margin:0 0 22px;font:italic 17px/1.5 Georgia,serif;color:{dim}">Prepare your hearts to receive God&rsquo;s Word.</p>
  <p style="margin:0 0 26px;font:16px/1.7 Arial,sans-serif;color:{ink}">Here is what we will do together tomorrow morning. Read the passage tonight. Play the songs in the car. Pray for Pastor Todd and for the people who will sit near you. Then come at 10:30 ready to worship.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{body}</table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f8f6f0;border-radius:8px"><tr><td style="padding:18px 20px">
    <p style="margin:0 0 6px;font:600 16px/1.4 Georgia,serif;color:{ink}">Before you sleep</p>
    <p style="margin:0;font:15px/1.7 Arial,sans-serif;color:{dim}">Read the passage once slowly and ask God to show you one thing in it. Pray for Pastor Todd as he preaches. Pray for someone by name who will be in the room. If you cannot be there in person you can <a href="{SITE}/watch.html" style="color:{gold}">watch live</a> at 10:30.</p>
  </td></tr></table>
  <p style="margin:28px 0 0;font:13px/1.6 Arial,sans-serif;color:#9a9a9a">Sundays at 10:30 AM &middot; Redlands, California &middot; <a href="{SITE}/prepare.html" style="color:#9a9a9a">See this on the website</a><br>Reply to this email to stop receiving it.</p>
</td></tr></table>
</td></tr></table>
</body></html>"""


def build_text(date_label: str, items: list[dict]) -> str:
    lines = ["LEGACY BIBLE CHURCH  ·  " + date_label, "", "Sunday Starts Saturday", "Prepare your hearts to receive God's Word.", "",
             "Here is what we will do together tomorrow morning. Read the passage tonight. Play the songs in the car. "
             "Pray for Pastor Todd and for the people who will sit near you. Then come at 10:30 ready to worship.", ""]
    for it in items:
        lines += [it["kicker"].upper(), it["title"]]
        if it.get("sub"): lines.append(it["sub"])
        for n, text in it.get("verses", []): lines.append(f"{n} {text}")
        if it.get("notice"): lines.append(it["notice"])
        if it.get("note"): lines.append(it["note"])
        if it.get("link"): lines.append("Listen before Sunday: " + it["link"])
        lines.append("")
    if not items:
        lines += ["This Sunday has not been set yet.", ""]
    lines += ["BEFORE YOU SLEEP", "Read the passage once slowly and ask God to show you one thing in it. Pray for Pastor Todd as he preaches. "
              "Pray for someone by name who will be in the room. Cannot be there? Watch live at 10:30: " + SITE + "/watch.html", "",
              "Sundays at 10:30 AM · Redlands, California · " + SITE + "/prepare.html", "Reply to this email to stop receiving it."]
    return "\n".join(lines)


def recipients(override: str) -> list[str]:
    raw = override or os.environ.get("SUNDAY_LIST", "")
    return [a.strip() for a in re.split(r"[\n,;]+", raw) if a.strip()]


def send(to: list[str], subject: str, text: str, body: str) -> None:
    user, pw = os.environ.get("SMTP_USER", ""), os.environ.get("SMTP_PASS", "")
    if not user or not pw:
        sys.exit("SMTP_USER and SMTP_PASS are not set. Add them as repository secrets to send.")
    host, port = os.environ.get("SMTP_HOST", "smtp.gmail.com"), int(os.environ.get("SMTP_PORT", "465"))
    sender = os.environ.get("MAIL_FROM") or formataddr(("Legacy Bible Church", user))
    with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=60) as s:
        s.login(user, pw)
        for addr in to:
            msg = EmailMessage()
            msg["From"], msg["To"], msg["Subject"] = sender, addr, subject
            msg["Reply-To"] = user
            msg.set_content(text)
            msg.add_alternative(body, subtype="html")
            s.send_message(msg)
            print("sent to", addr)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry-run", action="store_true", help="build the email into out/ and send nothing")
    ap.add_argument("--to", default="", help="send to this address (or list) instead of SUNDAY_LIST")
    ap.add_argument("--only-at-pacific-hour", type=int, default=None,
                    help="do nothing unless the current hour in Los Angeles is this (for a double cron that covers daylight and standard time)")
    ap.add_argument("--skip-stale-check", action="store_true")
    a = ap.parse_args()

    now = datetime.now(timezone.utc)
    if a.only_at_pacific_hour is not None and now.astimezone(ZONE).hour != a.only_at_pacific_hour:
        print(f"Not {a.only_at_pacific_hour}:00 in Los Angeles right now ({now.astimezone(ZONE):%H:%M}). Nothing to do.")
        return

    order, saved = load_service()
    songs = load_songs()
    items = items_of(order, saved, songs)
    sunday = next_sunday(now)
    label = sunday.strftime("%A, %B ") + str(sunday.day)
    subject = f"Sunday Starts Saturday: {label}"
    body, text = build_html(label, items), build_text(label, items)

    out = Path("out"); out.mkdir(exist_ok=True)
    (out / "sunday-starts-saturday.html").write_text(body, encoding="utf-8")
    (out / "sunday-starts-saturday.txt").write_text(text, encoding="utf-8")
    print(f"Built {subject}: {len(items)} items -> out/sunday-starts-saturday.html")

    if not items:
        sys.exit("The published order of worship is empty. Set Sunday in Worship Studio, then run again.")
    if not a.skip_stale_check:
        when = published_at()
        if when and when < last_service(now):
            sys.exit(f"The order of worship was last set {when.astimezone(ZONE):%A, %B %-d}, before last Sunday's service. "
                     "That is a past Sunday, so nothing was sent. "
                     "Set this Sunday in Worship Studio and run again, or pass --skip-stale-check.")
    if a.dry_run:
        print("Dry run: nothing sent. Recipients on the list:", len(recipients(a.to)))
        return
    to = recipients(a.to)
    if not to:
        sys.exit("No recipients. Set the SUNDAY_LIST secret (one address per line) or pass --to.")
    send(to, subject, text, body)
    print(f"Done: {len(to)} sent.")


if __name__ == "__main__":
    main()
