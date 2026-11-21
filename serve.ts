// serve.ts — static file server for the atlas (Node 22, no packages), so the
// guide can be opened the way the finalist review opens it: app/ as the site
// root, with nothing outside app/ reachable.
//
//   node serve.ts             # http://localhost:8080
//   node serve.ts --port 8137 # another port
//
// Each request path is resolved inside app/. It is refused with 403 if it
// climbs out, answered 404 if the file is absent, and otherwise streamed back
// with the content type a browser needs. A path that ends in "/" is served as
// that directory's index.html, which is how the bare root request works. Only
// GET and HEAD get an answer; everything else receives 405 plus an Allow
// header.
//
// The containment check deserves the second read. The pathname is decoded,
// index.html is appended when it ends in a slash, then it is normalised,
// joined onto the root and resolved. The result has to start with the root
// followed by a separator. Comparing resolved absolute paths with that
// trailing separator in place is what rejects "/../serve.ts" and also a
// sibling directory whose name merely starts with the root's. Nothing outside
// app/ is ever served — not this file, not screenshots/, not the vendor copy.
//
// Development convenience only: no compression, no directory listing, no build
// step, no dependency, so it runs on a bare Node 22.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 8080;

// Only extensions app/ can actually hold: a data: URI carries fonts and
// images, so no font file is ever served from here. An extension missing from
// this table falls back to a plain byte stream rather than a guess.
const TYPES: Array<[string, string]> = [
  ['.html', 'text/html; charset=utf-8'],
  ['.htm', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
];

const MIME_TYPES: Record<string, string> = Object.fromEntries(TYPES);

/** The port from `--port <n>`; 8080 if the flag is absent or the value is bad. */
function readPort(argv: string[]): number {
  const at = argv.indexOf('--port');
  if (at === -1) {
    return DEFAULT_PORT;
  }
  const asked = Number(argv[at + 1]);
  const usable = Number.isInteger(asked) && asked > 0 && asked < 65536;
  return usable ? asked : DEFAULT_PORT;
}

/**
 * Turn a URL pathname into a file path inside root, or null when it escapes.
 *
 * A malformed percent-escape yields null as well: decodeURIComponent throws on
 * one, and a path that will not decode cannot be demonstrated to sit inside
 * the root.
 */
function resolveInside(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const wanted = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const resolved = resolve(join(root, normalize(wanted)));
  const inside = resolved !== root && resolved.startsWith(root + sep);
  return inside ? resolved : null;
}

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const port = readPort(process.argv.slice(2));

const server = createServer((request, response) => {
  const method = request.method;
  if (method !== 'GET' && method !== 'HEAD') {
    response.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
    return;
  }

  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const file = resolveInside(root, pathname);
  if (!file) {
    response.writeHead(403).end('forbidden');
    return;
  }

  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }

  const type = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const headers = {
    'content-type': type,
    'content-length': size,
    'cache-control': 'no-store',
  };
  response.writeHead(200, headers);

  if (method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Leonida Trophy Atlas is served from app/ at http://localhost:${port}`);
});
