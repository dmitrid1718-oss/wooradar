#!/usr/bin/env python3
"""Collect sourced, geolocated NASA/JPL fireball records. Never manufacture events."""
import datetime as dt
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "observations.json"
API = "https://ssd-api.jpl.nasa.gov/fireball.api?limit=500"
REQUEST = urllib.request.Request(API, headers={"User-Agent": "WooRadar/0.1 (public research dashboard)"})

def coord(value, hemisphere):
    if value in (None, "") or hemisphere not in ("N","S","E","W"):
        return None
    v=float(value)
    return -v if hemisphere in ("S","W") else v

def collect():
    with urllib.request.urlopen(REQUEST, timeout=35) as response:
        payload=json.load(response)
    fields=payload["fields"]
    observations=[]
    for item in payload.get("data", []):
        row=dict(zip(fields,item))
        try:
            lat=coord(row.get("lat"),row.get("lat-dir"))
            lon=coord(row.get("lon"),row.get("lon-dir"))
            if lat is None or lon is None or not(-90<=lat<=90 and -180<=lon<=180):continue
            date=dt.datetime.strptime(row["date"],"%Y-%m-%d %H:%M:%S").replace(tzinfo=dt.timezone.utc)
            energy=row.get("energy")
            detail=("Radiated energy "+str(energy)+" × 10¹⁰ J") if energy not in (None,"") else "NASA instrument observation"
            observations.append({"id":"jpl-"+row["date"].replace(" ","T"),"kind":"fireball","title":"Atmospheric fireball · "+row["date"][:10],"date":date.isoformat().replace("+00:00","Z"),"lat":lat,"lon":lon,"status":"instrument observation","detail":detail,"url":"https://cneos.jpl.nasa.gov/fireballs/"})
        except (TypeError,ValueError,KeyError):
            continue
    if not observations:raise RuntimeError("No geolocated records; preserving prior data")
    observations.sort(key=lambda x:x["date"],reverse=True)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    data={"version":1,"updated_utc":dt.datetime.now(dt.timezone.utc).isoformat(),"source":"NASA/JPL CNEOS fireball API","events":observations}
    OUT.write_text(json.dumps(data,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf-8")
    print("Published",len(observations),"real observations")

if __name__=="__main__":collect()
