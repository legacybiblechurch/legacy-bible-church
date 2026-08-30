# LBC Livestream — Handoff

How Sunday services get streamed so people who are sick or away can still
worship with us. Written for whoever runs it next.

## What it is

- We stream to **YouTube Live** from the church's YouTube channel.
- The website has a **Watch Live** page (`watch.html`), in the top menu of
  every page. It embeds the service when you paste the week's stream link into
  `js/live.js`, always offers a "Watch on YouTube" button, and points to past
  sermons the rest of the week.
- `js/live.js` is the only file you touch — one line, once a week.

Live page: https://legacybiblechurch.github.io/legacy-bible-church/watch.html

## First-time setup (do this once, a full day ahead)

YouTube makes you **wait 24 hours** after enabling live streaming before your
very first stream. Do this on a weekday, not Sunday morning.

1. On a computer, sign in to YouTube **as the church account**.
2. Top-right **Create** (the camera icon) → **Go live**.
3. Follow the prompts to verify a phone number and enable live streaming.
   - If it says "available in 24 hours" — that's expected. Come back tomorrow.
   - If the Live Control Room opens — you're already enabled, skip the wait.
4. Get the **channel ID**: YouTube → **Settings** → **Advanced settings** →
   copy the "Channel ID" (starts with `UC`, ~24 characters).
5. Open `js/live.js` in this repo, paste it into the `CHANNEL_ID` line, save,
   commit, push. The Watch Live page now works.

> Mobile note: streaming from the *phone's* YouTube app needs 50+ subscribers.
> Until then, stream from a **computer** (next section) — no subscriber minimum.

## Equipment

**Minimum (works today, ~$0):**

- A laptop at the back of the room, plugged into power.
- Its built-in webcam, or a USB webcam (Logitech C920, ~$60) clipped to a shelf
  or on a cheap tripod for a wider, sharper shot.
- Wired internet if you can. Need ~5 Mbps upload — check at fast.com.
- Chrome or Edge, signed in to the church YouTube account.

**The thing that actually matters — audio:**

- Best: run a cable from the church sound mixer's output (a spare "line out"
  or headphone jack) into the laptop through a USB audio interface
  (Behringer UCA202 ~$35, or Focusrite Scarlett Solo ~$120).
- No mixer: put one clip-on or small mic near the pastor and into the laptop.
- Laptop's own mic from the back of the room = last resort. It will sound distant.

**Later upgrades:** a real camera with clean HDMI out + a USB capture stick
(Elgato Cam Link style, ~$40); OBS Studio (free) for titles and switching
between camera and slides.

## Every Sunday

1. **~20 min before:** laptop on, camera aimed at the pulpit, audio cable in.
2. YouTube → **Create → Go live** → **Webcam** (or **Streaming software** if
   using OBS).
3. Title it (e.g. "Sunday Service — August 31"). Set visibility to **Public**
   or **Unlisted**. Pick the right camera and microphone in the dropdowns.
   Watch the audio meter move when someone talks.
4. Click **Go live**. Copy the stream's watch link (the **Share** button, or
   the URL bar).
5. **Put that link on the website:** open `js/live.js`, paste it into the
   `VIDEO:` line, commit + push. Within a minute the Watch Live page plays the
   stream inline. (If you skip this, the page still shows a **Watch on YouTube**
   button that works — this step just embeds it directly.)
6. Quick check on your phone: open the Watch Live page, confirm picture + sound.
7. After the service, click **End stream**. Then set `VIDEO:` back to `""` in
   `js/live.js` and push. The recording stays on YouTube and gets posted to the
   Sermons page as usual.

## The website page

- `watch.html` — the public page. Built from `css/styles.css`, same nav/footer
  as the rest of the site.
- `js/live.js` — the only file you edit:
  - `CHANNEL_ID` — set once. Powers the "Watch on YouTube" button (always
    points at the channel's live page).
  - `VIDEO` — **the weekly one.** Paste this Sunday's stream link before the
    service to embed it on the page; clear it to `""` afterward.
  - `AUTO_EMBED` — leave `false`. If `true`, the page always tries to embed the
    channel's current live stream with no weekly paste — but then shows an ugly
    "video unavailable" box every hour the church isn't live.
  - `SERVICE_TIME` — the text shown on the page.
- The "Watch Live" menu link is in every page's nav, mobile menu, and footer.

## Streaming over Google Meet (fallback — no YouTube needed)

Use this when YouTube Live isn't available (e.g. the 24-hour activation hasn't
passed yet) or it's just a couple of people at home. It carries the pastor on a
phone and the song lyrics + audio from the laptop.

**The setup:**

- **Phone** — in the Meet, camera on the pastor, mic = his lav / a feed from
  the sound board. This is the voice.
- **Laptop** — in the Meet with **its mic muted and camera off**. It runs
  Control (window 1), Display (window 2, dragged onto the TV and full-screen),
  and Song Videos (a tab). It screen-shares to the Meet **and** drives the TV
  over HDMI — both at once, no conflict.
- Plug **earbuds into the laptop** (nobody wears them). That keeps the Meet's
  incoming audio from playing out the speakers and echoing into your share.

**The catch on a Mac:** Google Meet on macOS **cannot share system audio**, only
one tab's audio at a time. So you switch what you're sharing as the service
moves:

| Moment | Share this | Tab audio |
|---|---|---|
| Preaching, prayer, announcements | the **Display** tab | off — voice comes from the phone |
| A song | the **Song Videos** video tab | **on** ("Also share tab audio") |

When a song starts: hit Play on Song Videos, go to the video's tab, click
Chrome's **"Share this tab instead"**, tick **Also share tab audio**. When it
ends, switch the share back to the Display tab. The people at home never lose the
words — Display slides during the sermon, YouTube lyrics during songs.

**Notes:**

- The pastor's mic picks up a little room music during songs → a faint echo
  behind the clean feed. Mute the phone during songs if it bothers anyone.
- To avoid the tab-switching entirely you'd need a virtual audio device
  (**BlackHole**, free) so Meet can grab system audio — but it's fiddly to set
  up and one more thing to break on a Sunday morning. Tab-switching is safer.
- On a **Windows** laptop this is easier: share **"Entire screen"** with
  **"Share system audio"** ticked, Display full-screen, and everything the
  laptop plays goes into the Meet with no switching.

## Troubleshooting

- **Page says "Nothing streaming right now" during the service** — you haven't
  pasted this week's link yet. Put the stream's watch URL in `VIDEO` in
  `js/live.js` and push. Meanwhile the "Watch on YouTube" button still works.
- **"Available in 24 hours" on Sunday morning** — live streaming was never
  enabled ahead of time. Can't stream to YouTube today. For a one-off, start a
  Google Meet / Zoom / FaceTime call from a phone on a tripod instead, and do
  the YouTube setup this week for next Sunday.
- **Stream is choppy** — upload too slow. In Go Live settings lower the
  resolution to 720p or 480p. Use wired internet.
- **No sound / quiet sound** — wrong microphone selected in the Go Live
  dropdown, or the mixer feed isn't plugged in. Check the audio meter before
  going live.
- **Echo** — only one device in the room should have its speakers up. Mute the
  laptop's output.
