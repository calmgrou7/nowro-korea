import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("PostgreSQL preparation schema: RLS, ownership, issuance caps and proof replay", async (t) => {
  const db = new PGlite();
  const a = "00000000-0000-4000-8000-000000000001",
    b = "00000000-0000-4000-8000-000000000002",
    partner = "00000000-0000-4000-8000-000000000003",
    other = "00000000-0000-4000-8000-000000000004",
    business = "00000000-0000-4000-8000-000000000005";
  const as = async (user) => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [
      user || "",
    ]);
    await db.exec(user ? "SET ROLE authenticated" : "SET ROLE anon");
  };
  try {
    await db.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
    );
    await db.exec(readFileSync("supabase/schema.sql", "utf8"));
    for (const id of [a, b, partner, other])
      await db.query("insert into auth.users values($1)", [id]);
    await db.exec(
      `insert into public.cities values('test','{"en":"Test"}',true);insert into public.areas values('a','test','{"en":"Area"}',35,129,true);`,
    );
    await db.query(
      "insert into public.businesses(id,name,verified) values($1,$2,true)",
      [business, "Test business"],
    );
    await db.query("insert into nowro_private.business_members values($1,$2)", [
      partner,
      business,
    ]);
    await db.query(
      "insert into public.places(id,area_id,business_id,korean_name,korean_address,category,cost_min,cost_max,stay_minutes,published,source) values('p','a',$1,'테스트','테스트','cafe',0,10000,30,true,'Test fixture')",
      [business],
    );
    await db.exec(
      "insert into public.coupons(id,place_id,benefit,terms,minimum_spend,valid_from,valid_until,issue_cap,redeem_cap,active,approved) values('c','p','{}','{}',7000,now()-interval '1 day',now()+interval '1 day',2,2,true,true)",
    );
    await t.test("all exposed tables have RLS enabled", async () => {
      const rows = await db.query(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
      );
      assert.deepEqual(rows.rows, []);
    });
    await t.test(
      "anonymous users see published catalog and cannot issue coupons",
      async () => {
        await as(null);
        assert.equal(
          (await db.query("select * from public.places")).rows.length,
          1,
        );
        await assert.rejects(
          db.query("select public.issue_coupon('c')"),
          /permission denied/,
        );
      },
    );
    let trip;
    await t.test(
      "traveler ownership blocks reads, edits and owner reassignment",
      async () => {
        await as(a);
        trip = (
          await db.query(
            "insert into public.trips(user_id,conditions,route_snapshot) values($1,'{}','{}') returning id",
            [a],
          )
        ).rows[0].id;
        await assert.rejects(
          db.query("update public.trips set user_id=$1 where id=$2", [b, trip]),
          /row-level security/,
        );
        await as(b);
        assert.equal(
          (await db.query("select * from public.trips")).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "delete from public.trips where id=$1 returning id",
              [trip],
            )
          ).rows.length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into public.trips(user_id,conditions,route_snapshot) values($1,'{}','{}')",
            [a],
          ),
          /row-level security/,
        );
      },
    );
    let issue;
    await t.test(
      "server function checks duplicate and cap; direct issuance denied",
      async () => {
        await as(a);
        issue = (await db.query("select public.issue_coupon('c') id")).rows[0]
          .id;
        await assert.rejects(
          db.query("select public.issue_coupon('c')"),
          /ALREADY_ISSUED/,
        );
        await assert.rejects(
          db.query(
            "insert into public.coupon_issues(coupon_id,user_id) values('c',$1)",
            [a],
          ),
          /permission denied/,
        );
        await as(b);
        await db.query("select public.issue_coupon('c')");
        await as(other);
        await assert.rejects(
          db.query("select public.issue_coupon('c')"),
          /SOLD_OUT/,
        );
        assert.equal(
          (await db.query("select * from public.coupon_issues")).rows.length,
          0,
        );
      },
    );
    await t.test(
      "partner redemption requires business ownership, spend and one-time use",
      async () => {
        await as(other);
        await assert.rejects(
          db.query("select public.redeem_coupon($1,7000)", [issue]),
          /FORBIDDEN/,
        );
        await as(partner);
        assert.equal(
          (await db.query("select * from public.trips")).rows.length,
          0,
        );
        assert.equal(
          (await db.query("select * from public.coupon_issues")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.redeem_coupon($1,6000)", [issue]),
          /MINIMUM_SPEND/,
        );
        await db.query("select public.redeem_coupon($1,7000)", [issue]);
        await assert.rejects(
          db.query("select public.redeem_coupon($1,7000)", [issue]),
          /ALREADY_REDEEMED/,
        );
      },
    );
    await t.test(
      "proof generation is partner-only and redemption resists replay",
      async () => {
        await as(a);
        await assert.rejects(
          db.query("select public.make_stamp_challenge('p')"),
          /FORBIDDEN/,
        );
        await as(partner);
        const proof = (
          await db.query("select public.make_stamp_challenge('p') token")
        ).rows[0].token;
        await as(a);
        await db.query("select public.claim_stamp($1)", [proof]);
        await as(b);
        await assert.rejects(
          db.query("select public.claim_stamp($1)", [proof]),
          /REPLAY_PROOF/,
        );
        assert.equal(
          (await db.query("select * from public.stamps")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select * from nowro_private.stamp_challenges"),
          /permission denied/,
        );
      },
    );
    await t.test(
      "proposal insert cannot self-approve and partner cannot publish directly",
      async () => {
        await as(partner);
        await assert.rejects(
          db.query(
            "insert into public.place_proposals(place_id,actor,patch,status) values('p',$1,'{}','approved')",
            [partner],
          ),
          /row-level security/,
        );
        await db.query(
          "insert into public.place_proposals(place_id,actor,patch) values('p',$1,'{}')",
          [partner],
        );
        await assert.rejects(
          db.query("update public.places set cost_max=99999 where id='p'"),
          /permission denied/,
        );
        await as(other);
        assert.equal(
          (await db.query("select * from public.place_proposals")).rows.length,
          0,
        );
      },
    );
  } finally {
    await db.close();
  }
});
