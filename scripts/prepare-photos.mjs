import fs from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const out = new URL("../public/images/", import.meta.url);
await fs.mkdir(out, { recursive: true });
const photos = [
  ["gwangalli", "Gwangalli_Beach_and_Gwangan_Bridge_Busan.jpg"],
  ["haeundae", "Haeundae_beach_in_Busan.jpg"],
  ["yeongdo", "Huinnyeoul_culture_village,_Busan_on_October_25th,_2019.jpg"],
];
for (const [key, file] of photos) {
  if (await fs.stat(new URL(key + ".webp", out)).catch(() => null)) continue;
  const page = "https://commons.wikimedia.org/wiki/File:" + file;
  const response = await fetch(page);
  if (!response.ok) throw new Error(`${key}: ${response.status}`);
  const html = await response.text();
  const url = html.match(/class="fullImageLink"[\s\S]*?<a href="([^"]+)"/)?.[1];
  if (!url?.startsWith("https://upload.wikimedia.org/"))
    throw new Error("Original URL missing: " + key);
  let image = await fetch(url.replaceAll("&amp;", "&"));
  if (image.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 20000));
    image = await fetch(url.replaceAll("&amp;", "&"));
  }
  if (!image.ok) throw new Error(`${key} download: ${image.status}`);
  await sharp(Buffer.from(await image.arrayBuffer()))
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(fileURLToPath(new URL(key + ".webp", out)));
  console.log(key + " downloaded and optimized");
}
const generated = {
  cafe: "exec-2edfe33b-2549-4bce-96dc-87b62c8e3be3.png",
  food: "exec-78c5345b-e159-486f-b0f8-8ce3eb2989c6.png",
  experience: "exec-020f4043-79a5-4563-b37a-0741f0c00e58.png",
  culture: "exec-21ed2c8b-5b4f-4548-a281-fe93f8dac33a.png",
};
for (const [key, file] of Object.entries(generated)) {
  await sharp(
    "C:/Users/calmg/.codex/generated_images/01a109d2-ddaa-7300-88cd-775f5ce50552/" +
      file,
  )
    .resize({ width: 1200 })
    .webp({ quality: 82 })
    .toFile(fileURLToPath(new URL(key + ".webp", out)));
  console.log(key + " optimized");
}
