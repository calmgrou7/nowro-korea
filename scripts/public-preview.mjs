// Isolated public demo. Never enable preview roles or connect private development data.
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { Store } from "../server/store.mjs";
import { createApp } from "../server/index.mjs";
if (existsSync(".env")) process.loadEnvFile(".env");
process.env.NODE_ENV = "production";
delete process.env.OPENAI_API_KEY;
const dir = resolve(".data/public-preview");
mkdirSync(dir, { recursive: true });
const store = new Store(resolve(dir, "nowro.sqlite"));
store.purge();
const timer = setInterval(() => store.purge(), 3600000);
timer.unref();
createApp(store, { preview: false }).listen(8788, "127.0.0.1", () =>
  console.info("Public demo origin ready on 8788"),
);
