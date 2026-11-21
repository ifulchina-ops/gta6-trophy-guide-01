// main.ts — hand-in program for the Leonida Trophy Atlas
// (gta6-trophy-guide-01, program/v1: Node 22, standard library only).
//
// The atlas is app/: static files, opened at app/index.html, no build step and
// nothing fetched at run time. This program has exactly two jobs:
//
//   1. copy app/ and screenshots/ (both sitting beside this file) into the
//      output directory — /output under the grader, $MAKEFUN_OUTPUT_DIR when
//      that is set;
//   2. write dossier.json into that same directory with buildDossier, imported
//      untouched from vendor/makefun-frontend.ts, so the scorer's own rebuild
//      of the dossier from app/ and screenshots/ comes out byte-identical.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Caps live in one named table instead of literals at the call site: they are
// the scorer's own numbers (text_max_bytes 163840, 4 screenshots at 262144
// bytes each, 993 app entries, 48 MiB of app), so changing one is a one-line
// edit here. They are handed straight through. The copy is unconditional —
// every app file and every screenshot goes over and buildDossier decides what
// fits. A second opinion implemented here could only disagree with the code
// the scorer actually runs, and a refusal is worth reading once, in the
// scorer's own words.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

// The scorer's caps, named once. Passed through verbatim in buildDossier's
// own key spelling below.
const CAPS = {
  textMaxBytes: 163840,
  screenshotMax: 4,
  screenshotMaxBytes: 262144,
  appMaxFiles: 993,
  appMaxBytes: 50331648,
} as const;

const here = fileURLToPath(new URL('.', import.meta.url));
const appSource = join(here, 'app');
const shotSource = join(here, 'screenshots');

/** Where the copy lands: $MAKEFUN_OUTPUT_DIR when defined, else /output. */
function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

// Without this check a missing app/ would reach buildDossier as an empty tree
// and surface as a cap complaint — the wrong problem named. Say what is gone,
// by name, before any copying happens.
if (!existsSync(join(appSource, 'index.html'))) {
  throw new Error(`main.ts: no app/index.html under ${appSource}`);
}

/**
 * Copy the tree at `from` into `to`, making directories as they come up, and
 * return each copied file as a path relative to `from`.
 *
 * Directory entries are read in sorted order so two runs produce the same
 * bytes: the grader executes this program twice, and the summary line printed
 * at the end must match both times. Symlinks are not followed; anything that
 * is neither a directory nor a regular file is skipped, so app/ lands as plain
 * files only. No filtering by name, extension or size happens here — the caps
 * belong to buildDossier, and `to` is supposed to be a faithful copy of `from`.
 */
function copyTree(from: string, to: string): string[] {
  const copied: string[] = [];

  function walk(sourceDir: string, targetDir: string): void {
    mkdirSync(targetDir, { recursive: true });
    const entries = readdirSync(sourceDir).sort();
    for (const entry of entries) {
      const source = join(sourceDir, entry);
      const target = join(targetDir, entry);
      const info = statSync(source);
      if (info.isDirectory()) {
        walk(source, target);
      } else if (info.isFile()) {
        copyFileSync(source, target);
        copied.push(relative(from, source));
      }
    }
  }

  walk(from, to);
  return copied;
}

const out = outputDir();
mkdirSync(out, { recursive: true });

// Both trees go over whole; screenshots/ is optional so a checkout without it
// still hands in.
const appFiles = copyTree(appSource, join(out, 'app'));
const shotFiles = existsSync(shotSource) ? copyTree(shotSource, join(out, 'screenshots')) : [];

const dossier = buildDossier(out, {
  text_max_bytes: CAPS.textMaxBytes,
  screenshots: {
    max: CAPS.screenshotMax,
    max_bytes: CAPS.screenshotMaxBytes,
  },
  app_max_files: CAPS.appMaxFiles,
  app_max_bytes: CAPS.appMaxBytes,
});

const dossierPath = join(out, 'dossier.json');
writeFileSync(dossierPath, dossier);

console.log(
  `Leonida Trophy Atlas handed in: ${appFiles.length} app files, ` +
    `${shotFiles.length} screenshots, dossier ${dossier.length} bytes -> ${dossierPath}`,
);
