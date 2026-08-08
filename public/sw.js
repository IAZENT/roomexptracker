const CACHE_NAME = "roommate-v2";
const SYNC_TAG = "roommate-shopping-sync";

// App shell - pre-cached on install
const APP_SHELL = [
  "/",
  "/login",
  "/signup",
  "/dashboard",
  "/dashboard/shopping",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-mark.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache app shell, don't fail if some assets are missing
      return Promise.allSettled(
        APP_SHELL.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) {
              return cache.put(url, response);
            }
          }),
        ),
      );
    }),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip non-http and extension requests
  if (!url.protocol.startsWith("http")) return;

  // Skip API routes and Supabase
  if (url.pathname.startsWith("/api/")) return;
  if (url.hostname.includes("supabase")) return;

  // Skip chrome extensions and other non-page requests
  if (!url.pathname.startsWith("/")) return;

  const isStaticAsset =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff");

  const isNavigation = event.request.mode === "navigate";

  if (isStaticAsset) {
    // Cache first for static assets, fallback to network
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
  } else if (isNavigation) {
    // Network first for navigation, fallback to cache, then offline page
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Return offline-friendly response for navigation
            return new Response(
              `<!DOCTYPE html>
              <html><head><title>Offline</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fefdfb;color:#1c1917;}
              .box{text-align:center;padding:2rem;}.box h1{font-size:1.5rem;margin-bottom:0.5rem;}
              .box p{color:#78716c;margin-bottom:1.5rem;}.box button{padding:0.75rem 1.5rem;border-radius:0.5rem;background:#c2704e;color:white;border:none;font-size:1rem;cursor:pointer;}</style>
              </head><body><div class="box">
              <h1>You&apos;re offline</h1>
              <p>Please check your connection and try again.</p>
              <button onclick="location.reload()">Retry</button>
              </div></body></html>`,
              { headers: { "Content-Type": "text/html" } },
            );
          });
        }),
    );
  } else {
    // Cache first for other requests (images, fonts, etc.)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
  }
});

// Background sync for shopping items
self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncShoppingItems());
  }
});

async function syncShoppingItems() {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SYNC_SHOPPING_ITEMS" });
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "TRIGGER_SYNC") {
    self.registration.sync.register(SYNC_TAG);
  }
});
