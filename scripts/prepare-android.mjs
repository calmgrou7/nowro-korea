import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  androidAssociation,
  androidOrigin,
  validateAndroidPackage,
} from "../shared/android-app.mjs";

try {
  if (!process.argv[2])
    throw new Error(
      "Usage: npm run android:prepare -- android/release-config.json",
    );
  const config = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const origin = androidOrigin(config.origin);
  validateAndroidPackage(config.packageName);
  const links = config.sha256Fingerprints?.length
    ? androidAssociation(
        config.packageName,
        config.sha256Fingerprints.join(","),
      )
    : null;
  const out = resolve(".data/android", `release-${Date.now()}`);
  mkdirSync(out, { recursive: true });
  const manifestUrl = `${origin}/manifest.webmanifest`;
  const descriptor = {
    appName: "NOWRO Korea",
    packageName: config.packageName,
    origin,
    manifestUrl,
    bubblewrapVersion: "1.26.0",
    minimumTargetSdk: 36,
    hasPlaySigningCertificate: !!links,
    note: "Packaging inputs only. APK/AAB have not been built or submitted.",
  };
  writeFileSync(
    resolve(out, "release-inputs.json"),
    JSON.stringify(descriptor, null, 2),
  );
  if (links)
    writeFileSync(
      resolve(out, "assetlinks.json"),
      JSON.stringify(links, null, 2),
    );
  const commands = [
    "# Run in an empty Android project directory, after deploying the stable PWA.",
    "# Review SDK licenses and enter your own signing-key password when prompted.",
    `npx --yes @bubblewrap/cli@1.26.0 init --manifest="${manifestUrl}"`,
    `# Confirm application ID: ${config.packageName}`,
    "# Before building, verify targetSdkVersion >= 36 in the generated app/build.gradle.",
    "npx --yes @bubblewrap/cli@1.26.0 build",
    "# Expected outputs: app-release-signed.apk and app-release-bundle.aab",
  ].join("\n");
  writeFileSync(resolve(out, "build-android.ps1"), commands + "\n");
  console.log(`Android packaging inputs written to ${out}`);
  if (!links)
    console.log(
      "Domain verification is pending: configure the actual Google Play app-signing SHA-256 certificate, not a dummy or upload-key certificate.",
    );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
