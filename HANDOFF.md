# LBC Worship System — Handoff

Everything that makes the Sunday worship lyrics work. If you're the person now
looking after this, read this once.

## What it is

A set of static web pages hosted on GitHub Pages, plus a scheduled GitHub Action
that prepares the songs. No servers to run, no apps to install.

Live site: https://legacybiblechurch.github.io/legacy-bible-church/

| Page | What it's for |
|---|---|
| `worship.html` | **The home page.** Give this link to whoever runs Sunday. Plain-language steps + live status. |
| `worship-prep.html` | Review the auto-drafted songs, see candidate videos, check lyrics. |
| `worship-control.html` | The presenter panel — drives slides during the service. |
| `worship-display.html` | The TV screen. Opened in a second window, dragged to the TV. Follows Control via `BroadcastChannel`. |
| `setlist.html` | Public list of this Sunday's songs with a Play button per song (opens the approved YouTube video). |

## The weekly workflow (what the operator does)

1. Open the **setlist Google Sheet**. In column **A**, replace last week's songs with
   this week's — one per row. Clear columns B, C, D.
2. Wait ~20 minutes. The GitHub Action runs, finds candidate videos, and drafts lyrics.
3. Open **worship-prep.html**. For each song:
   - "no review needed" → just set column **C** (Review) to `Approve` in the sheet.
   - otherwise → pick the video that sounds right, put its URL in column **B** (Video),
     set column **C** to `Approve`. Wrong words → describe the fix in column **D** (Fixes).
4. Wait ~20 min. Every song should show **Approved**, and appear in the "This Sunday"
   box on `worship.html`.

Sunday morning: open Control on the laptop, Display in a second window on the TV,
Setlist for the play buttons. `←` `→` move slides, `B` blanks the screen.

## How the automation works

`.github/workflows/worship-prep.yml` runs `scripts/prep/run.py` every 20 minutes
on Fri/Sat/Sun (and on a manual "Run workflow" button in the repo's Actions tab).

**Pass A (draft)** — for each song in the sheet that isn't approved yet:
- resolve the typed name to a library slug (`scripts/prep/resolve.py`)
- if the song is already in `js/songs-data.js` with a real video → mark it
  "ready, no review needed", skip everything else
- otherwise: search YouTube (`videos.py`), fetch each candidate's captions
  (`transcript.py` — Supadata first, then yt-dlp, then the video's description),
  and have an LLM reconcile the transcript against the library lyrics into
  slide-ordered lyrics with a confidence score (`reconcile.py`)
- write `drafts/<slug>.json` and `drafts/status.json`, commit

**Pass B (apply)** — for each sheet row with Review = `Approve`:
- take the chosen video, apply any Fixes, write the final entry into
  `js/songs-data.js`, and rebuild `js/worship-songs.js` (the live setlist)
- record the approval in `drafts/approvals.json`

`js/songs-data.js` is the permanent song library. Once a song is approved its
video + lyrics are frozen there; re-using it later is instant and needs no review
(type `redo` in the Review column to force a rebuild).

## Accounts and secrets

The repo is owned by the **`legacybiblechurch`** GitHub account.

GitHub → repo **Settings → Secrets and variables → Actions**:

| Secret | Service | Notes |
|---|---|---|
| `SUPADATA_API_KEY` | supadata.ai | Fetches YouTube captions (works from GitHub's servers, which YouTube blocks from yt-dlp). Free tier ~100/month. |
| `YOUTUBE_API_KEY` | Google Cloud → YouTube Data API v3 | Video search. Free tier. |
| `GROQ_API_KEY` | console.groq.com | The lyric-reconciliation LLM + Whisper fallback. Free tier. |
| `ANTHROPIC_API_KEY` | *(optional)* console.anthropic.com | If set, Claude is used for the lyric step instead of Groq — better quality, a few cents/song. |

The code auto-picks the LLM: Anthropic → Gemini → Groq, whichever key exists.
Also needed once: **Settings → Actions → General → Workflow permissions → Read and write**
(so the Action can commit its results).

## Common changes

- **The setlist sheet's edit link** — paste it into `js/sheet.js` at the line marked
  `EDIT ME`, so the "Open the setlist" buttons open the editable sheet.
- **A song's lyrics are wrong after approval** — put the song back in the sheet, type
  `redo` in Review, or fix the lyric text directly in `js/songs-data.js` (find the slug).
- **The schedule** — the `cron` line in `.github/workflows/worship-prep.yml` (UTC).
- **Run the pipeline by hand** — repo → Actions tab → "Worship prep" → Run workflow.
- **Test locally** — `cd scripts/prep && SUPADATA_API_KEY=… YOUTUBE_API_KEY=… GROQ_API_KEY=… python3 dryrun.py <slug> <slug>`

## Troubleshooting

- **Control/Display shows the wrong songs or "Not found"** — the Action hasn't run
  since the sheet changed (wait, or trigger it manually), or a slug in the sheet
  isn't in the library.
- **A song won't draft ("no transcript")** — none of the found videos have readable
  captions. Find a lyric video yourself and paste its URL into column B; the Action
  will build against it.
- **Supadata quota hit** — free tier is ~100 fetches/month; the pipeline uses ~6 per
  prep session. Upgrade the plan or wait for the monthly reset.
- **Action fails on commit/push** — check Settings → Actions → Workflow permissions
  is set to "Read and write".
