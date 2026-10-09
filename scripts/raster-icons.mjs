// Render the original NOWRO vector mark without opening a browser.
import { readFileSync, writeFileSync } from "node:fs";
import pngjs from "pngjs";
const { PNG } = pngjs;
const svg = readFileSync("public/icon.svg", "utf8");
const colors = [...svg.matchAll(/fill="(#[0-9a-f]{6})"/gi)].map((m) =>
  m[1]
    .slice(1)
    .match(/../g)
    .map((h) => parseInt(h, 16)),
);
const glyph = [
  [43, 143],
  [43, 49],
  [69, 49],
  [122, 106],
  [122, 49],
  [149, 49],
  [149, 143],
  [124, 143],
  [70, 84],
  [70, 143],
];
function inside(x, y) {
  let result = false;
  for (let i = 0, j = glyph.length - 1; i < glyph.length; j = i++) {
    const a = glyph[i],
      b = glyph[j];
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      result = !result;
  }
  return result;
}
for (const size of [192, 512]) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let alpha = 0,
        r = 0,
        g = 0,
        b = 0;
      for (const dx of [0.25, 0.75])
        for (const dy of [0.25, 0.75]) {
          const sx = ((x + dx) * 192) / size,
            sy = ((y + dy) * 192) / size;
          const cx = Math.max(46, Math.min(146, sx)),
            cy = Math.max(46, Math.min(146, sy));
          if ((sx - cx) ** 2 + (sy - cy) ** 2 > 46 ** 2) continue;
          const c = inside(sx, sy) ? colors[1] : colors[0];
          r += c[0];
          g += c[1];
          b += c[2];
          alpha++;
        }
      const i = (y * size + x) * 4;
      png.data[i] = alpha ? r / alpha : 0;
      png.data[i + 1] = alpha ? g / alpha : 0;
      png.data[i + 2] = alpha ? b / alpha : 0;
      png.data[i + 3] = (alpha * 255) / 4;
    }
  writeFileSync(`public/icon-${size}.png`, PNG.sync.write(png));
}
