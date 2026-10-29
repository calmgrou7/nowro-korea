import http from "node:http";
import { readFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Store, ServiceError, coupons, areas, cities } from "./store.mjs";
import { recommend, calculate } from "../shared/engine.ts";
import { extract } from "./ai.mjs";
import { AuthService } from "./auth.mjs";
import { androidAssociation } from "../shared/android-app.mjs";
import {
  ownBusiness,
  submitBusiness,
  listBusinesses,
  reviewBusiness,
} from "./businesses.mjs";
import {
  testPayment,
  rewardProgress,
  claimReward,
  adminRewards,
  updateReward,
} from "./rewards.mjs";
import {
  operatorListings,
  publicListings,
  saveListing,
  reviewListing,
  archiveListing,
  ListingError,
} from "./listings.mjs";
export function createApp(store, options = {}) {
  const auth = options.auth || new AuthService(store);
  const limiter = new Map();
  const preview =
    options.preview ?? process.env.ENABLE_LOCAL_OPERATOR_PREVIEW === "true";
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cache-Control", "no-store");
    const send = (status, data) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (req.method === "GET" && url.pathname === "/api/health")
        return send(200, { ok: true });
      if (
        req.method === "GET" &&
        url.pathname === "/.well-known/assetlinks.json"
      ) {
        try {
          return send(
            200,
            androidAssociation(
              process.env.ANDROID_APP_ID,
              process.env.ANDROID_SHA256_FINGERPRINTS,
            ),
          );
        } catch {
          return send(404, { error: "ANDROID_ASSOCIATION_NOT_CONFIGURED" });
        }
      }
      if (!url.pathname.startsWith("/api/")) {
        const root = resolve("dist");
        let file = resolve(root, "." + decodeURIComponent(url.pathname));
        if (file !== root && !file.startsWith(root + sep))
          throw new ServiceError("NOT_FOUND", 404);
        if (!existsSync(file) || !statSync(file).isFile())
          file = resolve(root, "index.html");
        if (!existsSync(file))
          return send(404, {
            error: "Run npm run dev or npm run build first.",
          });
        const types = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".webp": "image/webp",
          ".webmanifest": "application/manifest+json",
        };
        res.writeHead(200, {
          "Content-Type": types[extname(file)] || "application/octet-stream",
          "Cache-Control": file.endsWith("index.html")
            ? "no-cache"
            : "public,max-age=3600",
        });
        return res.end(readFileSync(file));
      }
      const cookie = req.headers.cookie
        ?.split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("nowro="))
        ?.slice(6);
      let s = store.session(cookie);
      const setCookie = (session) =>
        res.setHeader(
          "Set-Cookie",
          `nowro=${session.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        );
      if (url.pathname !== "/api/auth/logout") {
        try {
          s = await auth.resolve(s);
        } catch (e) {
          if (
            e instanceof ServiceError &&
            e.message === "AUTH_SESSION_EXPIRED"
          ) {
            store.db.prepare("DELETE FROM sessions WHERE id=?").run(s.id);
            s = store.session();
            setCookie(s);
            if (url.pathname !== "/api/status") throw e;
          } else throw e;
        }
      }
      if (s.id !== cookie)
        res.setHeader(
          "Set-Cookie",
          `nowro=${s.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        );
      const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress,
      );
      let body = {};
      if (req.method !== "GET") {
        if (req.headers["x-nowro-request"] !== "1")
          throw new ServiceError("CSRF", 403);
        const origin = req.headers.origin;
        if (
          origin &&
          new URL(origin).host !== req.headers.host &&
          !(local && origin === "http://127.0.0.1:5173")
        )
          throw new ServiceError("CSRF", 403);
        const key = s.user_id + ":" + url.pathname,
          now = Date.now();
        const bucket = limiter.get(key) || { at: now, n: 0 };
        if (now - bucket.at > 60000) {
          bucket.at = now;
          bucket.n = 0;
        }
        if (++bucket.n > 60) throw new ServiceError("RATE_LIMIT", 429);
        limiter.set(key, bucket);
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (
            Buffer.byteLength(raw) >
            (url.pathname === "/api/operator/listings/save" || url.pathname === "/api/operator/site-content" ? 4500000 : 32000)
          )
            throw new ServiceError("TOO_LARGE", 413);
        }
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          throw new ServiceError("INVALID_JSON");
        }
      }
      const route = req.method + " " + url.pathname;
      let out;
      switch (route) {
        case "GET /api/business/application":
          out = { application: ownBusiness(store, s) };
          break;
        case "POST /api/business/application":
          out = { application: submitBusiness(store, s, body) };
          break;
        case "GET /api/operator/businesses":
          out = { applications: listBusinesses(store, s) };
          break;
        case "POST /api/operator/businesses/review":
          out = { application: reviewBusiness(store, s, body) };
          break;
        case "POST /api/auth/request":
          out = await auth.request(s, body);
          break;
        case "POST /api/auth/verify": {
          s = await auth.verify(s, body);
          setCookie(s);
          out = { authenticated: true };
          break;
        }
        case "POST /api/auth/oauth": {
          s = await auth.oauth(s, body);
          setCookie(s);
          out = { authenticated: true };
          break;
        }
        case "POST /api/auth/link-preview":
          out = await auth.previewLink(s, body);
          break;
        case "POST /api/auth/link-confirm": {
          s = await auth.verifyLink(s, body);
          setCookie(s);
          out = { authenticated: true };
          break;
        }
        case "POST /api/auth/logout": {
          s = await auth.logout(s);
          setCookie(s);
          out = { ok: true };
          break;
        }
        case "GET /api/rewards":
          out = rewardProgress(store, s);
          break;
        case "POST /api/rewards/claim":
          out = claimReward(store, s, body);
          break;
        case "GET /api/operator/rewards":
          out = { orders: adminRewards(store, s) };
          break;
        case "POST /api/operator/rewards/update":
          out = updateReward(store, s, body);
          break;
        case "POST /api/payments/test":
          if (!preview || !local)
            throw new ServiceError("PREVIEW_DISABLED", 403);
          out = testPayment(store, s, body);
          break;
        case "GET /api/shop": {
          const link = (value) => {
            try {
              const u = new URL(value);
              return u.protocol === "https:" && !u.username && !u.password
                ? u.href
                : null;
            } catch {
              return null;
            }
          };
          out = {
            discount: link(process.env.DISCOUNT_SHOP_URL),
            goods: link(process.env.GOODS_SHOP_URL),
            register: link(process.env.TICKET_REGISTER_URL),
          };
          break;
        }
        case "GET /api/listings":
          out = { listings: publicListings(store.db) };
          break;
        case "GET /api/operator/listings":
          out = { listings: operatorListings(store.db, s) };
          break;
        case "POST /api/operator/listings/save":
          out = saveListing(store, s, body);
          break;
        case "POST /api/operator/listings/review":
          out = reviewListing(store, s, body);
          break;
        case "POST /api/operator/listings/archive":
          out = archiveListing(store, s, body);
          break;
        case "GET /api/status":
          out = {
            mode: "local-sample",
            ai: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
            supabase: false,
            operatorPreview: preview && local && !auth.account(s),
            session: {
              role: s.role,
              authenticated: !!auth.account(s),
              email: auth.account(s)?.email || null,
            },
            canTravel:
              s.role === "traveler" ||
              (s.role === "partner" && !!auth.account(s)),
            authConfigured: auth.enabled,
            authEmailMode: auth.redirect ? "link" : "code",
            dataBackend: "sqlite",
            retentionDays: 7,
          };
          break;
        case "GET /api/site-content":
          out = { content: store.siteContent() };
          break;
        case "POST /api/operator/site-content":
          out = { content: store.updateSiteContent(s, body) };
          break;
        case "GET /api/catalog":
          out = {
            cities,
            areas,
            places: store.catalog().filter((p) => p.published),
            coupons: coupons.map((c) => ({
              ...c,
              paused:
                store.db
                  .prepare("SELECT value FROM config WHERE key=?")
                  .get("paused:" + c.id)?.value === "true",
            })),
          };
          break;
        case "GET /api/wallet":
          out = store.wallet(s);
          break;
        case "POST /api/recommend":
          out = {
            routes: recommend(body.conditions, store.catalog()),
            engine: "rules",
            routing: "conservative-estimate",
          };
          break;
        case "POST /api/recalculate": {
          const route = calculate(
            body.placeIds,
            body.conditions,
            store.catalog(),
          );
          if (!route) throw new ServiceError("INFEASIBLE_ROUTE");
          out = { route };
          break;
        }
        case "POST /api/trips":
          out = store.save(s, body);
          break;
        case "POST /api/trips/delete":
          store.deleteTrip(s, body.id);
          out = { ok: true };
          break;
        case "POST /api/coupons/issue":
          out = store.issue(s, body.couponId);
          break;
        case "POST /api/coupons/redeem":
          out = store.redeem(s, body.voucherId, body.total);
          break;
        case "POST /api/coupons/pause":
          out = store.toggle(s, body.couponId, body.paused);
          break;
        case "POST /api/stamps/challenge":
          out = store.challenge(s, body.placeId, body.paymentId);
          break;
        case "POST /api/stamps/claim":
          out = store.stamp(s, body.token);
          break;
        case "GET /api/operator":
          out = store.operator(s);
          break;
        case "POST /api/operator/proposal":
          out = store.proposal(s, body.placeId, body.patch);
          break;
        case "POST /api/operator/approve":
          out = store.approve(s, body.id, body.approved);
          break;
        case "POST /api/preview-role":
          if (!preview || !local)
            throw new ServiceError("PREVIEW_DISABLED", 403);
          if (auth.account(s)) throw new ServiceError("PREVIEW_DISABLED", 403);
          out = { role: store.setPreviewRole(s, body.role).role };
          break;
        case "POST /api/consent":
          out = store.setConsent(s, body);
          break;
        case "GET /api/consent":
          out = store.db
            .prepare(
              "SELECT version,analytics,location FROM consent WHERE user_id=?",
            )
            .get(s.user_id) || { analytics: 0, location: 0 };
          break;
        case "POST /api/events":
          out = store.event(s, body.name);
          break;
        case "POST /api/report":
          out = store.report(s, body.placeId, body.reason);
          break;
        case "POST /api/ai/extract":
          try {
            out = await extract(
              body.text,
              areas.map((a) => a.id),
              () => {
                const key = "ai:" + new Date().toISOString().slice(0, 10),
                  n = Number(
                    store.db
                      .prepare("SELECT value FROM config WHERE key=?")
                      .get(key)?.value || 0,
                  );
                if (n >= Number(process.env.OPENAI_DAILY_CALL_LIMIT || 50))
                  throw new ServiceError("AI_QUOTA", 429);
                store.db
                  .prepare("INSERT OR REPLACE INTO config VALUES (?,?)")
                  .run(key, String(n + 1));
              },
            );
          } catch {
            out = {
              connected: !!process.env.OPENAI_API_KEY,
              conditions: null,
              unavailable: true,
            };
          }
          break;
        default:
          throw new ServiceError("NOT_FOUND", 404);
      }
      send(200, out);
    } catch (e) {
      const known = e instanceof ServiceError || e instanceof ListingError;
      const validation = e.message === "INVALID_CONDITIONS";
      if (!known && !validation) console.error("request_failed", e.message);
      send(known ? e.status : validation ? 400 : 500, {
        error: known || validation ? e.message : "SERVER_ERROR",
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const host = process.env.HOST || "127.0.0.1";
  if (
    !["127.0.0.1", "localhost", "::1"].includes(host) &&
    !(
      process.env.DEPLOYMENT_MODE === "public-demo" &&
      host === "0.0.0.0" &&
      process.env.ENABLE_LOCAL_OPERATOR_PREVIEW !== "true"
    )
  ) {
    throw new Error(
      "Local sample server must bind to localhost. Configure and verify Supabase auth before public hosting.",
    );
  }
  const dir = resolve(process.env.DATA_DIR || ".data");
  mkdirSync(dir, { recursive: true });
  const store = new Store(resolve(dir, "nowro.sqlite"));
  store.purge();
  const interval = setInterval(() => store.purge(), 3600000);
  interval.unref();
  const server = createApp(store);
  server.listen(Number(process.env.PORT || 8787), host, () =>
    console.info(
      `NOWRO local server: http://${host}:${process.env.PORT || 8787}`,
    ),
  );
  process.on("SIGTERM", () =>
    server.close(() => {
      store.close();
      process.exit(0);
    }),
  );
}
