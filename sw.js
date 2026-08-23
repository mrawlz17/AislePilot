const CACHE='grocery-companion-v0.2.0';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-180.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(caches.match(event.request).then(cached=>cached || fetch(event.request).then(resp=>{
    const copy=resp.clone();
    if(resp.ok || resp.type==='opaque') caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
    return resp;
  }).catch(err=>{
    if(event.request.mode==='navigate') return caches.match('./index.html');
    throw err;
  })));
});
