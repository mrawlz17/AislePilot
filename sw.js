const CACHE='grocery-companion-v0.2.2';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-180.png','./icon-512.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  // Do not proxy/cache OCR libraries, workers, language data, or WASM from
  // external hosts. Let Safari fetch those resources directly.
  if(url.origin!==self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(resp=>{
      if(resp.ok){
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
      }
      return resp;
    }).catch(()=>caches.match(event.request).then(cached=>{
      if(cached) return cached;
      if(event.request.mode==='navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
