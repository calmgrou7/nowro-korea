import { createClient } from "@supabase/supabase-js";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
} from "node:crypto";
import { ServiceError } from "./store.mjs";
export class AuthService {
  constructor(store, { env = process.env, clientFactory } = {}) {
    this.store = store;
    this.pending = new Map();
    this.attempts = new Map();
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS auth_accounts(auth_id TEXT PRIMARY KEY,user_id TEXT NOT NULL UNIQUE REFERENCES users(id),email TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS auth_tokens(session_id TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,data TEXT NOT NULL);`);
    this.key = Buffer.from(
      hkdfSync(
        "sha256",
        Buffer.from(store.secret),
        Buffer.from("nowro-auth"),
        "session-tokens",
        32,
      ),
    );
    this.enabled = !!(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY);
    this.redirect = env.PUBLIC_APP_URL || null;
    if (this.redirect) {
      const u = new URL(this.redirect);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.search ||
        u.hash ||
        u.pathname !== "/"
      )
        throw new Error("INVALID_PUBLIC_APP_URL");
      this.redirect = u.origin + "/";
    }
    if (this.enabled) {
      const u = new URL(env.SUPABASE_URL);
      if (
        u.protocol !== "https:" ||
        u.username ||
        u.password ||
        u.pathname !== "/"
      )
        throw new Error("INVALID_AUTH_URL");
    }
    this.clientFactory =
      clientFactory ||
      (() =>
        createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
          global: {
            fetch: (url, options) =>
              fetch(url, { ...options, signal: AbortSignal.timeout(12000) }),
          },
        }));
  }
  encode(value) {
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", this.key, iv),
      out = Buffer.concat([
        cipher.update(JSON.stringify(value)),
        cipher.final(),
      ]);
    return Buffer.concat([iv, cipher.getAuthTag(), out]).toString("base64");
  }
  decode(value) {
    const b = Buffer.from(value, "base64"),
      cipher = createDecipheriv("aes-256-gcm", this.key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([cipher.update(b.subarray(28)), cipher.final()]).toString(),
    );
  }
  require() {
    if (!this.enabled) throw new ServiceError("AUTH_NOT_CONFIGURED", 503);
  }
  async provider(call) {
    let result;
    try {
      result = await call();
    } catch {
      throw new ServiceError("AUTH_PROVIDER_UNAVAILABLE", 503);
    }
    const error = result?.error;
    if (
      error &&
      (error.name === "AuthRetryableFetchError" ||
        error.status === 0 ||
        error.status >= 500)
    )
      throw new ServiceError("AUTH_PROVIDER_UNAVAILABLE", 503);
    if (error?.status === 429) throw new ServiceError("RATE_LIMIT", 429);
    return result;
  }
  email(value) {
    if (
      typeof value !== "string" ||
      value.length > 254 ||
      !/^\S+@\S+\.\S+$/.test(value.trim())
    )
      throw new ServiceError("INVALID_EMAIL");
    return value.trim().toLowerCase();
  }
  async request(s, body) {
    this.require();
    if (s.role !== "traveler" || this.account(s))
      throw new ServiceError("ALREADY_SIGNED_IN", 409);
    const email = this.email(body.email);
    this.limit(email, "send", 1, 60000);
    const { error } = await this.provider(() =>
      this.clientFactory().auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          ...(this.redirect ? { emailRedirectTo: this.redirect } : {}),
        },
      }),
    );
    if (error)
      throw new ServiceError(
        "AUTH_SEND_FAILED",
        error.status === 429 ? 429 : 502,
      );
    return { sent: true };
  }
  account(s) {
    return (
      this.store.db
        .prepare("SELECT auth_id,email FROM auth_accounts WHERE user_id=?")
        .get(s.user_id) || null
    );
  }
  limit(email, kind, max, window) {
    const now = Date.now();
    for (const [key, b] of this.attempts)
      if (b.until < now) this.attempts.delete(key);
    const key = kind + email,
      b = this.attempts.get(key) || { until: now + window, n: 0 };
    if (++b.n > max) throw new ServiceError("RATE_LIMIT", 429);
    this.attempts.set(key, b);
  }
  async verify(s, body) {
    this.require();
    if (s.role !== "traveler" || this.account(s))
      throw new ServiceError("ALREADY_SIGNED_IN", 409);
    const email = this.email(body.email);
    if (typeof body.code !== "string" || !/^\d{6,10}$/.test(body.code))
      throw new ServiceError("INVALID_AUTH_CODE");
    this.limit(email, "verify", 10, 600000);
    const client = this.clientFactory();
    const { data, error } = await this.provider(() =>
      client.auth.verifyOtp({
        email,
        token: body.code,
        type: "email",
      }),
    );
    if (error || !data.session)
      throw new ServiceError("AUTH_CODE_REJECTED", 401);
    const check = await this.provider(() =>
      client.auth.getUser(data.session.access_token),
    );
    const user = check.data?.user;
    if (
      check.error ||
      !user?.email_confirmed_at ||
      user.is_anonymous ||
      user.email?.toLowerCase() !== email ||
      !user.id
    )
      throw new ServiceError("AUTH_USER_REJECTED", 401);
    return this.commit(s, user, data.session);
  }
  async oauth(s, body) {
    this.require();
    if (s.role !== "traveler" || this.account(s))
      throw new ServiceError("ALREADY_SIGNED_IN", 409);
    if (typeof body?.accessToken !== "string" || body.accessToken.length < 20)
      throw new ServiceError("AUTH_TOKEN_REJECTED", 401);
    const checked = await this.provider(() =>
      this.clientFactory().auth.getUser(body.accessToken),
    );
    const user = checked.data?.user;
    if (checked.error || !user?.id || !user.email || user.is_anonymous)
      throw new ServiceError("AUTH_TOKEN_REJECTED", 401);
    return this.commit(s, user, { access_token: body.accessToken, refresh_token: body.refreshToken || "", expires_at: Math.floor(Date.now() / 1000) + 3600 });
  }
  linkTokens(body) {
    for (const field of ["access_token", "refresh_token"])
      if (
        typeof body[field] !== "string" ||
        body[field].length < 10 ||
        body[field].length > 10000
      )
        throw new ServiceError("AUTH_LINK_REJECTED", 401);
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    };
  }
  async linkUser(body) {
    this.require();
    const tokens = this.linkTokens(body);
    const checked = await this.provider(() =>
      this.clientFactory().auth.getUser(tokens.access_token),
    );
    const user = checked.data?.user;
    if (
      checked.error ||
      !user?.id ||
      !user.email ||
      !user.email_confirmed_at ||
      user.is_anonymous
    )
      throw new ServiceError("AUTH_LINK_REJECTED", 401);
    return user;
  }
  async previewLink(s, body) {
    if (s.role !== "traveler") throw new ServiceError("TRAVELER_REQUIRED", 403);
    const user = await this.linkUser(body);
    if (this.account(s) && this.account(s).auth_id !== user.id)
      throw new ServiceError("ACCOUNT_LINK_MISMATCH", 409);
    return { email: this.email(user.email) };
  }
  async verifyLink(s, body) {
    if (s.role !== "traveler") throw new ServiceError("TRAVELER_REQUIRED", 403);
    const user = await this.linkUser(body);
    if (
      this.email(body.email) !== this.email(user.email) ||
      (this.account(s) && this.account(s).auth_id !== user.id)
    )
      throw new ServiceError("ACCOUNT_LINK_MISMATCH", 409);
    const refreshed = await this.provider(() =>
      this.clientFactory().auth.refreshSession({
        refresh_token: body.refresh_token,
      }),
    );
    if (refreshed.error || !refreshed.data?.session)
      throw new ServiceError("AUTH_LINK_REJECTED", 401);
    const checked = await this.provider(() =>
      this.clientFactory().auth.getUser(refreshed.data.session.access_token),
    );
    if (
      checked.error ||
      checked.data?.user?.id !== user.id ||
      !checked.data.user.email_confirmed_at ||
      checked.data.user.is_anonymous
    )
      throw new ServiceError("AUTH_LINK_REJECTED", 401);
    return this.commit(s, checked.data.user, refreshed.data.session);
  }
  commit(s, user, session) {
    const email = this.email(user.email);
    return this.store.tx(() => {
      const existing = this.store.db
        .prepare("SELECT user_id FROM auth_accounts WHERE auth_id=?")
        .get(user.id);
      const target = existing?.user_id || s.user_id;
      if (target !== s.user_id) {
        if (
          this.store.db
            .prepare(
              "SELECT 1 FROM reward_orders a JOIN reward_orders b ON a.campaign_id=b.campaign_id WHERE a.user_id=? AND b.user_id=?",
            )
            .get(s.user_id, target)
        )
          throw new ServiceError("ACCOUNT_REWARD_CONFLICT", 409);
        // Used coupons must stay used when the same coupon exists in both wallets.
        this.store.db
          .prepare(
            "UPDATE vouchers SET status='used',redeemed=COALESCE(redeemed,(SELECT g.redeemed FROM vouchers g WHERE g.user_id=? AND g.coupon_id=vouchers.coupon_id)) WHERE user_id=? AND coupon_id IN (SELECT coupon_id FROM vouchers WHERE user_id=? AND status='used')",
          )
          .run(s.user_id, target, s.user_id);
        // Preserve verified payment proof when a guest paid stamp overlaps an old unverified member stamp.
        const proofs = this.store.db
          .prepare(
            "SELECT g.id guest_id,t.id target_id,g.created FROM stamps g JOIN stamps t ON g.place_id=t.place_id JOIN stamp_payments p ON p.stamp_id=g.id WHERE g.user_id=? AND t.user_id=? AND NOT EXISTS (SELECT 1 FROM stamp_payments x WHERE x.stamp_id=t.id)",
          )
          .all(s.user_id, target);
        for (const proof of proofs) {
          this.store.db
            .prepare("UPDATE stamp_payments SET stamp_id=? WHERE stamp_id=?")
            .run(proof.target_id, proof.guest_id);
          this.store.db
            .prepare("UPDATE stamps SET created=? WHERE id=?")
            .run(proof.created, proof.target_id);
        }
        for (const table of [
          "trips",
          "vouchers",
          "stamps",
          "reward_orders",
          "consent",
          "events",
        ]) {
          this.store.db
            .prepare(`UPDATE OR IGNORE ${table} SET user_id=? WHERE user_id=?`)
            .run(target, s.user_id);
          this.store.db
            .prepare(`DELETE FROM ${table} WHERE user_id=?`)
            .run(s.user_id);
        }
      }
      if (!existing)
        this.store.db
          .prepare("INSERT INTO auth_accounts VALUES (?,?,?)")
          .run(user.id, target, email);
      else
        this.store.db
          .prepare("UPDATE auth_accounts SET email=? WHERE auth_id=?")
          .run(email, user.id);
      // Rotate the local cookie after authentication; never trust role metadata from the browser/provider user metadata.
      const sid = randomBytes(32).toString("hex");
      this.store.db
        .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
        .run(sid, target, s.guest_id, Date.now() + 7 * 86400000);
      this.store.db.prepare("DELETE FROM sessions WHERE id=?").run(s.id);
      this.store.db
        .prepare("INSERT INTO auth_tokens VALUES (?,?)")
        .run(sid, this.encode(session));
      this.store.audit(target, "account_login", {});
      return this.store.session(sid);
    });
  }
  async resolve(s) {
    if (!this.account(s)) return s;
    this.require();
    if (!this.pending.has(s.id)) {
      const run = this.validate(s);
      this.pending.set(s.id, run);
      run.finally(() => this.pending.delete(s.id)).catch(() => {});
    }
    return this.pending.get(s.id);
  }
  async validate(s) {
    const row = this.store.db
      .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
      .get(s.id);
    if (!row) throw new ServiceError("AUTH_SESSION_EXPIRED", 401);
    const client = this.clientFactory();
    let token = this.decode(row.data);
    if (token.expires_at * 1000 < Date.now() + 30000) {
      const refreshed = await this.provider(() =>
        client.auth.refreshSession({
          refresh_token: token.refresh_token,
        }),
      );
      if (refreshed.error || !refreshed.data.session)
        throw new ServiceError("AUTH_SESSION_EXPIRED", 401);
      token = refreshed.data.session;
      this.store.db
        .prepare("UPDATE auth_tokens SET data=? WHERE session_id=?")
        .run(this.encode(token), s.id);
    }
    const checked = await this.provider(() =>
      client.auth.getUser(token.access_token),
    );
    if (
      checked.error ||
      checked.data?.user?.id !== this.account(s).auth_id ||
      !checked.data.user.email_confirmed_at
    )
      throw new ServiceError("AUTH_SESSION_EXPIRED", 401);
    return this.store.session(s.id);
  }
  async logout(s) {
    const row = this.store.db
      .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
      .get(s.id);
    if (row && this.enabled) {
      try {
        const t = this.decode(row.data);
        await this.clientFactory().auth.admin.signOut(t.access_token, "local");
      } catch {
        /* Local cookie revocation still takes effect. */
      }
    }
    this.store.db.prepare("DELETE FROM sessions WHERE id=?").run(s.id);
    return this.store.session();
  }
}
