const CACHE = "nowro-shell-v12";
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) =>
        c.addAll([
          "/",
          "/brand/logo.webp",
          "/favicon.png",
          "/icon-192.png",
          "/icon-512.png",
          "/manifest.webmanifest",
          "/offline.html",
        ]),
      ),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("nowro-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== location.origin ||
    u.pathname.startsWith("/api/") ||
    u.pathname.startsWith("/.well-known/") ||
    (u.search && e.request.mode !== "navigate")
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (
          r.ok &&
          !u.search &&
          ["document", "script", "style", "image"].includes(
            e.request.destination,
          )
        ) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        e.request.mode === "navigate"
          ? caches.match("/offline.html").then((r) => r || Response.error())
          : caches.match(e.request).then((r) => r || Response.error()),
      ),
  );
});
