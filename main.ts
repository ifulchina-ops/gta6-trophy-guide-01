// Leonida Trophy Atlas — the hand-in program for gta6-trophy-guide-01 (program/v1,
// Node 22, standard library only). The guide itself is this directory's app/
// folder: plain static files a browser opens at app/index.html — one ES module,
// one stylesheet, the trophy data in app/data/trophies.json — no build step and
// no network at run time. This program hands it in: it copies app/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json
// with the vendored make.fun library. Leave vendor/makefun-frontend.ts alone:
// the scorer requires dossier.json to be byte for byte what its own copy writes.
//
// Try the guide locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (competition.yaml, The gate). Only text_max_bytes shapes
// the bytes; the others refuse an entry the scorer would refuse — more than 4
// screenshots or one over 256 KiB, more than 993 files and directories in app/
// or 48 MiB of app files (app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json). The tree stays small: the guide's data is one
// JSON file, the app is three source files, and the screenshots are four JPEGs.
const dossierPath = join(out, 'dossier.json');
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(dossierPath, dossier);
console.log(`Leonida Trophy Atlas handed in: ${dossierPath}`);
