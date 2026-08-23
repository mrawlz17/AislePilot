const APP_CACHE='grocery-companion-v0.2.5';
const OCR_CACHE='grocery-ocr-v0.2.5';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-180.png','./icon-512.png'];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(APP_CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>(k.startsWith('grocery-companion-')||k.startsWith('grocery-ocr-')) && k!==APP_CACHE && k!==OCR_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));


self.addEventListener('message',event=>{
  if(event.data?.type==='GET_VERSION' && event.ports?.[0]) {
    event.ports[0].postMessage({version:'0.2.5'});
  }
  if(event.data?.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  // OCR binaries are downloaded by the page with normal CORS fetches, then
  // stored under same-origin URLs in OCR_CACHE. The service worker never tries
  // to import or relay a cross-origin worker/core file itself.
  if(url.origin===self.location.origin && url.pathname.includes('/ocr/')) {
    event.respondWith(
      caches.open(OCR_CACHE).then(cache=>cache.match(event.request)).then(cached=>
        cached || new Response('OCR asset has not been staged yet',{status:404,headers:{'Content-Type':'text/plain; charset=utf-8'}})
      )
    );
    return;
  }

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
