/* V16: PWA shell registration only. No cache of personal data, sessions or API responses. */
self.addEventListener('install', event => { self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
/* Network handling is deliberately left to the browser. */
