import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../server/store.mjs";
import { AuthService } from "../server/auth.mjs";
import {
  testPayment,
  claimReward,
  rewardProgress,
} from "../server/rewards.mjs";
import {
  createBackup,
  verifyBackup,
  restoreBackup,
} from "../server/backups.mjs";

test("live WAL snapshot restores wallet, single reward and consumed payment protections, and auth encryption key", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nowro-backup-test-"));
  const original = new Store(join(directory, "source.sqlite"));
  let restored;
  try {
    const admin = original.setPreviewRole(original.session(), "admin"),
      user = original.session();
    original.issue(user, "coffee-g");
    for (const placeId of ["h-cafe", "g-cafe", "s-cafe", "y-cafe"]) {
      const p = testPayment(original, admin, {
        placeId,
        reference: crypto.randomUUID(),
        amount: 7000,
      });
      original.stamp(user, original.challenge(admin, placeId, p.id).token);
    }
    claimReward(original, user, { choice: "discount" });
    const auth = new AuthService(original, { env: {} });
    original.db
      .prepare("INSERT INTO auth_accounts VALUES (?,?,?)")
      .run("provider-user-test", user.user_id, "example@example.com");
    original.db
      .prepare("INSERT INTO auth_tokens VALUES (?,?)")
      .run(
        user.id,
        auth.encode({ refresh_token: "test-secret", expires_at: 100 }),
      );
    const snapshot = await createBackup(
      join(directory, "source.sqlite"),
      join(directory, "backups"),
    );
    await verifyBackup(snapshot.directory);
    const target = join(directory, "restore.sqlite");
    await restoreBackup(snapshot.directory, target);
    restored = new Store(target);
    const recovered = restored.session(user.id);
    assert.equal(recovered.user_id, user.user_id);
    assert.equal(restored.wallet(recovered).vouchers.length, 1);
    assert.equal(rewardProgress(restored, recovered).completedAreas.length, 4);
    assert.equal(rewardProgress(restored, recovered).order.choice, "discount");
    assert.throws(() =>
      claimReward(restored, recovered, { choice: "discount" }),
    );
    assert.equal(
      restored.db.prepare("SELECT COUNT(*) n FROM consumed_payments").get().n,
      4,
    );
    const restoredAuth = new AuthService(restored, { env: {} });
    assert.equal(
      restoredAuth.decode(
        restored.db
          .prepare("SELECT data FROM auth_tokens WHERE session_id=?")
          .get(user.id).data,
      ).refresh_token,
      "test-secret",
    );
    await assert.rejects(restoreBackup(snapshot.directory, target), {
      code: "EEXIST",
    });
    assert.equal(restored.wallet(recovered).vouchers.length, 1);
  } finally {
    restored?.close();
    original.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("tampered backup fails before creating a restore target", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nowro-backup-tamper-"));
  const original = new Store(join(directory, "source.sqlite"));
  try {
    const snapshot = await createBackup(
      join(directory, "source.sqlite"),
      join(directory, "backups"),
    );
    const file = join(snapshot.directory, "nowro.sqlite"),
      contents = await readFile(file);
    contents[100] ^= 1;
    await writeFile(file, contents);
    const target = join(directory, "restore.sqlite");
    await assert.rejects(
      restoreBackup(snapshot.directory, target),
      /BACKUP_CHECKSUM_FAILED/,
    );
    await assert.rejects(readFile(target), { code: "ENOENT" });
  } finally {
    original.close();
    await rm(directory, { recursive: true, force: true });
  }
});
