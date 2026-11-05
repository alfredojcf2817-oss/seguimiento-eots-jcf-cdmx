/* V16.8.21 — Visitas Territoriales: interfaz y cola local secuencial */
(()=>{'use strict';
const $=id=>document.getElementById(id);let visits=[],current=null,syncing=false,mapInstance=null,mapLoading=null,offlineMode=false,visitGps=null,visitGpsSeq=0;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('EOTS_VISITAS_V168',1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('envios'))d.createObjectStore('envios',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
async function store(mode,fn){const d=await db();return new Promise((res,rej)=>{const t=d.transaction('envios',mode),o=t.objectStore('envios');let req;try{req=fn(o)}catch(e){d.close();rej(e);return}req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error);t.oncomplete=()=>d.close()})}
const all=()=>store('readonly',o=>o.getAll());const put=v=>store('readwrite',o=>o.put(v));const del=id=>store('readwrite',o=>o.delete(id));
const call=(method,...args)=>new Promise(resolve=>{let finished=false;const timer=setTimeout(()=>finish({ok:false,mensaje:'Tiempo de espera agotado. Comprueba la conexión.'}),25000);function finish(result){if(finished)return;finished=true;clearTimeout(timer);resolve(result)}try{google.script.run.withSuccessHandler(finish).withFailureHandler(e=>finish({ok:false,mensaje:e.message||String(e)}))[method](TOKEN,...args)}catch(e){finish({ok:false,mensaje:String(e)})}});
const cacheKey=()=>USUARIO&&USUARIO.curp?'EOTS_VISITAS_CACHE_'+USUARIO.curp:'';
const isDone=v=>String(v.estatus||'').trim().toLowerCase()==='realizada';
const dateString=d=>{if(!d)return '';const dt=new Date(d);return Number.isNaN(dt.getTime())?String(d):dt.toLocaleString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})};
function saveCache(){try{if(cacheKey())localStorage.setItem(cacheKey(),JSON.stringify(visits))}catch(e){status('No se pudo actualizar el respaldo local.')}}
function offlineBanner(){return '<div class="v168-panel" style="background:#f6f1f2;margin-bottom:12px"><strong>'+ (offlineMode?'Modo offline: solo Visitas territoriales':'Modo online') +'</strong><p class="v168-meta">'+(offlineMode?'Las visitas y fotografías se guardan en este dispositivo. Para sincronizar, vuelve al modo online.':'Puedes consultar nuevas asignaciones y sincronizar visitas.')+'</p><div class="v168-toolbar"><button type="button" id="v168ModeToggle">'+(offlineMode?'Activar modo online':'Activar modo offline')+'</button></div></div>'}
function bindMode(){const b=$('v168ModeToggle');if(b)b.onclick=()=>offlineMode?goOnline():enableOffline()}
function onlineLogin(){offlineMode=false;localStorage.removeItem('EOTS_VISITAS_OFFLINE_MODE');document.body.classList.remove('eots-visits-offline');if(typeof cerrarSesionLocal==='function')cerrarSesionLocal()}
function enableOffline(){if(!USUARIO||!cacheKey())return status('Inicia sesión y descarga tus visitas antes de activar el modo offline.');offlineMode=true;localStorage.setItem('EOTS_VISITAS_OFFLINE_MODE','1');document.body.classList.add('eots-visits-offline');if(typeof v164StopGuard==='function')v164StopGuard();local();}
async function goOnline(){if(!navigator.onLine){status('Sin conexión. Mantendremos tus visitas disponibles.');return}if(!TOKEN){status('Para actualizar asignaciones es necesario iniciar sesión con Internet.');return}status('Verificando sesión y nuevas asignaciones…');const auth=await call('validarSesion');if(!auth.ok){status('La sesión del servidor venció. Tus visitas locales están protegidas.');const b=$('v168ModeToggle');if(b){b.textContent='Iniciar sesión para sincronizar';b.onclick=onlineLogin}return}const r=await call('v168VisitList');if(!r.ok){status('No se pudieron consultar asignaciones: '+r.mensaje);return}const incoming=Array.isArray(r.visitas)?r.visitas:[];const existing=new Set(visits.map(v=>String(v.folio)));const fresh=incoming.filter(v=>!existing.has(String(v.folio)));let accept=true;if(fresh.length)accept=confirm('Se te han asignado '+fresh.length+' visita(s) nueva(s). ¿Quieres descargar la información?');if(accept){visits=incoming;saveCache()}else{const byFolio=new Map(incoming.map(v=>[String(v.folio),v]));visits=visits.map(v=>byFolio.get(String(v.folio))||v);saveCache()}offlineMode=false;localStorage.removeItem('EOTS_VISITAS_OFFLINE_MODE');document.body.classList.remove('eots-visits-offline');if(typeof v164StartGuard==='function')v164StartGuard();render();status(fresh.length?(accept?'Se descargaron '+fresh.length+' visitas nuevas.':'Las visitas nuevas no se descargaron.'):'Sin asignaciones nuevas.');await sync();}
function restoreOffline(){if(!USUARIO||!cacheKey())return false;try{const rows=JSON.parse(localStorage.getItem(cacheKey())||'null');if(!Array.isArray(rows))return false}catch(e){return false}offlineMode=true;localStorage.setItem('EOTS_VISITAS_OFFLINE_MODE','1');document.body.classList.add('eots-visits-offline');if(typeof v164StopGuard==='function')v164StopGuard();if(typeof mostrarApp==='function')mostrarApp();setTimeout(()=>{show();local()},0);return true}

function status(s){const el=$('v168Status');if(el)el.textContent=s}
function panel(html){clearMap();$('v168Area').innerHTML=html}
function show(btn){if(!USUARIO){alert('Debes iniciar sesión');return}const section=$('v168Visitas');if(!section||!section.closest('#appView .content')){alert('La sección Visitas no está integrada al contenedor del sistema.');return}abrirModulo('v168Visitas',btn||$('btnV168Visitas'));window.scrollTo({top:0,behavior:'instant'});if(offlineMode||!navigator.onLine)local();else load()}
async function load(){if(offlineMode||!navigator.onLine){local();return}panel('<div class="v168-panel">Consultando visitas asignadas…</div>');const r=await call('v168VisitList');if(!r.ok){status('No se pudo actualizar: '+r.mensaje);local();return}visits=Array.isArray(r.visitas)?r.visitas:[];saveCache();try{render()}catch(e){console.error('Visitas: error al dibujar interfaz',e);panel('<div class="v168-panel">No se pudo mostrar el listado: '+escape(e.message)+'<div class="v168-toolbar"><button id="v168Retry">Reintentar</button></div></div>');$('v168Retry').onclick=load}}
function local(){try{visits=JSON.parse(localStorage.getItem(cacheKey())||'[]')}catch(e){visits=[]}render()}
// Coordenadas oficiales de la hoja Visitas: G (latitud), H (longitud).
function coord(value,min,max){const n=Number(String(value??'').trim().replace(',','.'));return Number.isFinite(n)&&n>=min&&n<=max&&String(value??'').trim()!==''?n:null}
function locationOf(v){const lat=coord(v.lat,-90,90),lng=coord(v.lng,-180,180);return lat!==null&&lng!==null&&!(lat===0&&lng===0)?[lat,lng]:null}
function mapsUrl(v){const pos=locationOf(v);const target=pos?pos.join(','):String(v.direccion||'').trim();return target?'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(target)+'&travelmode=walking':''}
function clearMap(){if(mapInstance){mapInstance.remove();mapInstance=null}}
function leafletReady(){if(window.L)return Promise.resolve();if(mapLoading)return mapLoading;mapLoading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoUqMMzCKvR8=';css.crossOrigin='anonymous';document.head.append(css);const js=document.createElement('script');js.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';js.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';js.crossOrigin='anonymous';js.onload=()=>resolve();js.onerror=()=>reject(Error('No se pudo cargar el mapa. Comprueba tu conexión a internet.'));document.head.append(js)}).catch(e=>{mapLoading=null;throw e});return mapLoading}
async function showMap(){
  clearMap();
  const host=$('v168Area');if(!host)return;
  const valid=visits.map((v,i)=>({v,i,pos:locationOf(v)})).filter(x=>x.pos);
  host.innerHTML=tabs('map')+'<div class="v168-toolbar"><button id="v168BackList" type="button">Volver al listado</button><button class="v168-secondary" id="v168MapReload" type="button">Actualizar visitas</button><button id="v168LocateMe" type="button">Mostrar mi ubicación</button></div><div class="v168-panel"><h3 class="v168-section-title">Mapa de visitas asignadas</h3><p class="v168-meta">Marcadores de las visitas de tu sesión. Verde: realizada · Vino: pendiente.</p><div id="v168MapFrameHost"></div><p id="v168MapNotice" class="v168-meta"></p></div>';
  bindTabs();$('v168BackList').onclick=render;$('v168MapReload').onclick=load;
  const notice=$('v168MapNotice');
  if(!valid.length){notice.textContent='No hay coordenadas válidas en las columnas G y H de la hoja Visitas.';return}
  notice.textContent=valid.length+' ubicaciones disponibles de '+visits.length+' visitas.';
  if(!navigator.onLine){notice.textContent+=' Se requiere conexión para visualizar el mapa base.';return}
  // MapLibre GL JS renderiza mapas vectoriales en WebGL. OpenFreeMap aporta
  // un estilo vectorial basado en datos OSM, sin clave API. Servicio externo.
  // El iframe evita conflictos con el CSS del sistema institucional.
  const iframe=document.createElement('iframe');
  iframe.title='Mapa vectorial de visitas territoriales';iframe.setAttribute('loading','eager');
  iframe.setAttribute('sandbox','allow-scripts allow-popups allow-popups-to-escape-sandbox');
  iframe.style.cssText='display:block;width:100%;height:clamp(360px,65vh,680px);border:0;border-radius:12px;background:#f1f1f1';
  const data=valid.map(({v,i,pos})=>({i,lat:pos[0],lng:pos[1],nombre:String(v.sucursal||'Centro de trabajo'),direccion:String(v.direccion||''),estatus:String(v.estatus||'Pendiente'),orden:String(v.orden||''),url:mapsUrl(v)}));
  const encoded=JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"><style>html,body,#map{margin:0;width:100%;height:100%;overflow:hidden}body{font:14px system-ui,Arial,sans-serif}#error{position:absolute;inset:12px;display:none;background:#fff;padding:16px;border-radius:8px;z-index:9999;box-sizing:border-box}.maplibregl-popup-content{max-width:270px;line-height:1.5}.maplibregl-popup-content button{display:block;margin-top:9px;background:#691b31;color:#fff;border:0;border-radius:6px;padding:8px;cursor:pointer}.maplibregl-popup-content a{color:#691b31;display:block;margin-top:8px}.maplibregl-control-container{font-size:12px}</style></head><body><div id="map"></div><div id="error"></div><script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"><\/script><script>
  const visits=${encoded};
  function fail(message){const el=document.getElementById('error');el.textContent=message+' Puedes utilizar los enlaces de Google Maps desde el listado.';el.style.display='block'}
  try{
    if(!window.maplibregl)throw Error('No se pudo cargar MapLibre. Comprueba tu conexión.');
    // MapLibre GL JS v4 no expone maplibregl.supported(); el constructor valida WebGL.
    const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/liberty',center:[-99.1332,19.4326],zoom:10,attributionControl:true});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-left');
    map.scrollZoom.disable();
    let mapReady=false;
    map.on('load',()=>{mapReady=true;map.resize()});
    map.on('error',e=>{if(!mapReady)console.warn('Mapa vectorial: recurso no disponible',e.error||e)});
    let userMarker=null, accuracyCircle=null;
    window.addEventListener('message',event=>{
      if(event.source!==parent || !event.data || event.data.type!=='EOTS_V168_USER_LOCATION')return;
      const {lat,lng,accuracy}=event.data;
      if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
      if(!userMarker){
        const dot=document.createElement('div');dot.title='Mi ubicación actual';
        dot.style.cssText='width:19px;height:19px;border-radius:50%;background:#2379df;border:3px solid #fff;box-shadow:0 0 0 3px #2379df55,0 2px 9px #0005;box-sizing:border-box';
        userMarker=new maplibregl.Marker({element:dot,anchor:'center'}).setLngLat([lng,lat]).setPopup(new maplibregl.Popup({offset:15}).setText('Mi ubicación actual (aproximada)')).addTo(map);
      }else userMarker.setLngLat([lng,lat]);
      if(Number.isFinite(accuracy)&&accuracy>0){
        const steps=48,coords=[],R=6378137,rad=Math.PI/180;
        for(let i=0;i<=steps;i++){const a=2*Math.PI*i/steps;coords.push([lng+(accuracy*Math.cos(a))/(R*Math.cos(lat*rad))*180/Math.PI,lat+(accuracy*Math.sin(a))/R*180/Math.PI])}
        const circle={type:'Feature',geometry:{type:'Polygon',coordinates:[coords]},properties:{}};
        if(map.getSource('user-accuracy'))map.getSource('user-accuracy').setData(circle);
        else map.once('load',()=>{if(!map.getSource('user-accuracy')){map.addSource('user-accuracy',{type:'geojson',data:circle});map.addLayer({id:'user-accuracy-fill',type:'fill',source:'user-accuracy',paint:{'fill-color':'#2379df','fill-opacity':0.12}});map.addLayer({id:'user-accuracy-outline',type:'line',source:'user-accuracy',paint:{'line-color':'#2379df','line-opacity':0.35,'line-width':1}})}});
      }
      map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),14),duration:600});
    });
    parent.postMessage({type:'EOTS_V168_MAP_READY'},'*');
    const bounds=new maplibregl.LngLatBounds();
    visits.forEach(v=>{
      const done=v.estatus.trim().toLowerCase()==='realizada';
      const dot=document.createElement('div');dot.style.cssText='width:20px;height:20px;border-radius:50%;border:3px solid '+(done?'#46714a':'#691b31')+';background:'+(done?'#838e5d':'#9d2449')+';box-shadow:0 2px 5px #0005;cursor:pointer;box-sizing:border-box';
      const content=document.createElement('div');const title=document.createElement('strong');title.textContent=(v.orden?'#'+v.orden+' · ':'')+v.nombre;content.append(title);
      const detail=document.createElement('p');detail.textContent=v.direccion+' · '+v.estatus;content.append(detail);
      if(v.url){const link=document.createElement('a');link.href=v.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Cómo llegar en Google Maps';content.append(link)}
      if(!done){const button=document.createElement('button');button.type='button';button.textContent='Realizar cuestionario';button.onclick=()=>parent.postMessage({type:'EOTS_V168_OPEN_VISIT',index:v.i},'*');content.append(button)}
      new maplibregl.Marker({element:dot,anchor:'center'}).setLngLat([v.lng,v.lat]).setPopup(new maplibregl.Popup({offset:16}).setDOMContent(content)).addTo(map);
      bounds.extend([v.lng,v.lat]);
    });
    if(visits.length===1)map.setCenter([visits[0].lng,visits[0].lat]),map.setZoom(15);
    else map.fitBounds(bounds,{padding:45,maxZoom:15,duration:0});
    new ResizeObserver(()=>map.resize()).observe(document.getElementById('map'));
  }catch(err){fail('Mapa no disponible: '+err.message)}
  <\/script></body></html>`;
  iframe.srcdoc=html;
  let watchId=null,lastPosition=null,frameReady=false;
  const locate=$('v168LocateMe');
  const publishPosition=()=>{if(frameReady&&lastPosition&&iframe.contentWindow)iframe.contentWindow.postMessage({type:'EOTS_V168_USER_LOCATION',...lastPosition},'*')};
  locate.onclick=()=>{
    if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;locate.textContent='Mostrar mi ubicación';notice.textContent='Ubicación en tiempo real detenida.';return}
    if(!navigator.geolocation){notice.textContent='Tu navegador no admite geolocalización.';return}
    locate.disabled=true;notice.textContent='Solicitando permiso para mostrar tu ubicación…';
    let first=true;
    watchId=navigator.geolocation.watchPosition(p=>{
      lastPosition={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
      publishPosition();locate.disabled=false;locate.textContent='Detener seguimiento de ubicación';
      notice.textContent='Punto azul: tu ubicación actual · Precisión aproximada: '+Math.round(p.coords.accuracy)+' m.';
      first=false;
    },err=>{
      locate.disabled=false;locate.textContent='Mostrar mi ubicación';
      notice.textContent='No se pudo obtener tu ubicación: '+(err.code===1?'permiso denegado':err.code===2?'posición no disponible':'tiempo de espera agotado')+'.';
      if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null}
    },{enableHighAccuracy:true,maximumAge:10000,timeout:15000});
  };
  const listener=event=>{
    if(event.source!==iframe.contentWindow||!event.data)return;
    if(event.data.type==='EOTS_V168_MAP_READY'){frameReady=true;publishPosition();return}
    if(event.data.type!=='EOTS_V168_OPEN_VISIT')return;
    const index=event.data.index;
    if(!Number.isInteger(index)||!valid.some(item=>item.i===index)||!visits[index]||String(visits[index].estatus).trim().toLowerCase()==='realizada')return;
    clearMap();form(visits[index]);
  };
  window.addEventListener('message',listener);
  mapInstance={remove(){if(watchId!==null)navigator.geolocation.clearWatch(watchId);window.removeEventListener('message',listener);iframe.remove()}};
  $('v168MapFrameHost').append(iframe);
}
// Selector de vistas: requerido por render(), showMap() y showRoute().
function tabs(active){
 const items=[['list','☷ Listado'],['map','♦ Mapa'],['route','↗ Ruta inteligente']];
 return '<nav class="v168-view-tabs" aria-label="Vistas de visitas territoriales">'+items.map(([id,label])=>'<button type="button" data-v168-view="'+id+'" class="'+(id===active?'is-active':'')+'" aria-pressed="'+(id===active?'true':'false')+'">'+label+'</button>').join('')+'</nav>';
}
function bindTabs(){
 const root=$('v168Area');if(!root)return;
 root.querySelectorAll('[data-v168-view]').forEach(button=>{
  button.onclick=()=>{const view=button.getAttribute('data-v168-view');if(view==='map')showMap();else if(view==='route')showRoute();else render()};
 });
}
// Optimización heurística por distancia geográfica (no tiempo real de caminata).
function routeDistance(a,b){const R=6371,rad=Math.PI/180,dLat=(b[0]-a[0])*rad,dLon=(b[1]-a[1])*rad,x=Math.sin(dLat/2)**2+Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin(dLon/2)**2;return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function routePending(){return visits.filter(v=>String(v.estatus||'').trim().toLowerCase()!=='realizada')}
function routeOptimize(items,start){
 const remaining=items.map((v,i)=>({v,i,pos:locationOf(v)})).filter(x=>x.pos);
 const result=[];let current=start;
 if(!current&&remaining.length){ // Sin ubicación: usar como inicio el primer centro según orden asignado.
  remaining.sort((a,b)=>(Number(a.v.orden)||999999)-(Number(b.v.orden)||999999));const first=remaining.shift();result.push(first);current=first.pos;
 }
 while(remaining.length){let best=0,dist=Infinity;remaining.forEach((x,i)=>{const d=routeDistance(current,x.pos);if(d<dist){dist=d;best=i}});const next=remaining.splice(best,1)[0];result.push(next);current=next.pos}
 return result;
}
function routeGoogleUrl(ordered,start){
 if(!ordered.length)return '';
 const last=ordered[ordered.length-1].pos.join(',');
 const params=new URLSearchParams({api:'1',destination:last,travelmode:'walking'});
 if(start)params.set('origin',start.join(','));else if(ordered.length>1)params.set('origin',ordered[0].pos.join(','));
 const middle=start?ordered.slice(0,-1):ordered.slice(1,-1);
 // Google Maps puede limitar los puntos intermedios según dispositivo/navegador.
 if(middle.length)params.set('waypoints',middle.map(x=>x.pos.join(',')).join('|'));
 return 'https://www.google.com/maps/dir/?'+params.toString();
}
function showRoute(){
 const pending=routePending(),valid=pending.filter(v=>locationOf(v)),missing=pending.length-valid.length;
 panel(tabs('route')+'<div class="v168-panel"><h3 class="v168-section-title">Ruta inteligente · Visitas pendientes</h3><p class="v168-meta">Se propone un recorrido por proximidad geográfica entre centros de trabajo. No representa el tiempo real a pie ni garantiza la ruta más rápida; Google Maps calcula las indicaciones peatonales.</p><div class="v168-toolbar"><button type="button" id="v168RouteLocation">Usar mi ubicación como inicio</button><button type="button" class="v168-secondary" id="v168RouteDefault">Iniciar en el primer centro asignado</button></div><p id="v168RouteInfo" class="v168-meta" role="status"></p><div id="v168RouteActions" class="v168-toolbar"></div><div id="v168RouteList" class="v168-grid"></div></div>');
 bindTabs();const info=$('v168RouteInfo'),host=$('v168RouteList'),actions=$('v168RouteActions');
 function draw(start){
  const ordered=routeOptimize(pending,start);host.replaceChildren();actions.replaceChildren();
  if(!pending.length){info.textContent='Todas las visitas asignadas están realizadas.';return}
  if(!ordered.length){info.textContent='Las visitas pendientes no tienen coordenadas válidas. Revisa las columnas G y H de la hoja Visitas.';return}
  let total=0,previous=start;for(const x of ordered){if(previous)total+=routeDistance(previous,x.pos);previous=x.pos}
  info.textContent=ordered.length+' visitas pendientes con ubicación'+(missing?' · '+missing+' sin coordenadas (no incluidas)':'')+' · Distancia en línea recta entre paradas: '+total.toFixed(1)+' km (no es distancia caminando).'+(start?' Inicio: ubicación autorizada.':' Inicio: primer centro por orden asignado.');
  const all=document.createElement('a');all.className='v168-action';all.textContent='Abrir recorrido completo en Google Maps';all.href=routeGoogleUrl(ordered,start);all.target='_blank';all.rel='noopener noreferrer';actions.append(all);
  const warning=document.createElement('p');warning.className='v168-meta';warning.textContent='Si Google Maps limita las paradas, utiliza los enlaces individuales para continuar el recorrido.';actions.append(warning);
  ordered.forEach((x,i)=>{const v=x.v,row=document.createElement('article');row.className='v168-card';const h=document.createElement('h3');h.textContent=(i+1)+'. '+(v.sucursal||'Centro de trabajo');row.append(h);const d=document.createElement('p');d.className='v168-meta';d.textContent=(v.alcaldia||'')+' · '+(v.direccion||'')+' · Folio '+(v.folio||'');row.append(d);const link=document.createElement('a');link.className='v168-action v168-secondary';link.textContent='Navegar a esta visita';link.href=mapsUrl(v);link.target='_blank';link.rel='noopener noreferrer';row.append(link);host.append(row)});
 }
 $('v168RouteDefault').onclick=()=>draw(null);
 $('v168RouteLocation').onclick=()=>{
  if(!navigator.geolocation){info.textContent='Tu navegador no admite geolocalización. Se mantiene la ruta desde el primer centro.';return}
  info.textContent='Solicitando autorización para usar tu ubicación…';
  navigator.geolocation.getCurrentPosition(p=>draw([p.coords.latitude,p.coords.longitude]),()=>{draw(null);info.textContent+=' No se obtuvo tu ubicación; se usó el primer centro como inicio.'},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
 };
 draw(null);
}
function render(){
 const pend=visits.filter(v=>String(v.estatus).toLowerCase()!=='realizada').length;
 panel(offlineBanner()+tabs('list')+'<div class="v168-summary"><div class="v168-stat"><strong>'+visits.length+'</strong><span>Asignadas</span></div><div class="v168-stat"><strong>'+pend+'</strong><span>Pendientes</span></div><div class="v168-stat"><strong>'+(visits.length-pend)+'</strong><span>Realizadas</span></div></div><div class="v168-toolbar"><button id="v168Reload">Actualizar</button><button class="v168-secondary" id="v168MapButton">Ver mapa</button><button class="v168-secondary" id="v168Offline">Guardadas sin conexión</button><button class="v168-secondary" id="v168Sync">Sincronizar</button></div><div id="v168List" class="v168-grid"></div>');
 bindTabs();bindMode();$('v168Reload').onclick=offlineMode?local:load;$('v168MapButton').onclick=showMap;$('v168Offline').onclick=queue;$('v168Sync').onclick=()=>sync();
 const host=$('v168List');if(!visits.length){host.innerHTML='<div class="v168-panel">No hay visitas asignadas a tu usuario.</div>';return}
 visits.slice().sort((a,b)=>Number(isDone(a))-Number(isDone(b))||(Number(a.orden)||999999)-(Number(b.orden)||999999)).forEach(v=>{const done=isDone(v);const e=document.createElement('article');e.className='v168-card';e.innerHTML='<div class="v168-heading"><h3>'+escape(v.sucursal)+'</h3><span class="v168-badge '+(done?'done':'')+'">'+escape(v.estatus||'Pendiente')+(done&&v.fechaRealizada?'<small style="display:block;font-size:11px;margin-top:4px">'+escape(dateString(v.fechaRealizada))+'</small>':'')+'</span></div><p class="v168-meta">'+escape(v.alcaldia)+' · Orden '+escape(v.orden)+'</p><p class="v168-meta">'+escape(v.direccion)+'</p><p class="v168-meta"><b>Folio sucursal:</b> '+escape(v.folio)+'</p><div class="v168-toolbar"></div>';
 const b=document.createElement('button');b.textContent=done?'Visita realizada':'Realizar cuestionario';b.disabled=done;b.onclick=()=>form(v);e.lastElementChild.append(b);
 const m=document.createElement('a');m.textContent='Abrir Google Maps';m.className='v168-action v168-secondary';m.target='_blank';m.rel='noopener noreferrer';m.href=mapsUrl(v);if(!m.href||!v.direccion&&!locationOf(v)){m.removeAttribute('href');m.textContent='Ubicación no disponible';m.setAttribute('aria-disabled','true');}e.lastElementChild.append(m);host.append(e)})
}
function options(name,arr,required=true){return '<fieldset class="v168-question"><legend>'+escape(({abierto:'¿El CT se encuentra abierto o cerrado?',otraDireccion:'¿El CT se encuentra en otra dirección?',presentes:'¿Están presentes todos los aprendices?',plataforma:'¿Quién maneja la plataforma?',planes:'¿Cumplen con los planes de capacitación?',horario:'¿Hay cambios de horario?',anomalias:'¿Se detectan anomalías?'})[name]||name)+(required?' *':'')+'</legend><div class="v168-choice-list">'+arr.map((v,i)=>'<label class="v168-choice"><input type="radio" name="'+name+'" value="'+escape(v)+'" '+(required?'required':'')+'> '+escape(v)+'</label>').join('')+'</div></fieldset>'}
function input(label,name,type='text',required=false){return '<label class="v168-field">'+escape(label)+(required?' *':'')+'<input name="'+name+'" type="'+type+'" '+(required?'required':'')+'></label>'}
function form(v){current=v;visitGps={capturedAt:new Date().toISOString(),lat:null,lng:null,accuracy:null,status:'consultando'};const gpsSeq=++visitGpsSeq;
 panel('<div class="v168-panel"><h3 class="v168-section-title">Centro de trabajo asignado</h3><div class="v168-identity"><p><b>Enlace:</b> '+escape(USUARIO.nombre)+'</p><p><b>Folio sucursal:</b> '+escape(v.folio)+'</p><p><b>Sucursal:</b> '+escape(v.sucursal)+'</p><p><b>Dirección:</b> '+escape(v.direccion)+'</p></div><p class="v168-meta">Los datos de asignación se precargan desde la hoja Visitas y no se pueden modificar.</p><div id="v168GpsInfo" class="v168-meta" role="status">Registrando ubicación al iniciar el cuestionario…</div><button type="button" class="v168-secondary" id="v168GpsRetry">Reintentar ubicación</button></div><form id="v168Form"><div class="v168-panel"><h3 class="v168-section-title">1. Identificación y condiciones</h3><div class="v168-grid">'+options('abierto',['Abierto','Cerrado'])+options('otraDireccion',['Sí','No'])+input('Folio del CT','folioCT','text',true)+input('Nombre de quien atiende la visita','atiende')+input('Correo registrado en plataforma','correo','email')+input('Teléfono registrado en plataforma','telefono','tel')+'</div></div><div class="v168-panel"><h3 class="v168-section-title">2. Aprendices y capacitación</h3><div class="v168-grid">'+options('presentes',['Sí','No','Parcialmente'])+input('¿Cuántos aprendices tiene?','cantidad','number')+'</div><div class="v168-card" style="margin-top:16px"><b>Nombres de aprendices presentes</b><div id="v168People"></div><button class="v168-secondary" type="button" id="v168Add">+ Agregar persona</button><p class="v168-meta">Se registrarán separados por comas.</p></div><div class="v168-grid">'+options('plataforma',['Representante','Tutor','Personal de recursos humanos','Una tercera persona ajena al Centro de trabajo','Otro'])+input('Si elegiste Otro, especifica','plataformaOtro')+options('planes',['Sí','No','Parcialmente'])+options('horario',['Sí','No','Parcialmente'])+'</div></div><div class="v168-panel"><h3 class="v168-section-title">3. Evidencia y observaciones</h3>'+options('anomalias',['Sí','No'])+'<label class="v168-field" style="margin-top:14px">Observaciones<textarea name="observaciones" rows="4"></textarea></label><label class="v168-field" style="margin-top:14px">Fotografía de la visita (tomar foto o elegir de Fototeca; se optimiza a máximo 2.5 MB)<input type="file" name="foto" accept="image/*"></label></div><div class="v168-toolbar v168-actions-bottom"><button type="submit">Guardar visita</button><button class="v168-secondary" type="button" id="v168Back">Volver al listado</button></div></form>');
 $('v168Add').onclick=addPerson;$('v168Back').onclick=render;addPerson();const f=$('v168Form');f.elements.abierto.forEach(r=>r.onchange=()=>{const closed=f.elements.abierto.value==='Cerrado';['presentes','plataforma','planes','horario'].forEach(n=>f.elements[n].forEach(x=>x.required=!closed))});f.onsubmit=save;$('v168GpsRetry').onclick=()=>captureVisitGps(gpsSeq);captureVisitGps(gpsSeq);
}
function addPerson(){const d=document.createElement('div');d.className='v168-person';const x=document.createElement('input');x.placeholder='Nombre completo del aprendiz';x.className='v168-name';x.setAttribute('aria-label','Nombre del aprendiz');const b=document.createElement('button');b.type='button';b.className='v168-secondary';b.textContent='Quitar';b.onclick=()=>d.remove();d.append(x,b);$('v168People').append(d)}

function captureVisitGps(seq){
 const info=$('v168GpsInfo');if(!visitGps||seq!==visitGpsSeq)return;
 if(!navigator.geolocation){visitGps.status='no_disponible';if(info)info.textContent='Este dispositivo no ofrece geolocalización. La visita puede guardarse sin coordenadas.';return}
 visitGps.status='consultando';if(info)info.textContent='Obteniendo GPS (puede tardar unos segundos)…';
 navigator.geolocation.getCurrentPosition(pos=>{
  if(seq!==visitGpsSeq||!visitGps)return;
  visitGps.lat=pos.coords.latitude;visitGps.lng=pos.coords.longitude;visitGps.accuracy=pos.coords.accuracy;
  visitGps.status='registrada';
  if(info)info.textContent='Ubicación registrada: '+visitGps.lat.toFixed(6)+', '+visitGps.lng.toFixed(6)+' · Precisión ±'+Math.round(visitGps.accuracy)+' m. Fecha/hora fijadas al iniciar el cuestionario.';
 },err=>{
  if(seq!==visitGpsSeq||!visitGps)return;
  visitGps.status='no_disponible';
  if(info)info.textContent='No se pudo registrar GPS ('+(err.code===1?'permiso denegado':err.code===3?'tiempo agotado':'ubicación no disponible')+'). Puedes reintentar; se conservará la hora de inicio.';
 },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
}
function visitStamp(gps){
 const d=new Date(gps.capturedAt);const date=Number.isNaN(d.getTime())?'Sin fecha':d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
 const time=Number.isNaN(d.getTime())?'Sin hora':d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
 return [gps.status==='registrada'?'Ubicación: '+gps.lat.toFixed(6)+', '+gps.lng.toFixed(6):'Ubicación GPS: no disponible','Fecha de registro: '+date,'Hora de registro: '+time,gps.status==='registrada'?'Precisión GPS: ±'+Math.round(gps.accuracy)+' m':'Precisión GPS: no disponible'];
}
let logoPromise=null;
function watermarkLogo(){
 if(!logoPromise)logoPromise=new Promise((resolve)=>{
  const logo=new Image();logo.onload=()=>resolve(logo);logo.onerror=()=>resolve(null);
  logo.src='./logo_jcf_blanco.svg';
 });return logoPromise;
}
function drawWatermark(ctx,w,h,gps,logo){
 const lines=visitStamp(gps),font=Math.max(13,Math.round(w*0.022)),pad=Math.max(14,Math.round(w*0.025));
 ctx.save();ctx.font='600 '+font+'px Arial, sans-serif';ctx.textBaseline='middle';
 const lineH=Math.round(font*1.4),logoW=Math.round(w*0.245),gap=Math.round(w*0.028);
 const maxText=Math.max(...lines.map(x=>ctx.measureText(x).width));
 const contentW=logoW+gap+maxText;
 const ratio=Math.min(1,(w-2*pad)/contentW);
 const effectiveLogoW=logoW*ratio,textX=pad+effectiveLogoW+gap*ratio;
 const y0=h-pad-lines.length*lineH;
 // Sin banda ni fondo: solo trazos blancos con una sombra tenue para legibilidad.
 ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=Math.max(2,font*.22);ctx.shadowOffsetY=1;
 if(logo){const lh=effectiveLogoW*logo.naturalHeight/logo.naturalWidth;ctx.drawImage(logo,pad,h-pad-lh,effectiveLogoW,lh)}
 ctx.fillStyle='#fff';ctx.font='600 '+Math.max(11,Math.round(font*ratio))+'px Arial, sans-serif';
 lines.forEach((line,i)=>ctx.fillText(line,textX,y0+i*lineH+lineH/2));ctx.restore();
}

// iOS Safari: sin capture forzado permite Fototeca, Cámara o Archivos.
// Convertir imágenes seleccionadas (incluidas HEIC/HEIF cuando Safari puede decodificarlas)
// a JPEG y reducir dimensiones/calidad para respetar el límite del servidor.
function readPhoto(file,gps){return new Promise((resolve,reject)=>{
 if(!file)return resolve('');
 if(file.type&&!file.type.startsWith('image/')&&!/\.(heic|heif|jpg|jpeg|png|webp)$/i.test(file.name||''))return reject(Error('Selecciona una imagen válida'));
 const url=URL.createObjectURL(file),img=new Image();
 const fail=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo procesar la imagen. Si está en HEIC, prueba compartirla como JPEG.'))};
 img.onerror=fail;
 img.onload=async()=>{
  URL.revokeObjectURL(url);
  try{
   const maxDim=1920,ratio=Math.min(1,maxDim/Math.max(img.naturalWidth,img.naturalHeight));
   let w=Math.max(1,Math.round(img.naturalWidth*ratio)),h=Math.max(1,Math.round(img.naturalHeight*ratio));
   if(!w||!h)throw Error('Imagen inválida');
   const logo=await watermarkLogo();
   for(let scale=1;scale>=0.35;scale*=0.75){
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo preparar la fotografía');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    drawWatermark(ctx,canvas.width,canvas.height,gps,logo);
    for(const quality of [0.85,0.72,0.58,0.42]){
     const data=canvas.toDataURL('image/jpeg',quality);
     if(data.startsWith('data:image/jpeg;')&&Math.ceil((data.length-data.indexOf(',')-1)*0.75)<=2500000)return resolve(data);
    }
   }
   reject(Error('La fotografía es demasiado grande incluso después de optimizarla'));
  }catch(err){reject(err)}
 };
 img.src=url;
})} 
async function save(e){e.preventDefault();const f=e.currentTarget;try{const data=new FormData(f),a=Object.fromEntries(data.entries());delete a.foto;a.aprendices=[...f.querySelectorAll('.v168-name')].map(x=>x.value.trim()).filter(Boolean);const gps=visitGps?{...visitGps}:{capturedAt:new Date().toISOString(),status:'no_disponible',lat:null,lng:null,accuracy:null};if(gps.status==='consultando')throw Error('Espera a que termine la consulta GPS o utiliza Reintentar ubicación.');const foto=await readPhoto(f.elements.foto.files[0],gps);const rec={id:crypto.randomUUID(),fila:current.fila,folio:current.folio,respuestas:a,foto,gps,curp:USUARIO.curp,created:Date.now(),state:'pendiente'};await put(rec);status('Visita guardada en este dispositivo.');render();if(navigator.onLine&&!offlineMode)sync()}catch(e){status('No se guardó: '+e.message)}}
async function queue(){const rows=(await all()).filter(x=>x.curp===USUARIO.curp);panel(offlineBanner()+'<div class="v168-panel"><h3 class="v168-section-title">Visitas guardadas localmente</h3><div class="v168-toolbar"><button class="v168-secondary" id="v168Back">Volver</button><button id="v168Sync">Sincronizar pendientes</button></div><div id="v168Saved"></div></div>');bindMode();$('v168Back').onclick=render;$('v168Sync').onclick=()=>sync();const host=$('v168Saved');rows.forEach(r=>{const d=document.createElement('div');d.className='v168-card';const info=document.createElement('p');info.textContent=r.folio+' · '+r.state+(r.error?' · '+r.error:'');d.append(info);if(r.state==='error'){const retry=document.createElement('button');retry.textContent='Reintentar esta visita';retry.onclick=()=>sync(r.id);d.append(retry)}host.append(d)});if(!rows.length)host.textContent='No hay visitas pendientes.'}
async function sync(onlyId){if(syncing)return;if(offlineMode||!navigator.onLine){status('Modo offline: las visitas siguen guardadas en este dispositivo.');return}if(!TOKEN){status('Inicia sesión para sincronizar.');return}syncing=true;let sent=0,failed=0;try{const rows=(await all()).filter(x=>x.curp===USUARIO.curp&&x.state!=='confirmado'&&(!onlyId||x.id===onlyId)).sort((a,b)=>a.created-b.created);for(const rec of rows){status('Enviando folio '+rec.folio+'...');const r=await call('v168VisitSave',rec);if(r&&r.ok){await del(rec.id);sent++;const item=visits.find(v=>String(v.folio)===String(rec.folio)&&Number(v.fila)===Number(rec.fila));if(item){item.estatus='Realizada';item.fechaRealizada=r.fechaRealizada||new Date().toISOString();saveCache()}}else{rec.state='error';rec.error=r&&r.mensaje||'Sin confirmación del servidor';await put(rec);failed++;console.warn('Visita pendiente de revisión',rec.folio,rec.error);/* Continuar con los demás registros, sin borrar el fallido. */}}status('Sincronización: '+sent+' enviada(s), '+failed+' con error. Los errores se conservan para reintentar.');if($('v168Saved'))await queue();else if($('v168List'))render()}catch(e){status('Error de sincronización: '+e.message)}finally{syncing=false}}
window.addEventListener('offline',()=>{if(USUARIO&&!offlineMode&&cacheKey()&&localStorage.getItem(cacheKey()))enableOffline()});window.addEventListener('online',()=>{if(USUARIO&&!offlineMode)sync()});window.v168Visitas={show,local,sync,queue,showMap,showRoute,enableOffline,goOnline,restoreOffline,isOffline:()=>offlineMode};
})();
