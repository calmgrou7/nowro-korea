import {
  createBackup,
  verifyBackup,
  restoreBackup,
} from "../server/backups.mjs";
const [command, source, destination] = process.argv.slice(2);
try {
  let result;
  if (command === "create" && source && destination)
    result = await createBackup(source, destination);
  else if (command === "verify" && source && !destination)
    result = await verifyBackup(source);
  else if (command === "restore" && source && destination)
    result = await restoreBackup(source, destination);
  else
    throw new Error(
      "Usage: npm run db:backup -- create <database-file> <backup-directory> | verify <backup-folder> | restore <backup-folder> <NEW-database-file>",
    );
  console.info(JSON.stringify({ ok: true, ...result }, null, 2));
} catch (error) {
  console.error(
    error.code === "EEXIST"
      ? "RESTORE_TARGET_EXISTS: choose a new database file; existing data is never overwritten."
      : error.message,
  );
  process.exitCode = 1;
}
