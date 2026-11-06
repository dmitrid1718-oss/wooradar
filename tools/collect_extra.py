#!/usr/bin/env python3
"""WooRadar supplemental sources: independent, sourced data with clear provenance.
No invented coordinates or unverified claims. A failed source retains its last
successful snapshot, and failure status is reported in the manifest.
"""
import datetime as dt
import json, os, pathlib, re, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/"data"/"extras.json"
NOW=dt.datetime.now(dt.timezone.utc)
UA="WooRadar/0.3 (independent research feed; contact through wooradar.org)"
def get_json(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA,"Accept":"application/json, application/geo+json"})
    with urllib.request.urlopen(req,timeout=35) as r:return json.load(r)
def get_xml(url):
    req=urllib.request.Request(url,headers={"User-Agent":UA})
    with urllib.request.urlopen(req,timeout=35) as r:return ET.fromstring(r.read())
def stamp(s):
    if not s:return None
    t=str(s).strip().replace(" ","T")
    if len(t)==10:t+="T12:00:00Z"
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$",t):t+=":00Z"
    if t.endswith("Z"):t=t[:-1]+"+00:00"
    try:return dt.datetime.fromisoformat(t).astimezone(dt.timezone.utc).isoformat().replace("+00:00","Z")
    except (ValueError,TypeError):return None
def record(id,title,date,source,url,kind="other",lat=None,lon=None,detail="",status="source record"):
    if not date or not url.startswith("https://"):return None
    out={"id":str(id)[:150],"title":str(title)[:220],"date":date,"source":source,"url":url,"kind":kind,"detail":str(detail)[:300],"status":status}
    if lat is not None and lon is not None:
        try:
            lat=float(lat);lon=float(lon)
            if -90<=lat<=90 and -180<=lon<=180:out.update(lat=lat,lon=lon)
        except (TypeError,ValueError):pass
    return out
def geipan():
    # Open GEIPAN/CNES French-case GeoJSON via The UAP Atlas; no NUFORC rehosting.
    url="https://theuapatlas.com/data/geipan.geojson"
    data=get_json(url);rows=[]
    for i,f in enumerate(data.get("features",[])):
        p=f.get("properties") or {}
        g=f.get("geometry") or {}
        coords=g.get("coordinates") if g.get("type")=="Point" else None
        if not isinstance(coords,list) or len(coords)<2:continue
        date=next((stamp(p.get(k)) for k in ("date","datetime","event_date","date_obs","date_debut","startDate","time") if stamp(p.get(k))),None)
        # Only publish precisely dated cases. Do not substitute a collection/update date.
        if not date:continue
        link=next((p.get(k) for k in ("sourceUrl","url","link","case_url","url_case","source_url") if isinstance(p.get(k),str) and p.get(k).startswith("https://")),"https://www.geipan.fr/")
        classification=next((str(p.get(k)) for k in ("classification","classe","class","category") if p.get(k)),"Unspecified")
        title=next((str(p.get(k)) for k in ("title","name","cas","case_name") if p.get(k)),"French GEIPAN case")
        r=record("geipan-"+str(p.get("id") or i),title,date,"GEIPAN / CNES via UAP Atlas",link,"uap",coords[1],coords[0],"GEIPAN classification: "+classification,"documented case, not verified extraordinary")
        if r:rows.append(r)
    return sorted(rows,key=lambda r:r["date"],reverse=True)[:1000]
def nuforc():
    # UAP Atlas explicitly exports factual NUFORC fields with attribution.
    # Never copy NUFORC witness narratives; link to sourceUrl.
    url="https://theuapatlas.com/api/export?"+urllib.parse.urlencode({"format":"json","from":"2024","to":str(NOW.year),"limit":5000})
    data=get_json(url)
    if isinstance(data,list):records=data
    elif isinstance(data,dict):records=next((v for k,v in data.items() if k in ("records","reports","data","items") and isinstance(v,list)),[])
    else:records=[]
    rows=[]
    for i,p in enumerate(records):
        if not isinstance(p,dict):continue
        date=stamp(p.get("datetime"))
        link=p.get("sourceUrl")
        if not date or not isinstance(link,str) or not link.startswith("https://"):continue
        shape=str(p.get("shape") or "Unspecified").strip()[:80]
        title="Civilian sighting report · "+shape
        details="City-level report coordinates; witness claim, not a verified unidentified object."
        r=record("nuforc-"+str(p.get("id") or i),title,date,"NUFORC via The UAP Atlas",link,"report",p.get("lat"),p.get("lng"),details,"unverified witness report")
        if r and "lat" in r:rows.append(r)
    rows.sort(key=lambda x:x["date"],reverse=True)
    return rows[:2500]

def crossref():
    # Independent metadata source; no proxy scores or arbitrary map coordinates.
    rows=[]
    topics=("consciousness neuroscience","emergent artificial intelligence","unusual quantum phenomena")
    for topic in topics:
        url="https://api.crossref.org/works?"+urllib.parse.urlencode({"query":topic,"rows":15,"sort":"published","order":"desc","filter":"from-pub-date:2026-01-01"})
        response=get_json(url)
        for p in response.get("message",{}).get("items",[]):
            doi=p.get("DOI")
            if not doi:continue
            parts=(p.get("published") or p.get("created") or {}).get("date-parts",[])
            if not parts:continue
            ymd=parts[0]+[1,1]
            try:date=stamp("%04d-%02d-%02d"%tuple(ymd[:3]))
            except (TypeError,ValueError):continue
            title=" ".join(p.get("title",[])[:1])
            if not title:continue
            r=record("crossref-"+doi,title,date,"Crossref scholarly metadata","https://doi.org/"+doi,"research",detail="Published scholarly metadata; relevance based on search terms, not verified anomaly",status="research publication")
            if r:r["topic"]=topic;rows.append(r)
    return list({r["id"]:r for r in rows}.values())

def noaa():
    raw=get_json("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json")
    rows=[]
    for p in raw:
        if not isinstance(p,dict):continue
        date=stamp(p.get("time_tag"))
        try:kp=float(p["Kp"])
        except (ValueError,TypeError,KeyError):continue
        if date:
            r=record("kp-"+date,"Planetary Kp "+format(kp,".2f"),date,"NOAA SWPC","https://www.swpc.noaa.gov/products/planetary-k-index","spaceweather",detail="Planet-wide geomagnetic index; 5+ indicates storm conditions",status="measured geomagnetic index")
            if r:r["kp"]=kp;rows.append(r)
    return rows[-100:]
def donki():
    # DEMO_KEY is rate-limited; optional NASA_API_KEY can be set as an Actions secret.
    key=os.environ.get("NASA_API_KEY","DEMO_KEY")
    start=(NOW-dt.timedelta(days=21)).date().isoformat();end=NOW.date().isoformat()
    base="https://api.nasa.gov/DONKI/"
    rows=[]
    for endpoint,kind in (("GST","geomagnetic storm"),("CME","coronal mass ejection")):
        url=base+endpoint+"?"+urllib.parse.urlencode({"startDate":start,"endDate":end,"api_key":key})
        data=get_json(url)
        if not isinstance(data,list):continue
        for p in data:
            date=stamp(p.get("startTime") or p.get("activityID","").split("-")[0])
            if not date:continue
            sourceurl=p.get("link") or "https://kauai.ccmc.gsfc.nasa.gov/DONKI/"
            if not str(sourceurl).startswith("https://"):sourceurl="https://api.nasa.gov/"
            r=record("donki-"+str(p.get("gstID") or p.get("activityID") or date),kind.title(),date,"NASA DONKI",sourceurl,"spaceweather",detail="Solar/geomagnetic activity; no ground incident coordinates",status="space-weather record")
            if r:rows.append(r)
    return rows[:150]
def official_uap():
    data=get_json("https://uap-archive.org/uap/data/uap-records.json")
    rows=[]
    for p in data.get("records",[]):
        # Archive describes DOCUMENT records; most have only a decade, no event day or location.
        # Put them in a document shelf with a null date instead of inventing a day.
        url=p.get("officialLandingUrl") or p.get("sourceUrl") or ""
        if not str(url).startswith("https://"):continue
        rows.append({"id":"archive-"+str(p.get("id","")),"kind":"document","title":str(p.get("title","Official UAP record"))[:200],"source":"UAP Records Archive / "+str(p.get("agencyId","government")).upper(),"url":url,"date":None,"status":str(p.get("status","cataloged document")),"detail":"Official-source document catalog; no verified event date or coordinates","period":str(p.get("decade",""))})
    return rows[:150]
def arxiv():
    queries={"consciousness":'all:"consciousness" AND cat:q-bio.NC',"ai":'all:"emergent behavior" AND cat:cs.AI',"physics":'all:"anomalous" AND cat:quant-ph'}
    ns={"a":"http://www.w3.org/2005/Atom"}
    out=[]
    for index,(category,q) in enumerate(queries.items()):
        if index:time.sleep(3.2)
        url="https://export.arxiv.org/api/query?"+urllib.parse.urlencode({"search_query":q,"start":0,"max_results":15,"sortBy":"submittedDate","sortOrder":"descending"})
        root=get_xml(url)
        for e in root.findall("a:entry",ns):
            title=" ".join((e.findtext("a:title","",ns) or "").split())
            link=e.findtext("a:id","",ns).replace("http://arxiv.org/abs/","https://arxiv.org/abs/");date=stamp(e.findtext("a:published","",ns))
            if date and link.startswith("https://"):
                r=record("arxiv-"+link.rsplit("/",1)[-1],title,date,"arXiv",link,"research",detail="Preprint; not a verified anomaly",status="research preprint")
                if r:r["topic"]=category;out.append(r)
    return out
def main():
    prior={}
    if OUT.exists():
        try:prior=json.loads(OUT.read_text(encoding="utf-8")).get("sources",{})
        except (ValueError,OSError):pass
    jobs={"geipan":geipan,"nuforc":nuforc,"noaa":noaa,"donki":donki,"official_uap":official_uap,"arxiv":arxiv,"crossref":crossref}
    sources={}
    for name,run in jobs.items():
        prev=prior.get(name,{})
        try:
            items=run()
            if not items:raise ValueError("Source yielded no usable records; prior snapshot retained")
            sources[name]={"state":"ok","updated_utc":NOW.isoformat(),"items":items}
            print(name,len(items),"OK")
        except Exception as exc:
            print(name,"FAILED",str(exc)[:180])
            sources[name]={"state":"stale" if prev.get("items") else "unavailable","updated_utc":prev.get("updated_utc"),"items":prev.get("items",[]),"error":str(exc)[:150]}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps({"version":1,"checked_utc":NOW.isoformat(),"sources":sources},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
if __name__=="__main__":main()
