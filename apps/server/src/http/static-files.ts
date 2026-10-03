import { basename, extname, isAbsolute, posix } from 'node:path';
import { httpErrors } from '@fastify/sensible';
import type { FastifyInstance } from 'fastify';
import type { WebRootReader } from '../ports/web-root-reader.ts';

const SHELL = 'index.html';
const NO_CACHE = 'no-cache';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

const contentTypes: Record<string, string> = {
  avif: 'image/avif',
  css: 'text/css; charset=utf-8',
  gif: 'image/gif',
  html: 'text/html; charset=utf-8',
  ico: 'image/x-icon',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  map: 'application/json; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  otf: 'font/otf',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain; charset=utf-8',
  ttf: 'font/ttf',
  wasm: 'application/wasm',
  webmanifest: 'application/manifest+json; charset=utf-8',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml; charset=utf-8',
};

type StaticFile = {
  path: string;
  size: number;
  fallback: boolean;
};

function pathOnly(urlPath: string): string {
  return urlPath.split(/[?#]/, 1)[0] ?? '';
}

function decodePath(urlPath: string): string | null {
  try {
    const decoded = decodeURIComponent(pathOnly(urlPath));
    if (decoded.includes('\0')) return null;
    return decoded.replace(/\\/g, '/');
  } catch {
    return null;
  }
}

function requestedPath(urlPath: string): string | null {
  const decoded = decodePath(urlPath);
  if (decoded === null) return null;
  const requested =
    decoded === '' || decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const path = posix.normalize(requested.replace(/^\/+/, ''));
  return path === '..' || path.startsWith('../') || isAbsolute(path)
    ? null
    : path;
}

function isApiRequestPath(urlPath: string): boolean {
  const decoded = decodePath(urlPath);
  if (decoded === null) return false;
  const normalized = decoded.replace(/^\/+/, '/');
  return normalized === '/api' || normalized.startsWith('/api/');
}

function contentTypeForPath(filePath: string): string {
  const extension = extname(filePath).slice(1).toLowerCase();
  return contentTypes[extension] ?? 'application/octet-stream';
}

function isViteHashedAsset(urlPath: string): boolean {
  const decoded = decodePath(urlPath);
  if (decoded === null) return false;
  const name = basename(decoded);
  return /[-_.][A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(name);
}

function isClientRoute(urlPath: string): boolean {
  const decoded = decodePath(urlPath);
  if (decoded === null) return false;
  const normalized = decoded.replace(/^\/+/, '/');
  if (
    normalized === '/assets' ||
    normalized.startsWith('/assets/') ||
    normalized === '/api' ||
    normalized.startsWith('/api/')
  )
    return false;
  if (normalized === '/' || normalized.endsWith('/')) return true;
  return !basename(normalized).includes('.');
}

async function findStaticFile(
  files: WebRootReader,
  urlPath: string,
): Promise<StaticFile | null> {
  if (isApiRequestPath(urlPath)) return null;
  const path = requestedPath(urlPath);
  if (path === null) return null;

  const direct = await files.find({ path });
  if (direct) return { ...direct, fallback: false };
  if (await files.exists({ path })) return null;
  if (!isClientRoute(urlPath)) return null;

  const fallback = await files.find({ path: SHELL });
  return fallback ? { ...fallback, fallback: true } : null;
}

export function staticFiles(
  server: FastifyInstance,
  options: { files: WebRootReader },
) {
  server.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler: async (request, reply) => {
      const urlPath = request.raw.url ?? request.url;
      const file = await findStaticFile(options.files, urlPath);
      if (file === null) throw httpErrors.notFound();

      reply
        .header(
          'Cache-Control',
          !file.fallback && isViteHashedAsset(urlPath)
            ? IMMUTABLE_CACHE
            : NO_CACHE,
        )
        .header('Content-Length', String(file.size))
        .type(contentTypeForPath(file.path));
      if (request.method === 'HEAD') return reply.send();
      return reply.send(
        options.files.open({ path: file.path, size: file.size }),
      );
    },
  });
}
