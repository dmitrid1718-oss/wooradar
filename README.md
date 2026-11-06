# WooRadar™
**Observe the unusual. Measure the evidence.**

A source-backed world observation map modeled on HackRadar's static architecture. Leaflet + CARTO tiles provide working geographic pan, zoom, marker popups, report links and filters.

## Data pipeline
The initial connected stream is the [NASA/JPL CNEOS fireball API](https://ssd-api.jpl.nasa.gov/doc/fireball.html). These are real instrument-observed meteors, **not** unexplained UAP. The collector stores only reports with valid coordinates. Empty categories remain empty until trustworthy sources are connected.

Run **Actions → Refresh WooRadar observation feed → Run workflow** to populate the first dataset. Subsequently, GitHub Actions refreshes every six hours. If a source fails, the workflow stops without replacing old data. The page displays snapshot age/staleness.

## Deployment
In GitHub → Settings → Pages, enable deployment from branch `main` / root, or connect this repository to Vercel. Configure `wooradar.org` using your hosting provider's DNS instructions. GitHub Pages builds triggered by the default GITHUB_TOKEN might not redeploy after scheduled data commits; an external Git-based deployment or Pages Actions deployment workflow may be needed.

## Boundaries
The map is functional but feed collection has to run after initial publication. There is no claim of real-time global coverage. No fabricated sightings, no invented scores, no personal coordinates, and no automatic inference that an event is paranormal.

An Anomaly Works instrument · Useless Instruments LLC.
