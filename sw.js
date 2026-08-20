const CACHE='ez-english-v1.2';
const SHELL=['./','./index.html','./style.css?v=1.2','./app.js?v=1.2','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  const url=new URL(req.url);

  if(url.hostname.includes('script.google.com') ||
     url.hostname.includes('googleusercontent.com') ||
     url.hostname.includes('cloudinary.com')) return;

  if(req.method==='GET'){
    event.respondWith(
      fetch(req)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(cache=>cache.put(req,copy));
          return res;
        })
        .catch(()=>caches.match(req))
    );
  }
});
