/* 离线缓存：联网时优先拿最新版，断网时用缓存打开。
   只有 https（或 localhost）下浏览器才允许注册 Service Worker —— 所以部署到
   https 之后「断网也能开」才真正生效。 */
const CACHE = "family-schedule-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  // 逐个 add 并吞掉失败：以后万一少传了某个图标，也不会连累整个离线缓存装不上
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !/^https?:$/.test(new URL(req.url).protocol)) return;
  // 打开页面：先走网络（拿到最新版），失败再用缓存 —— 断网时也能开
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return res; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }
  // 其它静态文件（图标、manifest）：缓存优先，没有再走网络
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || fetch(req).then((res) => {
        const cp = res.clone();
        caches.open(CACHE).then((c) => c.put(req, cp));
        return res;
      }).catch(() => hit)
    )
  );
});
