// main.ts — the hand-in program for the Leonida Trophy Atlas
// (gta6-trophy-guide-01, program/v1: Node 22, standard library only).
//
// The guide itself is app/: plain static files, opened at app/index.html, with
// no build step and no network at run time. This program does exactly two
// things, and nothing else:
//
//   1. copies app/ and screenshots/ from beside this file into the output
//      directory — /output in the grader, $MAKEFUN_OUTPUT_DIR outside it;
//   2. writes dossier.json there with buildDossier, imported untouched from
//      vendor/makefun-frontend.ts, so the scorer's own rebuild of the dossier
//      from app/ and screenshots/ matches this one byte for byte.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The caps are named constants rather than literals at the call site: they are
// the scorer's own (text_max_bytes 163840, 4 screenshots of 262144 bytes, 993
// app entries, 48 MiB of app), and a cap change is then a one-line edit here.
// They are passed straight through. The copy above is unconditional — every
// app file and every screenshot goes over, and buildDossier decides what fits
// — because a second opinion written here could only disagree with the code
// the scorer runs, and a refusal is worth reading once, in the scorer's words.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const TEXT_MAX_BYTES = 163840;
const SCREENSHOT_MAX = 4;
const SCREENSHOT_MAX_BYTES = 262144;
const APP_MAX_FILES = 993;
const APP_MAX_BYTES = 50331648;

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = join(here, 'app');

// A missing app/ would otherwise reach buildDossier as an empty tree and come
// back as a cap complaint, which reads as the wrong problem: say what is
// missing, and by name, before the copy runs.
if (!existsSync(join(appSource, 'index.html'))) {
  throw new Error(`main.ts: no app/index.html under ${appSource}`);
}

/**
 * Copy a directory tree into `to`, creating directories as they are met, and
 * return every file copied as a path relative to `from`.
 *
 * Entries are read sorted so the run is stable: the grader runs this program
 * twice and both runs must write the same bytes, and the summary printed last
 * is then the same line both times. Symlinks are not followed and anything
 * that is neither a directory nor a regular file is skipped, so app/ goes over
 * as plain files only. Nothing is filtered by name, extension or size — the
 * caps are buildDossier's, and `to` is meant to be a faithful copy of `from`.
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

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(out, { recursive: true });

const appFiles = copyTree(appSource, join(out, 'app'));
const shotSource = join(here, 'screenshots');
const shotFiles = existsSync(shotSource) ? copyTree(shotSource, join(out, 'screenshots')) : [];

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
