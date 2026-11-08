/* ============================================================
   Legacy Bible Church — livestream config
   ------------------------------------------------------------
   This is the ONLY file you edit for the Watch Live page.
   ============================================================ */

window.LBCLive = {

  // ── The church YouTube channel (set once) ───────────────
  // Used for the "Watch on YouTube" button, which always points
  // at the channel's live page.
  CHANNEL_ID: "UC4-30VxnP2q3lZGqfMUecuw",

  // ── Live detection (set once) ───────────────────────────
  // With a YouTube Data API key the page asks YouTube "is the channel
  // live right now?" every few minutes on Sunday morning. The moment
  // the stream starts it appears here with a Live now badge. Nobody
  // pastes anything.
  // Get one: console.cloud.google.com -> New project -> APIs & Services
  // -> Enable "YouTube Data API v3" -> Credentials -> Create API key.
  // Under restrictions pick Websites and add this site's address.
  // Then paste the key here.
  // Without a key the page can only show the channel's live player on
  // Sunday mornings and let YouTube say whether anything is on.
  API_KEY: "AIzaSyByfiO92GzWEgKzzOqoYQtGTz70xgdZANk",

  // ── Each Sunday: paste this week's stream link ──────────
  // Before the service, put the livestream's watch URL (or the
  // 11-character video ID) here. That embeds it right on the page.
  // Clear it back to "" after the service — the recording still
  // lives on the Sermons page and on YouTube.
  //   e.g. "https://www.youtube.com/watch?v=abc123XYZ_0"  or  "abc123XYZ_0"
  VIDEO: "",

  // ── Advanced ───────────────────────────────────────────
  // If true, when VIDEO is blank the page still tries to embed
  // whatever the channel is streaming live right now — no weekly
  // paste needed. Downside: YouTube shows a black "video
  // unavailable" box whenever the channel is NOT live, so the page
  // looks broken between services. Leave false unless you're okay
  // with that trade-off.
  AUTO_EMBED: false,

  // ── Service time shown on the page ──────────────────────
  SERVICE_TIME: "Sundays at 10:30 AM Pacific",
};
