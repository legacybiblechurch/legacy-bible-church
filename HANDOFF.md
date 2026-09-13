# LBC Worship — Handoff

Everything for Sunday-morning lyrics lives on the church website. Nothing to install.

Start here: **https://legacybiblechurch.github.io/legacy-bible-church/worship.html**

## The two things a person does

**Before Sunday — Prepare the songs** (`worship-studio.html`)
1. Type a song name in the box on the left.
   - A song we've sung before appears in the list as you type. Pick it — done, it already has its words.
   - A new song: choose **Find "…" on YouTube**. The site searches, listens to the recording, and drafts the words (1–3 min). It then shows the videos it found; click **Use this one** on the one that sounds right. That saves the song for good.
2. Put the songs in order with ▲ ▼. ✕ removes one.
3. Fix any wording by typing in the **Words** box. Blank line = new slide. `[Chorus]` on its own line names a slide (Control only — never shown to the congregation). The right pane shows exactly what the TV will show. **Save.**
4. Click **Ready for Sunday**. It checks every song has words and nothing is unsaved, then publishes the set.

**Sunday morning — Run the service** (`worship-control.html`)
- Open Control on the laptop. Click **Open display** and drag that window to the TV. Control shows a green **Display connected** when the TV window is open.
- ← → or the big buttons move slides. **B** blanks the TV (shows the church logo). **Play on YouTube** opens the song's audio.
- If either window is closed or refreshed by accident, reopen it — it picks up on the same slide.

## One-time setup on each computer that will *prepare* songs

Saving needs permission to write to the website. The Studio walks through it (click **Connect this computer**): create a GitHub token on the church account with **Contents** and **Actions** set to *Read and write* for the `legacy-bible-church` repository, paste it in. Stored only in that browser. Running the service on Sunday needs no setup at all.

## How it works (for whoever maintains it)

- **Song library:** `js/songs-data.js` — every song ever prepared: title, YouTube link, words in labelled blocks. The permanent memory; the Studio writes to it directly through the GitHub API.
- **This Sunday:** `js/worship-songs.js` — the ordered list of song ids. Written by **Ready for Sunday**. Control and Display read only this.
- **Shared logic:** `js/sheet.js` (`LBCSheet`) — the one slide builder used by the Studio preview, Control and Display, plus search and the editor's text format. Sunday depends on nothing outside the site.
- **Finding a new song:** the Studio triggers the GitHub Action `worship-prep.yml` with the song name → `scripts/prep/run.py --song` searches YouTube, fetches captions (Supadata, then yt-dlp, then Whisper if audio is reachable), drafts words matched to the recording with an LLM, and commits `drafts/<slug>.json`. The Studio polls for that file.
- **Control ↔ Display:** `BroadcastChannel('lbc-worship')` in the same browser, state mirrored in `localStorage` so a refresh resumes.

### Secrets (GitHub → Settings → Secrets → Actions)
`YOUTUBE_API_KEY` (search; keyless yt-dlp search is the fallback) · `SUPADATA_API_KEY` (captions — the important one) · `GROQ_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` (the LLM that matches words to the recording; first one present wins).

### When "find" comes back with low-confidence words
The draft note on the video card says why. The usual cause is the caption service's monthly limit (`supadata: monthly plan limit reached`). Until it resets or the plan is upgraded, new songs get words from memory (marked "check every line") — the person listens and fixes them in the Words box. Songs already in the library are unaffected.

### Old pieces, kept for compatibility
`worship-prep.html` redirects to the Studio. The Google-Sheet-driven schedule in `worship-prep.yml` is commented out; `scripts/prep/sheet.py` remains only because `run.py` reuses its `Row` type.
