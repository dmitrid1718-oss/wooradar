'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const map=L.map('map',{worldCopyJump:true,zoomControl:true,preferCanvas:true}).setView([17,7],2);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',maxZoom:18}).addTo(map);
 const layer=L.layerGroup().addTo(map);
 let events=[],kind='all',days='all',search='',updatedAt=null,loadOK=false;
 const fmt=d=>{const date=new Date(d);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});};
 const age=d=>{const t=Date.parse(d);if(!Number.isFinite(t))return '—';const n=Math.max(0,Date.now()-t);const h=Math.floor(n/3600000);return h<48?(h<1?'< 1h':h+'h'):Math.floor(n/86400000)+'d';};
 const valid=e=>e&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&Math.abs(e.lat)<=90&&Math.abs(e.lon)<=180&&typeof e.date==='string'&&Number.isFinite(Date.parse(e.date))&&typeof e.url==='string'&&/^https:\/\//.test(e.url);
 const getBase=()=>events.filter(e=>(kind==='all'||e.kind===kind)&& (days==='all'||Date.parse(e.date)>=Date.now()-Number(days)*86400000));
 function renderTimeline(){
  const box=$('timeline');box.replaceChildren();
  const today=new Date(), start=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth()-11,1)), bins=[];
  for(let i=0;i<12;i++){const d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+i,1));bins.push({key:d.toISOString().slice(0,7),label:d.toLocaleDateString(undefined,{month:'short',timeZone:'UTC'}),count:0});}
  for(const e of events){const k=e.date.slice(0,7),b=bins.find(x=>x.key===k);if(b)b.count++;}
  const max=Math.max(1,...bins.map(b=>b.count));
  for(const b of bins){
   const el=document.createElement('div');el.className='timeline-col';el.title=b.key+': '+b.count+' recorded event(s)';
   const bar=document.createElement('div');bar.className='bar';bar.style.height=(b.count?Math.max(3,Math.round(b.count/max*100)):2)+'%';
   const label=document.createElement('span');label.textContent=b.label;el.append(bar,label);box.append(el);
  }
 }
 function render(){
  const query=search.trim().toLowerCase();
  const list=getBase().filter(e=>!query||[e.title,e.date,e.detail,String(e.lat),String(e.lon),e.status].join(' ').toLowerCase().includes(query));
  layer.clearLayers();
  const frag=document.createDocumentFragment(),bounds=[];
  const radius=map.getZoom()<=3?3.5:map.getZoom()<=5?5:7;
  for(const e of list){
   const marker=L.circleMarker([e.lat,e.lon],{radius,color:'#ffb16e',weight:1.5,fillColor:'#ffb16e',fillOpacity:.65}).addTo(layer);
   bounds.push([e.lat,e.lon]);
   const popup=document.createElement('div'),title=document.createElement('b'),date=document.createElement('p'),link=document.createElement('a');
   title.textContent=e.title;date.textContent=fmt(e.date)+' · '+(e.status||'Observed');link.textContent='Original source ↗';link.href=e.url;link.target='_blank';link.rel='noopener noreferrer';popup.append(title,date,link);marker.bindPopup(popup);
   const entry=document.createElement('article');entry.className='entry';
   const tag=document.createElement('span');tag.className='pill';tag.textContent=e.kind.toUpperCase()+' · '+(e.status||'OBSERVED');
   const h=document.createElement('h3'),a=document.createElement('a');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=e.title;h.append(a);
   const note=document.createElement('p');note.textContent=fmt(e.date)+' · '+e.lat.toFixed(2)+'°, '+e.lon.toFixed(2)+'°'+(e.detail?' · '+e.detail:'');
   const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Show on map';
   zoom.addEventListener('click',()=>{map.setView([e.lat,e.lon],Math.max(map.getZoom(),6));marker.openPopup();document.getElementById('map').scrollIntoView({behavior:'smooth',block:'center'});});
   entry.append(tag,h,note,zoom);frag.append(entry);
  }
  const feed=$('feed');feed.classList.remove('empty');feed.replaceChildren();
  if(list.length)feed.append(frag);else{feed.textContent=loadOK?'No sourced observations match these filters.':'Source feed unavailable. Last verified records cannot be loaded.';feed.classList.add('empty');}
  $('count').textContent=String(list.length);$('mapcount').textContent=list.length+' LOCATED EVENTS';
  $('latest').textContent=list.length?fmt(list[0].date):'—';
  $('dashboard-description').textContent=events.length?events.length+' coordinate-backed observation(s) in the downloaded dataset; '+list.length+' match the current view. Filtered views are not global incident counts.':'No records currently available. See source status above.';
 }
 function dashboard(){
  const now=Date.now();$('count30').textContent=events.filter(e=>Date.parse(e.date)>=now-30*86400000).length;
  $('count365').textContent=events.filter(e=>Date.parse(e.date)>=now-365*86400000).length;
  $('event-age').textContent=events.length?age(events[0].date):'—';
  $('source-age').textContent=updatedAt?age(updatedAt):'—';
  const ageMS=updatedAt?now-Date.parse(updatedAt):NaN;
  $('data-health').textContent=!loadOK?'FEED UNAVAILABLE':!events.length?'NO SOURCE RECORDS':!Number.isFinite(ageMS)?'NO TIMESTAMP':ageMS>48*3600000?'STALE DATA':'SOURCE CURRENT';
  renderTimeline();
 }
 async function load(){
  $('status').textContent='CHECKING SOURCE DATA…';
  try{
   const r=await fetch('./data/observations.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();if(!Array.isArray(data.events))throw Error('Invalid data');
   events=data.events.filter(valid).sort((a,b)=>b.date.localeCompare(a.date));updatedAt=data.updated_utc||null;loadOK=true;
   $('updated').textContent=updatedAt?fmt(updatedAt):'—';
   const t=Date.parse(updatedAt);$('status').textContent=!events.length?'NO PUBLISHED OBSERVATIONS':!Number.isFinite(t)||Date.now()-t>48*3600000?'SOURCE SNAPSHOT STALE':'SOURCE SNAPSHOT AVAILABLE';
  }catch(e){loadOK=false;events=[];updatedAt=null;$('status').textContent='SOURCE UNAVAILABLE';$('updated').textContent='—';console.warn('WooRadar feed:',e);}
  dashboard();render();setTimeout(()=>map.invalidateSize(),0);
 }
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=b.dataset.days;document.querySelectorAll('[data-days]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 $('feed-search').addEventListener('input',e=>{search=e.target.value;render();});
 $('reset-map').addEventListener('click',()=>map.setView([17,7],2));
 $('refresh').addEventListener('click',load);
 map.on('zoomend',()=>{const radius=map.getZoom()<=3?3.5:map.getZoom()<=5?5:7;layer.eachLayer(m=>{if(m.setRadius)m.setRadius(radius);});});
 load();
})();
