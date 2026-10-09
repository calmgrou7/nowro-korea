import { DatabaseSync, backup } from "node:sqlite";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  copyFile,
  constants,
} from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { createHash } from "node:crypto";

function inspect(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || Object.values(integrity[0])[0] !== "ok")
      throw new Error("BACKUP_INTEGRITY_FAILED");
    if (db.prepare("PRAGMA foreign_key_check").all().length)
      throw new Error("BACKUP_FOREIGN_KEY_FAILED");
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all();
    for (const required of [
      "users",
      "config",
      "auth_accounts",
      "auth_tokens",
      "listings",
      "payments",
      "consumed_payments",
      "reward_orders",
    ])
      if (!tables.some((t) => t.name === required))
        throw new Error("BACKUP_SCHEMA_INCOMPLETE");
    if (
      !db.prepare("SELECT value FROM config WHERE key='qr-secret'").get()?.value
    )
      throw new Error("BACKUP_KEY_MISSING");
    return Object.fromEntries(
      tables.map(({ name }) => [
        name,
        db
          .prepare(`SELECT COUNT(*) n FROM "${name.replaceAll('"', '""')}"`)
          .get().n,
      ]),
    );
  } finally {
    db.close();
  }
}
async function digest(file) {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

// Uses SQLite's online snapshot API; copying just a live .sqlite file can lose WAL changes.
export async function createBackup(source, directory) {
  const path = resolve(source);
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    await mkdir(resolve(directory), { recursive: true });
    const destination = await mkdtemp(join(resolve(directory), "nowro-"));
    const file = join(destination, "nowro.sqlite");
    await backup(db, file);
    const counts = inspect(file);
    const manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      sha256: await digest(file),
      counts,
    };
    await writeFile(
      join(destination, "manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      { flag: "wx", mode: 0o600 },
    );
    return { directory: destination, counts };
  } finally {
    db.close();
  }
}

export async function verifyBackup(directory) {
  const file = join(resolve(directory), "nowro.sqlite");
  const manifest = JSON.parse(
    await readFile(join(resolve(directory), "manifest.json"), "utf8"),
  );
  if (manifest.version !== 1 || manifest.sha256 !== (await digest(file)))
    throw new Error("BACKUP_CHECKSUM_FAILED");
  const counts = inspect(file);
  if (JSON.stringify(counts) !== JSON.stringify(manifest.counts))
    throw new Error("BACKUP_COUNTS_FAILED");
  return { file, counts };
}

// Restore exclusively into a NEW file. Switching the running server is a separate operation.
export async function restoreBackup(directory, target) {
  const checked = await verifyBackup(directory);
  const file = resolve(target);
  await mkdir(dirname(file), { recursive: true });
  await copyFile(checked.file, file, constants.COPYFILE_EXCL);
  inspect(file);
  return { file, counts: checked.counts };
}
