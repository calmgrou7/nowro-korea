import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.mjs";
import { AuthService } from "../server/auth.mjs";
import { createApp } from "../server/index.mjs";
import { testPayment, rewardProgress } from "../server/rewards.mjs";
import { parseAuthLink } from "../shared/auth-link.ts";
function fixture() {
  const store = new Store(),
    users = new Map(),
    sessions = new Map();
  let revoked = false,
    refreshes = 0,
    outage = null;
  const clientFactory = () => ({
    auth: {
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async ({ email, token }) => {
        if (token !== "123456") return { data: {}, error: {} };
        if (!users.has(email))
          users.set(email, {
            id: crypto.randomUUID(),
            email,
            email_confirmed_at: new Date().toISOString(),
            user_metadata: { role: "admin" },
          });
        const session = {
          access_token: "access-" + email,
          refresh_token: "refresh-" + email,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
        sessions.set(session.access_token, users.get(email));
        return { data: { session }, error: null };
      },
      getUser: async (token) => {
        if (outage === "throw") throw new TypeError("network unavailable");
        if (outage)
          return {
            data: {},
            error: { name: "AuthRetryableFetchError", status: 503 },
          };
        return {
          data: { user: revoked ? null : sessions.get(token) },
          error: revoked ? {} : null,
        };
      },
      refreshSession: async ({ refresh_token }) => {
        refreshes++;
        if (outage)
          return {
            data: {},
            error: { name: "AuthRetryableFetchError", status: 0 },
          };
        return {
          data: {
            session: {
              access_token: refresh_token.replace("refresh-", "access-"),
              refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        };
      },
      admin: { signOut: async () => ({ error: null }) },
    },
  });
  const auth = new AuthService(store, {
    env: {
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "publishable-test",
    },
    clientFactory,
  });
  return {
    store,
    auth,
    revoke: () => (revoked = true),
    outage: (mode) => (outage = mode),
    refreshCount: () => refreshes,
  };
}

test("email-link preview verifies identity without logging in; confirmation rotates cookie and rejects mixed identities", async () => {
  const f = fixture();
  const server = createApp(f.store, { auth: f.auth });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const member = await f.auth.verify(f.store.session(), {
      email: "link@example.com",
      code: "123456",
    });
    const other = await f.auth.verify(f.store.session(), {
      email: "other@example.com",
      code: "123456",
    });
    const tokens = f.auth.decode(
      f.store.db
        .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
        .get(member.id).data,
    );
    const otherTokens = f.auth.decode(
      f.store.db
        .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
        .get(other.id).data,
    );
    const guest = f.store.session();
    f.store.issue(guest, "coffee-g");
    assert.deepEqual(await f.auth.previewLink(guest, tokens), {
      email: "link@example.com",
    });
    assert.equal(f.auth.account(guest), null);
    await assert.rejects(
      f.auth.previewLink(guest, {
        access_token: "forged-access-token",
        refresh_token: "forged-refresh-token",
      }),
      /AUTH_LINK_REJECTED/,
    );
    await assert.rejects(
      f.auth.verifyLink(guest, { ...tokens, email: "other@example.com" }),
      /ACCOUNT_LINK_MISMATCH/,
    );
    await assert.rejects(
      f.auth.verifyLink(guest, {
        ...tokens,
        refresh_token: otherTokens.refresh_token,
        email: "link@example.com",
      }),
      /AUTH_LINK_REJECTED/,
    );
    assert.equal(f.auth.account(guest), null);
    const endpoint = `http://127.0.0.1:${server.address().port}/api/auth/link-confirm`;
    assert.equal(
      (await fetch(endpoint, { method: "POST", body: "{}" })).status,
      403,
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Cookie: `nowro=${guest.id}`,
        "Content-Type": "application/json",
        "X-NOWRO-Request": "1",
      },
      body: JSON.stringify({
        ...tokens,
        email: "link@example.com",
        role: "admin",
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { authenticated: true });
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    const signed = f.store.session(cookie.match(/nowro=([^;]+)/)[1]);
    assert.notEqual(signed.id, guest.id);
    assert.equal(signed.user_id, member.user_id);
    assert.equal(signed.role, "traveler");
    assert.equal(f.store.wallet(signed).vouchers.length, 1);
    await assert.rejects(
      f.auth.previewLink(signed, otherTokens),
      /ACCOUNT_LINK_MISMATCH/,
    );
    f.revoke();
    await assert.rejects(
      f.auth.previewLink(f.store.session(), tokens),
      /AUTH_LINK_REJECTED/,
    );
  } finally {
    await new Promise((r) => server.close(r));
    f.store.close();
  }
});

test("auth fragments support confirmation and login while rejecting errors, incomplete and recovery links", () => {
  assert.equal(parseAuthLink("#planner"), null);
  for (const type of ["signup", "magiclink", "email"]) {
    assert.deepEqual(
      parseAuthLink(
        `#access_token=access-test&refresh_token=refresh-test&type=${type}`,
      ),
      {
        error: false,
        access_token: "access-test",
        refresh_token: "refresh-test",
      },
    );
  }
  for (const hash of [
    "#error=access_denied&error_description=expired",
    "#access_token=incomplete",
    "#access_token=access-test&refresh_token=refresh-test&type=recovery",
  ]) {
    assert.deepEqual(parseAuthLink(hash), { error: true });
  }
});

test("guest account merge preserves a paid stamp overlapping a legacy unverified stamp and blocks payment replay", async () => {
  const f = fixture();
  try {
    const member = await f.auth.verify(f.store.session(), {
      email: "stamp@example.com",
      code: "123456",
    });
    f.store.db
      .prepare("INSERT INTO stamps VALUES (?,?,?,?)")
      .run(
        "legacy-test-stamp",
        member.user_id,
        "g-cafe",
        new Date().toISOString(),
      );
    assert.equal(rewardProgress(f.store, member).completedAreas.length, 0);
    const guest = f.store.session(),
      admin = f.store.setPreviewRole(f.store.session(), "admin");
    const payment = testPayment(f.store, admin, {
      placeId: "g-cafe",
      reference: "merge-proof",
      amount: 7000,
    });
    f.store.stamp(guest, f.store.challenge(admin, "g-cafe", payment.id).token);
    const merged = await f.auth.verify(guest, {
      email: "stamp@example.com",
      code: "123456",
    });
    assert.equal(merged.user_id, member.user_id);
    assert.equal(rewardProgress(f.store, merged).completedAreas.length, 1);
    assert.equal(
      f.store.db
        .prepare("SELECT COUNT(*) n FROM stamps WHERE user_id=?")
        .get(member.user_id).n,
      1,
    );
    assert.equal(
      f.store.db
        .prepare("SELECT stamp_id FROM stamp_payments WHERE payment_id=?")
        .get(payment.id).stamp_id,
      "legacy-test-stamp",
    );
    assert.throws(
      () => f.store.challenge(admin, "g-cafe", payment.id),
      /PAYMENT_ALREADY_STAMPED/,
    );
    assert.deepEqual(f.store.db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    f.store.close();
  }
});
test("OTP verification rotates cookies, ignores user role metadata, encrypts tokens, retains member data on guest expiry", async () => {
  const f = fixture();
  try {
    const guest = f.store.session();
    f.store.issue(guest, "coffee-g");
    await assert.rejects(
      f.auth.verify(guest, { email: "a@example.com", code: "000000" }),
      /AUTH_CODE_REJECTED/,
    );
    const member = await f.auth.verify(guest, {
      email: "a@example.com",
      code: "123456",
    });
    assert.notEqual(member.id, guest.id);
    assert.equal(member.role, "traveler");
    assert.equal(f.store.wallet(member).vouchers.length, 1);
    assert.ok(
      !f.store.db
        .prepare("SELECT data FROM auth_tokens")
        .get()
        .data.includes("refresh-"),
    );
    f.store.db
      .prepare("UPDATE sessions SET expires=0 WHERE id=?")
      .run(member.id);
    f.store.purge();
    assert.equal(
      f.store.db
        .prepare("SELECT COUNT(*) n FROM vouchers WHERE user_id=?")
        .get(member.user_id).n,
      1,
    );
    assert.equal(
      f.store.db.prepare("SELECT COUNT(*) n FROM auth_tokens").get().n,
      0,
    );
  } finally {
    f.store.close();
  }
});

test("provider outages deny access without clearing the account cookie or encrypted tokens; recovery restores access", async () => {
  const f = fixture(),
    server = createApp(f.store, { auth: f.auth });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const member = await f.auth.verify(f.store.session(), {
      email: "outage@example.com",
      code: "123456",
    });
    f.store.issue(member, "coffee-g");
    const endpoint = `http://127.0.0.1:${server.address().port}/api/status`;
    const headers = { Cookie: `nowro=${member.id}` };
    for (const failure of ["getUser", "throw", "refresh"]) {
      if (failure === "refresh") {
        const token = f.auth.decode(
          f.store.db
            .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
            .get(member.id).data,
        );
        token.expires_at = 1;
        f.store.db
          .prepare("UPDATE auth_tokens SET data=? WHERE session_id=?")
          .run(f.auth.encode(token), member.id);
      }
      f.outage(failure);
      const denied = await fetch(endpoint, { headers });
      assert.equal(denied.status, 503);
      assert.equal((await denied.json()).error, "AUTH_PROVIDER_UNAVAILABLE");
      assert.equal(denied.headers.get("set-cookie"), null);
      assert.ok(
        f.store.db.prepare("SELECT 1 FROM sessions WHERE id=?").get(member.id),
      );
      assert.ok(
        f.store.db
          .prepare("SELECT 1 FROM auth_tokens WHERE session_id=?")
          .get(member.id),
      );
      f.outage(null);
      const recovered = await fetch(endpoint, { headers });
      assert.equal(recovered.status, 200);
      assert.equal((await recovered.json()).session.authenticated, true);
      assert.equal(f.store.wallet(member).vouchers.length, 1);
    }
    f.revoke();
    const revoked = await fetch(endpoint, { headers });
    assert.equal((await revoked.json()).session.authenticated, false);
    assert.match(revoked.headers.get("set-cookie"), /nowro=/);
    assert.equal(
      f.store.db
        .prepare("SELECT 1 FROM auth_tokens WHERE session_id=?")
        .get(member.id),
      undefined,
    );
  } finally {
    await new Promise((r) => server.close(r));
    f.store.close();
  }
});
test("second device merges guest records, used coupon cannot become held, unrelated account remains isolated", async () => {
  const f = fixture();
  try {
    const first = f.store.session();
    f.store.issue(first, "coffee-g");
    const account = await f.auth.verify(first, {
      email: "a@example.com",
      code: "123456",
    });
    const second = f.store.session();
    const coupon = f.store.issue(second, "coffee-g");
    const partner = f.store.setPreviewRole(f.store.session(), "partner");
    f.store.redeem(partner, coupon.id, 7000);
    const merged = await f.auth.verify(second, {
      email: "a@example.com",
      code: "123456",
    });
    assert.equal(merged.user_id, account.user_id);
    assert.equal(f.store.wallet(merged).vouchers.length, 1);
    assert.equal(f.store.wallet(merged).vouchers[0].status, "used");
    const other = await f.auth.verify(f.store.session(), {
      email: "b@example.com",
      code: "123456",
    });
    assert.equal(f.store.wallet(other).vouchers.length, 0);
    const loggedOut = await f.auth.logout(merged);
    assert.notEqual(loggedOut.user_id, merged.user_id);
    assert.equal(f.auth.account(loggedOut), null);
  } finally {
    f.store.close();
  }
});
test("expiry refresh validates provider identity, revoked users fail closed, send limits span guest cookies", async () => {
  const f = fixture();
  try {
    const member = await f.auth.verify(f.store.session(), {
      email: "a@example.com",
      code: "123456",
    });
    const row = f.store.db
      .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
      .get(member.id);
    const token = f.auth.decode(row.data);
    token.expires_at = 1;
    f.store.db
      .prepare("UPDATE auth_tokens SET data=? WHERE session_id=?")
      .run(f.auth.encode(token), member.id);
    await f.auth.resolve(member);
    assert.equal(f.refreshCount(), 1);
    f.revoke();
    await assert.rejects(f.auth.resolve(member), /AUTH_SESSION_EXPIRED/);
    await f.auth.request(f.store.session(), { email: "c@example.com" });
    await assert.rejects(
      f.auth.request(f.store.session(), { email: "c@example.com" }),
      /RATE_LIMIT/,
    );
  } finally {
    f.store.close();
  }
});
test("HTTP auth cookies are HttpOnly, tokens never returned, CSRF and disabled provider are enforced", async () => {
  const f = fixture(),
    server = createApp(f.store, { preview: true, auth: f.auth });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const initial = await fetch(base + "/api/status");
    const cookie = initial.headers.get("set-cookie").split(";")[0];
    assert.equal((await initial.json()).session.authenticated, false);
    const denied = await fetch(base + "/api/auth/verify", {
      method: "POST",
      body: "{}",
    });
    assert.equal(denied.status, 403);
    const verified = await fetch(base + "/api/auth/verify", {
      method: "POST",
      headers: {
        Cookie: cookie,
        "X-NOWRO-Request": "1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "a@example.com",
        code: "123456",
        role: "admin",
      }),
    });
    assert.equal(verified.status, 200);
    assert.deepEqual(await verified.json(), { authenticated: true });
    assert.match(verified.headers.get("set-cookie"), /HttpOnly/);
    const signedCookie = verified.headers.get("set-cookie").split(";")[0];
    const status = await (
      await fetch(base + "/api/status", { headers: { Cookie: signedCookie } })
    ).json();
    assert.equal(status.session.role, "traveler");
    assert.equal(status.operatorPreview, false);
    assert.equal(
      (
        await fetch(base + "/api/preview-role", {
          method: "POST",
          headers: { Cookie: signedCookie, "X-NOWRO-Request": "1" },
          body: '{"role":"admin"}',
        })
      ).status,
      403,
    );
    const disabled = new AuthService(f.store, { env: {} });
    await assert.rejects(
      disabled.request(f.store.session(), { email: "test@example.com" }),
      /AUTH_NOT_CONFIGURED/,
    );
  } finally {
    await new Promise((r) => server.close(r));
    f.store.close();
  }
});
