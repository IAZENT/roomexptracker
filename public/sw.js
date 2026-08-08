const CACHE_NAME = "roommate-v1";
const SYNC_TAG = "roommate-shopping-sync";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/dashboard/shopping",
  "/login",
  "/signup",
  "/icon-192.png",
  "/icon-512.png",
  "/logo-mark.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
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
  if (event.request.url.includes("/api/")) return;
  if (event.request.url.includes("supabase")) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (event.request.mode === "navigate") {
        return fetch(event.request)
          .then((response) => {
            // Cache successful navigation responses for offline
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached || Response.error());
      }
      return cached || fetch(event.request);
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
  // Open a client window to run the sync via the app's logic
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "SYNC_SHOPPING_ITEMS" });
  }
}

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data?.type === "TRIGGER_SYNC") {
    self.registration.sync.register(SYNC_TAG);
  }
});
