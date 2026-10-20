import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("PWA keeps APIs and Android trust files online-only and shows offline navigation page", async () => {
  const handlers = {},
    deleted = [],
    stored = [];
  const offline = { offline: true };
  const cache = {
    addAll: async () => {},
    put: async (key) => stored.push(key),
    match: async () => offline,
  };
  const context = {
    URL,
    Response,
    location: { origin: "https://nowro.example" },
    self: {
      addEventListener: (name, callback) => {
        handlers[name] = callback;
      },
    },
    caches: {
      open: async () => cache,
      keys: async () => ["nowro-shell-v11", "other-app-cache"],
      delete: async (key) => deleted.push(key),
      match: async (path) => (path === "/offline.html" ? offline : undefined),
    },
    fetch: async () => {
      throw new Error("offline");
    },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), context);
  let task;
  handlers.activate({
    waitUntil: (promise) => {
      task = promise;
    },
  });
  await task;
  assert.deepEqual(deleted, ["nowro-shell-v11"]);
  for (const path of [
    "/api/status",
    "/api/wallet",
    "/.well-known/assetlinks.json",
  ]) {
    handlers.fetch({
      request: { url: `https://nowro.example${path}`, method: "GET" },
      respondWith: () =>
        assert.fail("Private API/trust file must not use cache fallback"),
    });
  }
  handlers.fetch({
    request: {
      url: "https://nowro.example/?tab=MAP",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (promise) => {
      task = promise;
    },
  });
  assert.equal(await task, offline);
  context.fetch = async () => ({ ok: true, clone: () => ({}) });
  handlers.fetch({
    request: {
      url: "https://nowro.example/?stamp=private-proof",
      method: "GET",
      mode: "navigate",
      destination: "document",
    },
    respondWith: (promise) => {
      task = promise;
    },
  });
  await task;
  assert.deepEqual(stored, []);
});
