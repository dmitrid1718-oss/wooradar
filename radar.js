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

 // --- RESEARCH TOOLS: source-backed replay, proximity groups and case details ---
 const rings=L.layerGroup().addTo(map);
 let replayActive=false,replayTimer=null,replayEnd=null,replayStart=null,replayDate=null,showRings=false;
 let inspectedKey=null,hotspotGroups=[];
 const kmDistance=(a,b)=>{
   const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r;
   const q=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;
   return 12742*Math.asin(Math.min(1,Math.sqrt(q)));
 };
 const recordKey=e=>[e.feed,e.url,e.date,e.title].join('||');
 const safeURL=u=>typeof u==='string'&&/^https:\/\//i.test(u)?u:null;
 function filteredBase(){return entries.filter(e=>{
   if(selectedSource!=='all'&&e.feed!==selectedSource)return false;
   if(kind!=='all'&&e.kind!==kind)return false;
   if(days!=='all'&&(!eventDate(e)||eventDate(e)<Date.now()-Number(days)*86400000))return false;
   const q=search.trim().toLowerCase();
   return !q||[e.title,e.date,e.detail,e.status,e.source,String(e.lat??''),String(e.lon??''),e.period].join(' ').toLowerCase().includes(q);
 });}
 function replayCandidates(){
   const now=Date.now(),windowDays=$('replay-period').value;
   return filteredBase().filter(e=>{
     const t=eventDate(e);
     return hasCoords(e)&&t!==null&&t<=now&&(windowDays==='all'||t>=now-Number(windowDays)*86400000);
   });
 }
 function replayBounds(){
   const points=replayCandidates().map(eventDate).sort((a,b)=>a-b);
   const now=Date.now();
   replayStart=points.length?points[0]:null;replayEnd=points.length?points[points.length-1]:null;
   const slider=$('replay-slider');
   slider.disabled=!points.length; $('replay-play').disabled=!points.length;
   if(!points.length){replayActive=false;stopReplay();$('replay-date').textContent='—';$('replay-status').textContent='No dated map records in this window and filter selection.';return;}
   if(replayDate===null||!replayActive||replayDate<replayStart||replayDate>replayEnd)replayDate=replayEnd;
   updateReplayLabel(points.length);
 }
 function updateReplayLabel(total){
   if(replayDate===null)return;
   $('replay-date').textContent=new Date(replayDate).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'});
   $('replay-status').textContent=total+' eligible dated map records · '+(replayActive?'showing events through selected date':'ready to replay');
   $('replay-play').textContent=replayTimer?'Ⅱ Pause':'▶ Play';
 }
 function stopReplay(){
   if(replayTimer!==null)clearInterval(replayTimer);
   replayTimer=null;
   $('replay-play').textContent='▶ Play';
 }
 function replayValue(){
   const v=Number($('replay-slider').value)/100;
   return replayStart+(replayEnd-replayStart)*v;
 }
 function updateReplayFromSlider(){
   if(replayStart===null)return;
   replayActive=true;
   replayDate=replayValue();
   updateReplayLabel(replayCandidates().length);
   render();
 }
 $('replay-slider').addEventListener('input',()=>{stopReplay();updateReplayFromSlider();});
 $('replay-period').addEventListener('change',()=>{stopReplay();replayActive=false;replayDate=null;replayBounds();render();});
 $('replay-reset').addEventListener('click',()=>{stopReplay();replayActive=false;replayDate=null;$('replay-slider').value=100;replayBounds();render();});
 $('replay-play').addEventListener('click',()=>{
   if(replayTimer!==null){stopReplay();updateReplayLabel(replayCandidates().length);return;}
   replayBounds();if(replayStart===null)return;
   replayActive=true;
   if(Number($('replay-slider').value)>=100)$('replay-slider').value=0;
   replayDate=replayValue();
   updateReplayLabel(replayCandidates().length);render();
   replayTimer=setInterval(()=>{
     const slider=$('replay-slider');
     slider.value=Math.min(100,Number(slider.value)+2);
     replayDate=replayValue();updateReplayLabel(replayCandidates().length);render();
     if(Number(slider.value)>=100){stopReplay();updateReplayLabel(replayCandidates().length);}
   },350);
   updateReplayLabel(replayCandidates().length);
 });
 $('hotspot-radius').addEventListener('change',()=>render());
 $('hotspot-toggle').addEventListener('click',()=>{
   showRings=!showRings;
   $('hotspot-toggle').setAttribute('aria-pressed',String(showRings));
   $('hotspot-toggle').textContent='Show rings: '+(showRings?'ON':'OFF');
   renderHotspotRings();
 });
 function computeHotspots(points){
   // Connected proximity groups, not statistical anomaly detection. Exclude duplicate source/url/date/rounded position.
   const unique=[],seen=new Set();
   for(const e of points){
     const key=[e.feed,e.url||e.title,String(e.date||'').slice(0,10),e.lat.toFixed(2),e.lon.toFixed(2)].join('|');
     if(!seen.has(key)){seen.add(key);unique.push(e);}
   }
   const radius=Number($('hotspot-radius').value);
   const parent=unique.map((_,i)=>i);
   const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
   for(let i=0;i<unique.length;i++)for(let j=i+1;j<unique.length;j++){
     if(Math.abs(unique[i].lat-unique[j].lat)>radius/110+0.3)continue;
     if(kmDistance(unique[i],unique[j])<=radius){const a=find(i),b=find(j);if(a!==b)parent[b]=a;}
   }
   const groups=new Map();
   unique.forEach((e,i)=>{const k=find(i);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(e);});
   return [...groups.values()].filter(g=>g.length>=3).map(group=>{
     const lat=group.reduce((sum,e)=>sum+e.lat,0)/group.length;
     const lon=group.reduce((sum,e)=>sum+e.lon,0)/group.length;
     return {group,lat,lon,sources:new Set(group.map(e=>e.feed)).size};
   }).sort((a,b)=>b.group.length-a.group.length).slice(0,12);
 }
 function renderHotspotRings(){
   rings.clearLayers();if(!showRings)return;
   for(const g of hotspotGroups){
     const loc=[g.lat,g.lon],radius=Math.max(Number($('hotspot-radius').value),Math.max(...g.group.map(e=>kmDistance({lat:g.lat,lon:g.lon},e))));
     const ring=L.circle(loc,{radius:radius*1000,color:'#65d6cf',weight:1.5,opacity:.7,fillColor:'#65d6cf',fillOpacity:.055,className:'hotspot-ring'});
     ring.bindTooltip(g.group.length+' nearby reports · '+g.sources+' feeds · descriptive grouping only');
     ring.addTo(rings);
   }
 }
 function updateHotspots(points){
   hotspotGroups=computeHotspots(points);
   const box=$('hotspot-list');box.replaceChildren();
   $('hotspot-status').textContent=hotspotGroups.length?hotspotGroups.length+' report groups in filtered map view':'No groups of 3+ mapped reports in the selected filters.';
   for(const g of hotspotGroups){
     const b=document.createElement('button');b.type='button';b.className='hotspot-item';
     const s=document.createElement('small');
     b.textContent=g.group.length+' reports · '+g.sources+' source'+(g.sources===1?'':'s');
     s.textContent=g.lat.toFixed(2)+'°, '+g.lon.toFixed(2)+'° · within '+$('hotspot-radius').value+' km links';
     b.append(s);
     b.addEventListener('click',()=>{map.setView([g.lat,g.lon],6);$('map').scrollIntoView({behavior:'smooth',block:'center'});});
     box.append(b);
   }
   renderHotspotRings();
 }
 function inspectCase(e,scroll=true){
   inspectedKey=recordKey(e);
   const title=$('case-title'),summary=$('case-summary'),details=$('case-details');
   title.textContent=e.title;
   summary.textContent='Source-backed report inspection · '+(names[e.feed]||e.source||'Unspecified source');
   details.hidden=false;details.replaceChildren();
   const grid=document.createElement('div');grid.className='case-grid';
   const values=[
     ['Event date',formatted(e.date)],['Source',e.source||names[e.feed]||'Not specified'],
     ['Category',e.kind||'Not specified'],['Status',e.status||'No verification status supplied'],
     ['Coordinates',hasCoords(e)?e.lat.toFixed(4)+'°, '+e.lon.toFixed(4)+'°':'Not geolocated'],
     ['Location precision',hasCoords(e)?(e.kind==='fireball'?'Approximate atmospheric peak, not ground impact':e.kind==='report'?'May be city-level; accuracy unspecified':'Precision not independently validated'):'No map point available']
   ];
   for(const [label,value] of values){const cell=document.createElement('div');cell.className='case-fact';const b=document.createElement('b');b.textContent=label;cell.append(b,document.createTextNode(String(value)));grid.append(cell);}
   details.append(grid);
   if(e.detail){const p=document.createElement('p');p.className='case-detail';p.textContent=e.detail;details.append(p);}
   const caveat=document.createElement('p');caveat.className='case-detail';
   caveat.textContent=e.kind==='fireball'?'NASA/JPL bolide observations indicate a bright atmospheric event. Coordinates refer to approximate peak brightness, not an impact site.':
     e.kind==='report'||e.kind==='uap'?'A record of a report or investigation is not independent verification of the claimed phenomenon. Consider aircraft, satellites, atmospheric effects, timestamps and reporting quality where applicable.':
     'The source record documents an observation, publication, or event. It does not establish a causal connection to other reports.';
   details.append(caveat);
   const url=safeURL(e.url);if(url){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='Examine original source ↗';details.append(a);}
   if(hasCoords(e)){const btn=document.createElement('button');btn.type='button';btn.className='case-link';btn.textContent='Locate on map';btn.addEventListener('click',()=>{map.setView([e.lat,e.lon],7);$('map').scrollIntoView({behavior:'smooth',block:'center'});});details.append(document.createElement('br'),btn);}
   if(scroll)$('case-detective').scrollIntoView({behavior:'smooth',block:'start'});
 }

 function render(){
   const list=visible().filter(e=>!replayActive||!hasCoords(e)||eventDate(e)!==null&&eventDate(e)<=replayDate).sort((a,b)=>(eventDate(b)||0)-(eventDate(a)||0));
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
       const inspect=document.createElement('button');inspect.type='button';inspect.textContent='Inspect case';inspect.style.display='block';inspect.style.marginTop='8px';inspect.addEventListener('click',()=>inspectCase(e));popup.append(title,date,link,inspect);marker.bindPopup(popup);
     }
     if(shown>=140)continue;
     shown++;
     const card=document.createElement('article');card.className='entry';
     const tag=document.createElement('span');tag.className='pill';tag.textContent=(e.kind==='research'?'RESEARCH':e.kind==='document'?'DOCUMENT':e.kind==='spaceweather'?'SPACE WEATHER':e.kind==='report'?'WITNESS REPORT':e.kind.toUpperCase())+' · '+(names[e.feed]||e.source||'SOURCE');
     const h=document.createElement('h3'),link=document.createElement('a');link.href=e.url;link.rel='noopener noreferrer';link.target='_blank';link.textContent=e.title;h.append(link);
     const p=document.createElement('p');p.textContent=formatted(e.date)+(e.detail?' · '+e.detail:'')+(hasCoords(e)?' · '+e.lat.toFixed(2)+'°, '+e.lon.toFixed(2)+'°':' · Not mapped');
     const inspectButton=document.createElement('button');inspectButton.type='button';inspectButton.textContent='Inspect case';inspectButton.addEventListener('click',()=>inspectCase(e));card.append(tag,h,p,inspectButton);
     if(marker){const zoom=document.createElement('button');zoom.textContent='Show on map';zoom.type='button';zoom.addEventListener('click',()=>{map.setView([e.lat,e.lon],Math.max(map.getZoom(),6));marker.openPopup();$('map').scrollIntoView({behavior:'smooth',block:'center'});});card.append(zoom);}
     fragment.append(card);
   }
   const feed=$('feed');feed.replaceChildren();feed.classList.remove('empty');
   if(list.length){feed.append(fragment);if(list.length>shown){const more=document.createElement('div');more.className='empty';more.textContent='Showing newest '+shown+' of '+list.length+' filtered records. Narrow the date, source or search to inspect older records.';feed.append(more);}}else{feed.classList.add('empty');feed.textContent=loadOK?'No source records match these filters. Try all dates or another category.':'Source data unavailable.';}
   updateHotspots(pinned);
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
   entries.sort((a,b)=>(eventDate(b)||0)-(eventDate(a)||0));health();stopReplay();replayActive=false;replayDate=null;$('replay-slider').value=100;replayBounds();render();setTimeout(()=>map.invalidateSize(),0);
 }
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;stopReplay();replayActive=false;replayDate=null;document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));replayBounds();render();}));
 document.querySelectorAll('[data-source]').forEach(b=>b.addEventListener('click',()=>{selectedSource=b.dataset.source;stopReplay();replayActive=false;replayDate=null;document.querySelectorAll('[data-source]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));replayBounds();render();}));
 document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=b.dataset.days;stopReplay();replayActive=false;replayDate=null;document.querySelectorAll('[data-days]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));replayBounds();render();}));
 $('feed-search').addEventListener('input',e=>{search=e.target.value;stopReplay();replayActive=false;replayDate=null;replayBounds();render();});
 $('reset-map').addEventListener('click',()=>map.setView([17,7],2));
 $('refresh').addEventListener('click',load);
 map.on('zoomend',()=>{const radius=map.getZoom()<=3?3.5:map.getZoom()<=5?5:7;layer.eachLayer(m=>{if(m.setRadius)m.setRadius(radius);});});
 load();
})();
