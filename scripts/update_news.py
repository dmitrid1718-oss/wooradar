#!/usr/bin/env python3
"""Build a source-linked, bounded morning news snapshot. No AI-generated facts."""
import datetime as dt
import email.utils
import html
import json
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

def headlines(query):
    params = urllib.parse.urlencode({"q": query + " when:3d", "hl": "en-US", "gl": "US", "ceid": "US:en"})
    url = "https://news.google.com/rss/search?" + params
    request = urllib.request.Request(url, headers={"User-Agent": "UselessInstrumentsMorningNews/1.0"})
    with urllib.request.urlopen(request, timeout=35) as response:
        xml = response.read(3_000_000)
    root = ET.fromstring(xml)
    items, seen = [], set()
    for entry in root.findall("./channel/item"):
        raw_title = html.unescape((entry.findtext("title") or "").strip())
        link = (entry.findtext("link") or "").strip()
        if not raw_title or not link.startswith("https://") or raw_title.lower() in seen:
            continue
        seen.add(raw_title.lower())
        source = entry.findtext("source") or "Google News"
        date = entry.findtext("pubDate") or ""
        try:
            published = email.utils.parsedate_to_datetime(date).astimezone(dt.timezone.utc).isoformat()
        except (TypeError, ValueError, OverflowError):
            published = ""
        items.append({"title": raw_title[:240], "url": link, "source": source[:100], "published": published})
        if len(items) >= 6: break
    return items

topics = {
    "UAP": 'UAP OR UFO OR "unidentified anomalous phenomena"',
    "Sky observations": 'fireball OR "meteor shower" OR "atmospheric anomaly"',
    "Consciousness research": '"consciousness research" OR "science of consciousness"',
}
path = Path("news.json")
previous = json.loads(path.read_text()) if path.exists() else {}
by_url = {}
successful = []
for topic, query in topics.items():
    try:
        articles = headlines(query)
    except (OSError, ValueError, ET.ParseError) as error:
        print(f"{topic}: {error}")
        articles = []
    if articles:
        successful.append(topic)
    else:
        articles = [item for item in previous.get("items", []) if item.get("category") == topic]
    for item in articles:
        by_url.setdefault(item["url"], dict(item, category=topic))
if not successful:
    raise RuntimeError("No feeds returned current headlines; keeping the last edition")
payload = {
    "updated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    "refreshed_topics": successful,
    "items": sorted(by_url.values(), key=lambda item: item["published"], reverse=True),
}
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Saved {len(by_url)} headlines from {len(successful)} refreshed topics")
