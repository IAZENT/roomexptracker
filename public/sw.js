const CACHE_NAME = "roommate-v3";
const SYNC_TAG = "roommate-shopping-sync";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        [
          "/",
          "/login",
          "/signup",
          "/dashboard",
          "/dashboard/shopping",
          "/icon-192.png",
          "/icon-512.png",
          "/logo-mark.png",
          "/manifest.json",
        ].map((url) =>
          fetch(url).then((r) => (r.ok ? cache.put(url, r) : null)),
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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (!url.protocol.startsWith("http")) return;

  // Skip API and Supabase
  if (url.pathname.startsWith("/api/")) return;
  if (url.hostname.includes("supabase")) return;

  // Network first for everything, cache on success, fallback to cache offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline: try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;

          // For navigation, return offline page
          if (event.request.mode === "navigate") {
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
          }

          return Response.error();
        });
      }),
  );
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
