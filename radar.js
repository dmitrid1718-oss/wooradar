'use strict';
(() => {
 const $=id=>document.getElementById(id);
 const map=L.map('map',{worldCopyJump:true,zoomControl:true,preferCanvas:true}).setView([17,7],2);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',maxZoom:18}).addTo(map);
 const layer=L.layerGroup().addTo(map);
 // Persist a local, high-contrast black basemap without changing the tile provider.
 // Set black as the initial mode for first-time visitors.
 const themeButton=$('map-theme');
 let blackMap=true;
 try{const saved=localStorage.getItem('wooradar-map-theme');if(saved==='normal')blackMap=false;}catch(_){}
 function setMapTheme(isBlack){
   blackMap=!!isBlack;
   document.body.classList.toggle('black-map',blackMap);
   themeButton.setAttribute('aria-pressed',String(blackMap));
   themeButton.textContent=blackMap?'Black map: ON':'Black map: OFF';
   try{localStorage.setItem('wooradar-map-theme',blackMap?'black':'normal');}catch(_){}
 }
 themeButton.addEventListener('click',()=>setMapTheme(!blackMap));
 setMapTheme(blackMap);

 const colors={fireball:'#ffb16e',uap:'#80cdf8',report:'#d69bfa',other:'#9bb0bb'};
 const names={jpl:'NASA/JPL Fireballs',geipan:'GEIPAN / CNES',nuforc:'NUFORC / UAP Atlas',noaa:'NOAA SWPC Kp',donki:'NASA DONKI',official_uap:'UAP Records Archive',arxiv:'arXiv research',crossref:'Crossref research'};
 let entries=[],selectedSource='all',kind='all',days='all',search='',sources={},loadOK=false,updatedAt=null;
 const formatted=d=>{let t=Date.parse(d);return Number.isFinite(t)?new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'Date not specified';};
 const age=d=>{const t=Date.parse(d),n=Date.now()-t;if(!Number.isFinite(n))return '—';if(n<3600000)return '< 1h';if(n<48*3600000)return Math.floor(n/3600000)+'h';return Math.floor(n/86400000)+'d';};
 const hasCoords=e=>Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&Math.abs(e.lat)<=90&&Math.abs(e.lon)<=180;
 const valid=e=>e&&typeof e.title==='string'&&typeof e.url==='string'&&/^https:\/\//.test(e.url)&&typeof e.kind==='string';
 const eventDate=e=>Number.isFinite(Date.parse(e.date))?Date.parse(e.date):null;
 const visible=()=>entries.filter(e=>{
   if(selectedSource!=='all'&&e.feed!==selectedSource)return false;
   if(kind!=='all'&&e.kind!==kind)return false;
   if(days!=='all'&&(!eventDate(e)||eventDate(e)<Date.now()-Number(days)*86400000))return false;
   const q=search.trim().toLowerCase();
   return !q||[e.title,e.date,e.detail,e.status,e.source,String(e.lat??''),String(e.lon??''),e.period].join(' ').toLowerCase().includes(q);
 });
 function timeline(){
   const box=$('timeline');box.replaceChildren();
   const now=new Date(),bins=[];
   for(let i=11;i>=0;i--){const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));bins.push({key:d.toISOString().slice(0,7),label:d.toLocaleDateString('en-US',{month:'short',timeZone:'UTC'}),count:0});}
   const active=entries.filter(e=>selectedSource==='all'||e.feed===selectedSource).filter(e=>kind==='all'||e.kind===kind);
   for(const e of active){const bin=bins.find(b=>b.key===String(e.date||'').slice(0,7));if(bin)bin.count++;}
   const peak=Math.max(1,...bins.map(b=>b.count));
   bins.forEach(b=>{const el=document.createElement('div'),bar=document.createElement('div'),span=document.createElement('span');
     el.className='timeline-col';bar.className='bar';bar.style.height=Math.max(2,Math.round(b.count/peak*90))+'%';span.textContent=b.label;el.title=b.key+': '+b.count+' reports';el.append(bar,span);box.append(el);});
 }
 function health(){
   const container=$('source-status-list');container.replaceChildren();
   for(const key of ['jpl','geipan','nuforc','noaa','donki','official_uap','arxiv','crossref']){
     const d=sources[key]||{state:'unavailable',items:[]};
     const item=document.createElement('div'),name=document.createElement('strong'),status=document.createElement('span'),detail=document.createElement('span');
     item.className='source-item';name.textContent=names[key];status.className=d.state==='ok'?'ok':d.state==='stale'?'stale':'unavailable';
     status.textContent=(d.state==='ok'?'ACTIVE':d.state==='stale'?'STALE':'UNAVAILABLE')+' · '+(d.items||[]).length+' records';
     detail.textContent=d.updated_utc?'Updated '+age(d.updated_utc)+' ago':'No successful snapshot';
     item.append(name,status,document.createElement('br'),detail);container.append(item);
   }
 }
 function render(){
   const list=visible().sort((a,b)=>(eventDate(b)||0)-(eventDate(a)||0));
   const pinned=list.filter(hasCoords);
   layer.clearLayers();
   const fragment=document.createDocumentFragment(),radius=map.getZoom()<=3?3.5:map.getZoom()<=5?5:7;
   let shown=0;
   for(const e of list){
     let marker=null;
     if(hasCoords(e)){
       const color=colors[e.kind]||colors.other;
       marker=L.circleMarker([e.lat,e.lon],{radius,color,weight:1.6,fillColor:color,fillOpacity:.65}).addTo(layer);
       const popup=document.createElement('div'),title=document.createElement('b'),date=document.createElement('p'),link=document.createElement('a');
       title.textContent=e.title;date.textContent=formatted(e.date)+' · '+(e.source||names[e.feed]||'Source');
       link.href=e.url;link.textContent='Examine source ↗';link.target='_blank';link.rel='noopener noreferrer';
       popup.append(title,date,link);marker.bindPopup(popup);
     }
     if(shown>=140)continue;
     shown++;
     const card=document.createElement('article');card.className='entry';
     const tag=document.createElement('span');tag.className='pill';tag.textContent=(e.kind==='research'?'RESEARCH':e.kind==='document'?'DOCUMENT':e.kind==='spaceweather'?'SPACE WEATHER':e.kind==='report'?'WITNESS REPORT':e.kind.toUpperCase())+' · '+(names[e.feed]||e.source||'SOURCE');
     const h=document.createElement('h3'),link=document.createElement('a');link.href=e.url;link.rel='noopener noreferrer';link.target='_blank';link.textContent=e.title;h.append(link);
     const p=document.createElement('p');p.textContent=formatted(e.date)+(e.detail?' · '+e.detail:'')+(hasCoords(e)?' · '+e.lat.toFixed(2)+'°, '+e.lon.toFixed(2)+'°':' · Not mapped');
     card.append(tag,h,p);
     if(marker){const zoom=document.createElement('button');zoom.textContent='Show on map';zoom.type='button';zoom.addEventListener('click',()=>{map.setView([e.lat,e.lon],Math.max(map.getZoom(),6));marker.openPopup();$('map').scrollIntoView({behavior:'smooth',block:'center'});});card.append(zoom);}
     fragment.append(card);
   }
   const feed=$('feed');feed.replaceChildren();feed.classList.remove('empty');
   if(list.length){feed.append(fragment);if(list.length>shown){const more=document.createElement('div');more.className='empty';more.textContent='Showing newest '+shown+' of '+list.length+' filtered records. Narrow the date, source or search to inspect older records.';feed.append(more);}}else{feed.classList.add('empty');feed.textContent=loadOK?'No source records match these filters. Try all dates or another category.':'Source data unavailable.';}
   $('count').textContent=String(pinned.length);$('mapcount').textContent=pinned.length+' MAP PINS · '+list.length+' FEED RECORDS';
   const mostRecent=list.find(e=>eventDate(e));$('latest').textContent=mostRecent?formatted(mostRecent.date):'—';
   const all=entries.filter(e=>selectedSource==='all'||e.feed===selectedSource).filter(e=>kind==='all'||e.kind===kind);
   const thirty=all.filter(e=>eventDate(e)&&eventDate(e)>=Date.now()-30*86400000).length;
   const year=all.filter(e=>eventDate(e)&&eventDate(e)>=Date.now()-365*86400000).length;
   $('count30').textContent=thirty;$('count365').textContent=year;
   $('event-age').textContent=mostRecent?age(mostRecent.date):'—';
   $('dashboard-description').textContent=pinned.length+' geolocated pins and '+list.length+' feed entries match the filters. Unmapped research, documents and space-weather conditions appear in the feed only. Counts reflect available reports, not the true incidence of unexplained events.';
   timeline();
 }
 async function fetchJSON(url){const r=await fetch(url+'?refresh='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
 async function load(){
   $('status').textContent='CHECKING SOURCES…';
   const [baseResult,extraResult]=await Promise.allSettled([fetchJSON('./data/observations.json'),fetchJSON('./data/extras.json')]);
   entries=[];sources={};updatedAt=null;loadOK=false;
   if(baseResult.status==='fulfilled'&&Array.isArray(baseResult.value.events)){
     const d=baseResult.value;const items=d.events.filter(valid).map(e=>({...e,feed:'jpl'}));
     sources.jpl={items,state:items.length?'ok':'unavailable',updated_utc:d.updated_utc};
     entries.push(...items);updatedAt=d.updated_utc;loadOK=true;
   }else sources.jpl={state:'unavailable',items:[]};
   if(extraResult.status==='fulfilled'&&extraResult.value.sources&&typeof extraResult.value.sources==='object'){
     Object.entries(extraResult.value.sources).forEach(([key,value])=>{
       const items=Array.isArray(value.items)?value.items.filter(valid).map(e=>({...e,feed:key})):[];
       sources[key]={state:value.state==='ok'?'ok':items.length?'stale':'unavailable',updated_utc:value.updated_utc,items};
       entries.push(...items);
     });
     loadOK=true;
   }
   const snapshots=Object.values(sources).map(x=>Date.parse(x.updated_utc)).filter(Number.isFinite);
   const recent=snapshots.length?Math.max(...snapshots):NaN;
   $('source-age').textContent=Number.isFinite(recent)?age(new Date(recent).toISOString()):'—';
   $('updated').textContent=Number.isFinite(recent)?formatted(new Date(recent).toISOString()):'—';
   $('data-health').textContent=!loadOK?'FEEDS UNAVAILABLE':!Number.isFinite(recent)?'NO SUCCESSFUL REFRESH':Date.now()-recent>48*3600000?'SOME DATA MAY BE STALE':'SOURCE SNAPSHOTS LOADED';
   $('status').textContent=!loadOK?'SOURCES UNAVAILABLE':entries.length?'SOURCE RECORDS LOADED':'AWAITING SOURCE DATA';
   entries.sort((a,b)=>(eventDate(b)||0)-(eventDate(a)||0));health();render();setTimeout(()=>map.invalidateSize(),0);
 }
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 document.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>{selectedSource=b.dataset.source;document.querySelectorAll('[data-source]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=b.dataset.days;document.querySelectorAll('[data-days]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 $('feed-search').addEventListener('input',e=>{search=e.target.value;render();});
 $('reset-map').addEventListener('click',()=>map.setView([17,7],2));
 $('refresh').addEventListener('click',load);
 map.on('zoomend',()=>{const radius=map.getZoom()<=3?3.5:map.getZoom()<=5?5:7;layer.eachLayer(m=>{if(m.setRadius)m.setRadius(radius);});});
 load();
})();
