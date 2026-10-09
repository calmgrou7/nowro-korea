import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = new URL("../public/", import.meta.url);
const brand = new URL("brand/", root);
await fs.mkdir(brand, { recursive: true });
const source = new URL("identity-reference.png", brand);
if (process.argv[2]) await fs.copyFile(process.argv[2], source);
// Extract the supplied artwork without recreating or changing its lettering.
await sharp(fileURLToPath(source))
  .extract({ left: 48, top: 159, width: 746, height: 182 })
  .webp({ lossless: true })
  .toFile(fileURLToPath(new URL("logo.webp", brand)));
const icon = await sharp(fileURLToPath(source))
  .extract({ left: 40, top: 425, width: 338, height: 333 })
  .png()
  .toBuffer();
for (const size of [32, 180, 192, 512]) {
  const filename =
    size === 32
      ? "favicon.png"
      : size === 180
        ? "apple-touch-icon.png"
        : `icon-${size}.png`;
  await sharp(icon)
    .resize(size, size, { fit: "contain", background: "#ffffff" })
    .png()
    .toFile(fileURLToPath(new URL(filename, root)));
}
console.log(
  "Supplied NOWRO artwork prepared for header, footer and app icons.",
);
