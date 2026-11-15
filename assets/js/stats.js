// Simple, cookieless site statistics in Sorced's own PostHog project (EU, 286209), without PostHog's library.
// Sends a "$pageview" for every page, "app_store_click" when someone taps an App Store badge and "android_visitor" when
// an Android device opens a page with a badge (where it also shows the "iPhone for now" note), nothing else.
// Nothing is stored in the browser (no cookies, no localStorage): every event carries PostHog's "$posthog_cookieless"
// placeholder id plus the "$cookieless_mode" flag, and PostHog's cookieless mode turns the visitor's IP address,
// user agent and time zone into a daily-changing anonymous hash on its servers (Project settings → Web analytics → Cookieless tracking must be on), so it can count
// unique visitors per day without identifying anyone. No person profiles. Off with Do Not Track / Global Privacy
// Control, and on previews (anything but rubendep.github.io/sorced-site/). See the privacy policy, "Website statistics".
(function () {
  "use strict";
  var params = new URLSearchParams(location.search);
  var isAndroid = /Android/i.test(navigator.userAgent);

  // ---- Page helpers (these run everywhere, also with Do Not Track and on previews; they send nothing) ----

  // Android visitors: show the "iPhone for now" note next to the App Store badge (the badge stays: some Android
  // phone owners also have an iPhone or iPad). The note is in the page as <p class="android-note" hidden>.
  var androidNotes = isAndroid ? document.querySelectorAll(".android-note") : [];
  Array.prototype.forEach.call(androidNotes, function (p) { p.hidden = false; });

  // Apple campaign links: App Store Connect counts installs per campaign when the App Store link carries
  // pt=<provider token>&ct=<campaign name>. Get the provider token in App Store Connect → App Analytics →
  // Campaigns → "Generate a link": it's the number after "pt=" in the generated link (provider-level: the same for
  // all of Ruben's apps). While this is empty the
  // App Store links are left exactly as they are in the HTML.
  var APPLE_PROVIDER_TOKEN = "128095096";
  if (APPLE_PROVIDER_TOKEN) {
    var clean = function (s) { return (s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, ""); };
    var src = (params.get("utm_source") || "").toLowerCase();
    // TikTok gets one campaign per utm_campaign (tiktok_nordics_test, tiktok_en_test), so App Store Connect
    // can split installs between TikTok campaigns; Apple allows at most 40 characters.
    var ttCampaign = clean(params.get("utm_campaign"));
    var ct = params.has("fbclid") || /^(facebook|instagram|meta|fb|ig)$/.test(src) ? "meta"
           : params.has("ttclid") || src === "tiktok" ? ("tiktok" + (ttCampaign ? "_" + ttCampaign : "")).slice(0, 40)
           : clean(src).slice(0, 40) || "site";
    Array.prototype.forEach.call(document.querySelectorAll('a[href*="apps.apple.com"]'), function (a) {
      try {
        var u = new URL(a.href);
        u.searchParams.set("pt", APPLE_PROVIDER_TOKEN);
        u.searchParams.set("ct", ct);
        a.href = u.toString();
      } catch (e) { /* leave the link as it is */ }
    });
  }

  // ---- Statistics ----
  var KEY = "phc_wX6yYDevdxhdf6nRmS4vyeBLC54Aw5ZfMXQ4Ghq9cRiy"; // public project key (same as the game's, Telemetry.swift)
  var HOST = "https://eu.i.posthog.com/i/v0/e/";
  if (location.hostname !== "rubendep.github.io" || location.pathname.indexOf("/sorced-site/") !== 0) return;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  // Only the campaign tags of the address (utm_*), never anything else from the query string.
  var campaign = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
    if (params.get(k)) campaign[k] = params.get(k).slice(0, 100);
  });
  if (params.has("fbclid")) campaign.from_meta_ad = true; // Facebook/Instagram add fbclid to ad clicks; its value isn't sent
  if (params.has("ttclid")) campaign.from_tiktok_ad = true; // TikTok adds ttclid to ad clicks; its value isn't sent
  var referrer = "";
  try { referrer = document.referrer ? new URL(document.referrer).hostname : ""; } catch (e) { referrer = ""; }

  var timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { timezone = ""; }

  function send(event, extra) {
    var props = {
      // What PostHog's cookieless mode needs to turn the placeholder id into the daily hash (posthog-js sends the same):
      // the flag, the browser's user agent and its time zone (the day boundary). Without the flag the event is stored
      // as-is, so every visitor shares one id.
      $cookieless_mode: true,
      $raw_user_agent: navigator.userAgent.slice(0, 1000),
      $timezone: timezone,
      $current_url: location.origin + location.pathname, // no query string, no #fragment
      $host: location.hostname,
      $pathname: location.pathname,
      $referring_domain: referrer || "$direct",
      $screen_width: screen.width,
      $device_type: /Mobi|iPhone|Android/i.test(navigator.userAgent) ? "Mobile" : "Desktop",
      $device_id: "$posthog_cookieless",
      $process_person_profile: false,
      $lib: "site-stats",
      source: "website"
    };
    var k;
    for (k in campaign) props[k] = campaign[k];
    for (k in extra || {}) props[k] = extra[k];
    var body = JSON.stringify({ api_key: KEY, event: event, distinct_id: "$posthog_cookieless", properties: props,
                                timestamp: new Date().toISOString() });
    try {
      // text/plain keeps it a "simple" request (no CORS preflight); keepalive lets it finish when a link opens.
      fetch(HOST, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } })
        .catch(function () {});
    } catch (e) { /* never break the page */ }
  }

  send("$pageview");
  if (androidNotes.length) send("android_visitor"); // an Android phone/tablet on a page with an App Store badge
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest('a[href*="apps.apple.com"]');
    if (a) send("app_store_click", { badge: a.className || "link" });
  }, true);
})();
