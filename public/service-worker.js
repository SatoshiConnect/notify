const CACHE='nsat-notify-shell-v3';
const SHELL=['/','/notify.css?v=1','/notify.js?v=2','/style.css','/theme.css?v=16','/app.js?v=22','/wallet-keys.js','/manifest.webmanifest','/nsat-icon.svg','/nsat-icon-192.png','/nsat-icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/socket.io/'))return;
  if(request.mode==='navigate'){
    const shellPath=url.pathname==='/messenger'?'/messenger':'/';
    event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(shellPath,response.clone()));return response;}).catch(()=>caches.match(shellPath)));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;})));
});
self.addEventListener('push',event=>{let payload={};try{payload=event.data?.json()||{};}catch{payload={body:event.data?.text()||''};}event.waitUntil(self.registration.showNotification(payload.title||'New notification',{body:payload.body||'You have a new notification',icon:'/nsat-icon.svg',badge:'/nsat-icon.svg',tag:`notification-${payload.data?.notificationId||Date.now()}`,data:payload.data||{}}));});
self.addEventListener('notificationclick',event=>{event.notification.close();const id=event.notification.data?.notificationId;event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{const url=id?`/?notification=${encodeURIComponent(id)}`:'/';for(const client of clients){if('focus'in client)return client.navigate(url).then(()=>client.focus());}return self.clients.openWindow(url);}));});
