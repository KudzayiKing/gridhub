/* Gridhub service worker
 *
 * Strategy
 * - Navigations: network first, fall back to the cached shell, then /offline.
 * - Static assets (_next/static, icons, fonts): cache first with background refresh.
 * - AI runtime (/ai/**): cache first, no revalidation. These are the LiteRT-LM WASM runtime and the
 *   speech (Transformers.js + ONNX Runtime) assets. They are versioned by the vendoring script, not
 *   by the URL, so they live in their own cache whose name carries the runtime version.
 * - API routes: never cached. Sync must always hit the network so status is truthful.
 */

const VERSION = "gridhub-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

/*
 * Bump this whenever scripts/vendor-ai-assets.mjs is run against new pinned versions. The file names
 * do not change between releases, so without a bump a stale runtime would be served forever.
 * The name still starts with VERSION so the activate cleanup below preserves it.
 */
const AI_RUNTIME_VERSION = "ai-runtime-v1";
const AI_CACHE = `${VERSION}-${AI_RUNTIME_VERSION}`;

const SHELL_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  // The header lockup (G mark + wordmark) is theme-specific artwork; caching both themes
  // (WebP with the PNG fallback) means the header renders with the right artwork on first
  // paint even when the app is launched offline. The mark files are also the favicon and
  // PWA-icon artwork, so they are needed either way.
  "/icons/gridhub-wordmark-on-light.webp",
  "/icons/gridhub-wordmark-on-dark.webp",
  "/icons/gridhub-wordmark-on-light.png",
  "/icons/gridhub-wordmark-on-dark.png",
  "/icons/gridhub-mark-on-light.png",
  "/icons/gridhub-mark-on-dark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => {
              // Keep caches for the current app version…
              if (!key.startsWith(VERSION)) return true;
              // …and only the current AI runtime generation. A bumped runtime must not leak the old
              // ~230 MB of assets, which would otherwise survive because the name starts with VERSION.
              if (key.includes("-ai-runtime-") && key !== AI_CACHE) return true;
              return false;
            })
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Immutable, versioned-by-cache-name AI runtime files. Never revalidated. */
function isAIRuntimeAsset(url) {
  return url.pathname.startsWith("/ai/");
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/app");
          if (shell) return shell;
          return (await caches.match("/offline")) ?? Response.error();
        }),
    );
    return;
  }

  if (isAIRuntimeAsset(url)) {
    /*
     * Cache first, deliberately without a background refresh: these files are tens of megabytes and
     * re-downloading them on every command would be absurd. A new runtime ships under a new cache
     * name instead.
     */
    event.respondWith(
      caches.open(AI_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          // Offline and not cached: the caller gets a network error and reports it honestly.
          return Response.error();
        }
      }),
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
