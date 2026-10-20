import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, lstatSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve('.');
const out = resolve('.data/lovable-handoff', 'nowro-' + Date.now());
mkdirSync(out, { recursive: true });
const baseline = [];
function copy(source, target) {
  const info = lstatSync(source);
  if (info.isSymbolicLink()) throw new Error('Linked files are not allowed in the handoff');
  if (info.isDirectory()) {
    mkdirSync(target, { recursive: true });
    for (const entry of readdirSync(source)) copy(join(source, entry), join(target, entry));
  } else {
    copyFileSync(source, target);
    baseline.push({ path: relative(root, source).replaceAll('\\', '/'), sha256: createHash('sha256').update(readFileSync(source)).digest('hex') });
  }
}
for (const dir of ['src', 'shared', 'public']) copy(resolve(dir), join(out, dir));
for (const file of ['index.html', 'tsconfig.json', 'package.json', 'package-lock.json']) copy(resolve(file), join(out, file));
copyFileSync('scripts/lovable-design-api.txt', join(out, 'src/api.ts'));
const pkg = JSON.parse(readFileSync(join(out, 'package.json'), 'utf8'));
pkg.name = 'nowro-design-handoff';
pkg.scripts = { dev: 'vite --host 0.0.0.0 --port 8080', build: 'tsc --noEmit && vite build', preview: 'vite preview --host 0.0.0.0 --port 8080' };
writeFileSync(join(out, 'package.json'), JSON.stringify(pkg, null, 2));
const lock = JSON.parse(readFileSync(join(out, 'package-lock.json'), 'utf8'));
lock.name = pkg.name; lock.packages[''].name = pkg.name;
writeFileSync(join(out, 'package-lock.json'), JSON.stringify(lock, null, 2));
writeFileSync(join(out, 'vite.config.ts'), 'import {defineConfig} from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({plugins:[react()],server:{host:"0.0.0.0",port:8080}});\n');
// A sandbox must not install a service worker that outlives the design preview.
const main = readFileSync(join(out, 'src/main.tsx'), 'utf8');
const registration = main.indexOf('if (import.meta.env.PROD && "serviceWorker" in navigator)');
if (registration < 0) throw new Error('Review service worker registration before exporting');
writeFileSync(join(out, 'src/main.tsx'), main.slice(0, registration));
let translations = readFileSync(join(out, 'src/i18n.ts'), 'utf8');
translations = translations.replace('Development preview · Sample places and benefits. Not valid for on-site use.', 'DESIGN SANDBOX · Sample data only. No live login, payments, stamps or orders.');
writeFileSync(join(out, 'src/i18n.ts'), translations);
writeFileSync(join(out, '.gitignore'), 'node_modules/\ndist/\n.env\n.env.*\n');
writeFileSync(join(out, 'DESIGN_HANDOFF.md'), `# NOWRO design editing handoff\n\nThis is an editable copy of the existing NOWRO React/TypeScript mobile web app, not a new product or a backend migration. Preserve its screen inventory, Korean/English support, 16 Busan districts, existing supplied logo and photo assets. Use charcoal #172026, lime #C5F542, white #FFFFFF, blue #087DA7 and warm white #F7FAF5. English is the default. Main navigation: Home, Explore, Saved, Offers & Shop, Stamps. Preserve merchant product/service forms and four-region completion reward (goods OR discount).\n\nStart by rendering the supplied UI faithfully so the owner can edit its design. Changes should focus on layout, spacing, typography, component presentation and responsive mobile UX. Do not invent verified businesses or remove sample/AI-image labels.\n\nNo credentials or real database records are included. The sandbox api.ts serves synthetic/public catalogue fixtures and makes no network requests. Do not enable Cloud, replace authentication, create payment integrations, migrate data, publish publicly or request service keys. Partner/admin choices are mock UI previews only.\n\n## Return to Codex\nAfter design editing, tell Codex the Lovable project URL. Codex can read files through the connected Lovable tools and compare them with HANDOFF_BASELINE.json. ZIP export or Git sync is optional. Preserve this document. Do not merge the sandbox src/api.ts, package/lockfile, vite config, main.tsx service-worker changes or demo i18n banner into production. Keep the original server/, Supabase auth, wallet, paid QR, reward validation and privacy controls. Review UI edits before bringing them back.\n`);
writeFileSync(join(out, 'HANDOFF_BASELINE.json'), JSON.stringify({ kind: 'NOWRO design-only round trip', preparedAt: new Date().toISOString(), originalFiles: baseline, sandboxOnly: ['src/api.ts', 'src/main.tsx', 'src/i18n.ts', 'package.json', 'package-lock.json', 'vite.config.ts'] }, null, 2));
console.log(out);
