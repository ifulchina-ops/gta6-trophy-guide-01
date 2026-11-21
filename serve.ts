// serve.ts — a small static file server for the atlas (Node 22, no packages),
// so you can try the guide the way the grader's browser will: app/ as the site
// root, nothing else reachable.
//
//   node serve.ts             # http://localhost:8080
//   node serve.ts --port 8137 # another port
//
// It resolves the request path inside app/ and answers 403 for anything that
// climbs out of it, 404 for a missing file, and otherwise streams the file with
// the content type a browser needs. Development convenience only: no caching
// headers beyond no-store, no compression, no directory listing, no build step
// and no runtime dependency, so it runs on a bare Node 22. A directory path
// ending in "/" is served as that directory's index.html, which is why the
// bare root request works. Only GET and HEAD are accepted; everything else gets
// a 405 with an Allow header.
//
// The containment check is the part worth reading twice: the decoded pathname
// is normalised against the app root and then compared on the resolved absolute
// path with a trailing separator, so "/../serve.ts" and a sibling directory
// that merely shares the root's prefix both fail. Nothing is served from
// outside app/ — not this file, not the screenshots, not the kit.


import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** The port from `--port <n>`, or 8080 when the flag is absent or unusable. */
function readPort(argv: string[]): number {
  const index = argv.indexOf('--port');
  if (index === -1) return 8080;
  const asked = Number(argv[index + 1]);
  return Number.isInteger(asked) && asked > 0 && asked < 65536 ? asked : 8080;
}

/** Resolve a URL pathname to a file inside root, or null when it escapes. */
function resolveInside(root: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const wanted = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const file = resolve(join(root, normalize(wanted)));
  if (file === root) return null;
  if (!file.startsWith(root + sep)) return null;
  return file;
}

const root = resolve(fileURLToPath(new URL('./app', import.meta.url)));
const port = readPort(process.argv.slice(2));

const server = createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
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
    if (!stats.isFile()) throw new Error('not a regular file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  const type = MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  response.writeHead(200, {
    'content-type': type,
    'content-length': size,
    'cache-control': 'no-store',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Leonida Trophy Atlas is served from app/ at http://localhost:${port}`);
});
