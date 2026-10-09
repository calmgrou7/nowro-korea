import { spawn } from "node:child_process";
const opts = {
  stdio: "inherit",
  env: { ...process.env, ENABLE_LOCAL_OPERATOR_PREVIEW: "true" },
};
const api = spawn(
  process.execPath,
  ["--watch", "--env-file-if-exists=.env", "server/index.mjs"],
  opts,
);
const web = spawn(process.execPath, ["node_modules/vite/bin/vite.js"], opts);
function stop() {
  api.kill();
  web.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", () => web.kill());
web.on("exit", () => api.kill());
