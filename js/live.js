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
  SERVICE_TIME: "Sundays at 10:00 AM Pacific",
};
