const APP_CACHE='grocery-companion-v0.2.3';
const OCR_CACHE='grocery-ocr-v0.2.3';
const CORE=['./','./index.html','./styles.css','./app.js','./manifest.json','./icon.svg','./icon-180.png','./icon-512.png'];

const OCR_CORE_FILES=new Set([
  'tesseract-core.wasm.js',
  'tesseract-core-simd.wasm.js',
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js'
]);

self.addEventListener('install',event=>event.waitUntil(
  caches.open(APP_CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(k=>(k.startsWith('grocery-companion-')||k.startsWith('grocery-ocr-')) && k!==APP_CACHE && k!==OCR_CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));

function ocrRemoteCandidates(url){
  if(url.pathname.endsWith('/ocr/worker.min.js')) return [
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    'https://unpkg.com/tesseract.js@5.1.1/dist/worker.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/tesseract.js/5.1.1/worker.min.js'
  ];

  const coreMatch=url.pathname.match(/\/ocr\/core\/([^/]+)$/);
  if(coreMatch && OCR_CORE_FILES.has(coreMatch[1])){
    const file=coreMatch[1];
    return [
      `https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/${file}`,
      `https://unpkg.com/tesseract.js-core@5.1.1/${file}`
    ];
  }

  if(url.pathname.endsWith('/ocr/lang/eng.traineddata.gz')) return [
    'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz',
    'https://unpkg.com/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
  ];

  return null;
}

async function fetchWithTimeout(url, timeoutMs=18000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{mode:'cors',cache:'force-cache',signal:controller.signal});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function localContentType(pathname){
  if(pathname.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if(pathname.endsWith('.gz')) return 'application/gzip';
  return 'application/octet-stream';
}

async function serveOcrAsset(request,url){
  const remotes=ocrRemoteCandidates(url);
  if(!remotes) return new Response('Not found',{status:404});

  const cache=await caches.open(OCR_CACHE);
  const cached=await cache.match(request);
  if(cached) return cached;

  let lastError=null;
  for(const remote of remotes){
    try{
      const upstream=await fetchWithTimeout(remote);
      const body=await upstream.arrayBuffer();
      const response=new Response(body,{
        status:200,
        headers:{
          'Content-Type':localContentType(url.pathname),
          'Cache-Control':'public, max-age=31536000, immutable'
        }
      });
      await cache.put(request,response.clone());
      return response;
    }catch(err){
      lastError=err;
    }
  }
  return new Response(`OCR asset unavailable: ${lastError?.message||'network failure'}`,{status:503,headers:{'Content-Type':'text/plain'}});
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(url.origin===self.location.origin && url.pathname.includes('/ocr/')){
    event.respondWith(serveOcrAsset(event.request,url));
    return;
  }

  // External requests that are not part of the same-origin OCR bridge should
  // bypass the app cache entirely.
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
