const APP_CACHE='grocery-companion-v0.3.3';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-180.png','./icon-512.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(APP_CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k.startsWith('grocery-companion-')&&k!==APP_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  // Never intercept external requests. Screenshot OCR in v0.3 is intentionally
  // handled by OCR.space, not by the service worker or an in-browser Worker.
  if(url.origin!==self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(resp=>{
      if(resp.ok){
        const copy=resp.clone();
        caches.open(APP_CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
      }
      return resp;
    }).catch(()=>caches.match(event.request).then(cached=>{
      if(cached) return cached;
      if(event.request.mode==='navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
