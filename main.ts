// Leonida Trophy Atlas — hand-in program for gta6-trophy-guide-01 (program/v1,
// Node 22, standard library only).
//
// The guide is app/: static files a browser opens at app/index.html, with no
// build step and no network at run time. This program does two things and
// nothing else:
//
//   1. copies app/ and screenshots/ from beside this file into the output
//      directory — /output inside the grader, or $MAKEFUN_OUTPUT_DIR if set;
//   2. writes dossier.json into that directory with buildDossier from the kit's
//      own vendor/makefun-frontend.ts — the same library, untouched, so the
//      scorer's rebuild of the dossier matches this file byte for byte.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps handed to buildDossier below are the scorer's (competition.yaml):
// they refuse an entry the gate would refuse, and text_max_bytes is the one
// that shapes the dossier's text. Keeping them in named constants rather than
// inline literals means a cap change is a one-line edit here. They are passed
// straight through — this file never counts bytes or drops a screenshot itself,
// so what the gate sees and what buildDossier enforces cannot disagree.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const TEXT_MAX_BYTES = 163840;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;

/**
 * Copy a directory tree, creating the target, and return the paths copied.
 *
 * Entries are read in sorted order so the returned list (and therefore the
 * count printed at the end) is stable between runs. Empty directories are
 * recreated as they are met; symlinks are not followed, and anything that is
 * neither a directory nor a regular file is skipped. The returned paths are
 * relative to `from`, which keeps the printed summary short and independent of
 * where the output directory happens to live.
 */
function copyTree(from: string, to: string): string[] {
  const copied: string[] = [];
  const walk = (sourceDir: string, targetDir: string) => {
    mkdirSync(targetDir, { recursive: true });
    for (const entry of readdirSync(sourceDir).sort()) {
      const source = join(sourceDir, entry);
      const target = join(targetDir, entry);
      const stats = statSync(source);
      if (stats.isDirectory()) {
        walk(source, target);
      } else if (stats.isFile()) {
        copyFileSync(source, target);
        copied.push(relative(from, source));
      }
    }
  };
  walk(from, to);
  return copied;
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(out, { recursive: true });

const appFiles = copyTree(join(here, 'app'), join(out, 'app'));
const shotDir = join(here, 'screenshots');
const shotFiles = existsSync(shotDir) ? copyTree(shotDir, join(out, 'screenshots')) : [];

const dossierPath = join(out, 'dossier.json');
const dossier = buildDossier(out, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: SCREENSHOT_MAX, max_bytes: SCREENSHOT_MAX_BYTES },
  app_max_files: APP_MAX_FILES,
  app_max_bytes: APP_MAX_BYTES,
});
writeFileSync(dossierPath, dossier);

console.log(
  `Leonida Trophy Atlas handed in: ${appFiles.length} app files, ` +
    `${shotFiles.length} screenshots, dossier ${dossier.length} bytes -> ${dossierPath}`,
);
