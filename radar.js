'use strict';
(() => {
 const $=id=>document.getElementById(id), map=L.map('map',{worldCopyJump:true,zoomControl:true}).setView([18,8],2);
 L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap contributors &copy; CARTO',maxZoom:18,subdomains:'abcd'}).addTo(map);
 const layer=L.layerGroup().addTo(map); let events=[],kind='all',days='all';
 const fmt=d=>new Date(d).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
 const valid=e=>e&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&Math.abs(e.lat)<=90&&Math.abs(e.lon)<=180&&typeof e.date==='string'&&typeof e.url==='string'&&/^https:\/\//.test(e.url);
 function render(){
  const cutoff=days==='all'?0:Date.now()-Number(days)*86400000;
  const list=events.filter(e=>(kind==='all'||e.kind===kind)&&(!cutoff||Date.parse(e.date)>=cutoff));
  layer.clearLayers();
  const frag=document.createDocumentFragment();
  for(const e of list){
   const marker=L.circleMarker([e.lat,e.lon],{radius:6,color:'#ffb16e',weight:2,fillColor:'#ffb16e',fillOpacity:.55}).addTo(layer);
   const popup=document.createElement('div'),title=document.createElement('b'),date=document.createElement('p'),link=document.createElement('a');
   title.textContent=e.title; date.textContent=fmt(e.date)+' · '+(e.status||'Observed');
   link.textContent='Original source ↗';link.href=e.url;link.target='_blank';link.rel='noopener noreferrer';popup.append(title,date,link);
   marker.bindPopup(popup);
   const entry=document.createElement('article');entry.className='entry';
   const tag=document.createElement('span');tag.className='pill';tag.textContent=e.kind.toUpperCase()+' · '+(e.status||'OBSERVED');
   const h=document.createElement('h3'),a=document.createElement('a');a.href=e.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=e.title;h.append(a);
   const note=document.createElement('p');note.textContent=fmt(e.date)+' · '+e.lat.toFixed(2)+'°, '+e.lon.toFixed(2)+'°'+(e.detail?' · '+e.detail:'');
   const zoom=document.createElement('button');zoom.type='button';zoom.textContent='Show on map';zoom.addEventListener('click',()=>{map.setView([e.lat,e.lon],Math.max(map.getZoom(),5));marker.openPopup();});
   entry.append(tag,h,note,zoom);frag.append(entry);
  }
  $('feed').replaceChildren();if(list.length)$('feed').append(frag);else{$('feed').textContent='No sourced observations match these filters.';$('feed').classList.add('empty');}
  $('count').textContent=String(list.length);$('mapcount').textContent=list.length+' LOCATED EVENTS';$('latest').textContent=list.length?fmt(list[0].date):'—';
 }
 async function load(){
  $('status').textContent='CHECKING SOURCE DATA…';
  try{
   const r=await fetch('./data/observations.json?ts='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();if(!Array.isArray(data.events))throw Error('Invalid data');
   events=data.events.filter(valid).sort((a,b)=>b.date.localeCompare(a.date));
   $('updated').textContent=data.updated_utc?fmt(data.updated_utc):'—';
   const age=Date.now()-Date.parse(data.updated_utc);$('status').textContent=!events.length?'NO PUBLISHED OBSERVATIONS':age>48*3600000?'SOURCE SNAPSHOT STALE':'SOURCE SNAPSHOT AVAILABLE';
   render();
  }catch(e){events=[];$('status').textContent='SOURCE UNAVAILABLE';$('updated').textContent='—';render();console.warn('WooRadar feed:',e);}
 }
 document.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{kind=b.dataset.kind;document.querySelectorAll('[data-kind]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 document.querySelectorAll('[data-days]').forEach(b=>b.addEventListener('click',()=>{days=b.dataset.days;document.querySelectorAll('[data-days]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();}));
 $('refresh').addEventListener('click',load);load();
})();