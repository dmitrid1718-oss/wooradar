# WooRadar™ — observation and research dashboard

**Observe the unusual. Measure the evidence.**

Built on HackRadar's map/feed/scheduled-collector pattern. Responsive Leaflet world map using OpenStreetMap tiles, source/category/time filters, evidence-linked feed, 12-month timeline, and per-source freshness diagnostics.

## Source channels

| Source | Layer | Map | Notes |
|---|---|---|---|
| NASA/JPL CNEOS | Fireballs | Yes | Instrument-observed meteors; not unexplained craft |
| GEIPAN/CNES via The UAP Atlas | Official UAP case reports | Yes | Case classifications A-D, approximate region-level locations |
| NUFORC factual fields via The UAP Atlas | Civilian sighting reports | Yes | City-level coordinates; **claims, not verified objects**; original narratives stay with NUFORC |
| NOAA SWPC | Environmental context | No | Planetary Kp; not a geographic event |
| NASA DONKI | Environmental context | No | Space-weather event catalog; may be rate-limited |
| UAP Records Archive | Government document catalog | No | Documents, not dated incident coordinates |
| arXiv | Research preprints | No | Preprints; feed can be throttled or unavailable |
| Crossref | Research metadata | No | Published scholarly records, relevance determined by search terms |
| AMS | External fireball case cross-check | External link | Separate permissions/data ingestion needed |

**Data integrity:** The collector runs each source separately, stores its latest successful snapshot and labels source failures/staleness. The page never turns missing records into zero incidents, fabricates a date, or places non-geographic research on the world map.

## Update and deploy

- Workflows: `.github/workflows/refresh.yml` every six hours; `.github/workflows/pages.yml` handles GitHub Pages deployment.
- Collectors: `tools/collect.py` and `tools/collect_extra.py`.
- Output: `data/observations.json` and `data/extras.json`.
- The environment variable `NASA_API_KEY` can improve DONKI request quota. Without it, `DEMO_KEY` is rate limited.
- GitHub Pages deployment should be configured in repository Settings → Pages → GitHub Actions; for a custom domain configure wooradar.org DNS separately.
- Scheduled workflows are best-effort and may be delayed. Inspect GitHub Actions and the page's source-health panel for failures.

## Limitations

This is an independent research tool, not a comprehensive feed of all UAP sightings or proof of a particular explanation. An observation timestamp differs from the source-download timestamp. A high report density may reflect population and reporting culture. Do not infer causation from coincident sightings and geomagnetic activity.

An Anomaly Works instrument · Useless Instruments LLC.
