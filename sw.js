const CACHE='ez-english-shell-v1';
const SHELL=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(u.hostname.includes('cloudinary.com')||u.hostname.includes('script.google.com')||u.hostname.includes('googleusercontent.com')) return;
  if(e.request.method==='GET') e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request)));
});
