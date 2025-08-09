
self.addEventListener('install',e=>{
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  clients.claim();
});
self.addEventListener('fetch',e=>{
  // passthrough; we don't cache aggressively in this local bundle
});
