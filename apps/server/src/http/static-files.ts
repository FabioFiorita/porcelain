import { createReadStream } from 'node:fs';
import { lstat, realpath, stat } from 'node:fs/promises';
import {
  basename,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import type { FastifyInstance } from 'fastify';

const noCache = 'no-cache';
const immutableCache = 'public, max-age=31536000, immutable';

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

function pathIsWithin(root: string, candidate: string): boolean {
  const child = relative(root, candidate);
  return (
    child === '' ||
    (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child))
  );
}

export function resolveStaticPath(
  root: string,
  urlPath: string,
): string | null {
  const decoded = decodePath(urlPath);
  if (decoded === null) return null;

  const requested =
    decoded === '' || decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const relativePath = requested.replace(/^\/+/, '');
  if (isAbsolute(relativePath)) return null;

  try {
    const resolvedRoot = resolve(root);
    const candidate = resolve(resolvedRoot, relativePath);
    return pathIsWithin(resolvedRoot, candidate) ? candidate : null;
  } catch {
    return null;
  }
}

function isApiRequestPath(urlPath: string): boolean {
  const decoded = decodePath(urlPath);
  if (decoded === null) return false;
  const normalized = decoded.replace(/^\/+/, '/');
  return normalized === '/api' || normalized.startsWith('/api/');
}

export function contentTypeForPath(filePath: string): string {
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

async function existingFile(
  root: string,
  candidate: string,
): Promise<{ path: string; size: number } | null> {
  let canonicalRoot: string;
  let canonicalCandidate: string;
  try {
    canonicalRoot = await realpath(root);
    canonicalCandidate = await realpath(candidate);
  } catch {
    return null;
  }
  if (!pathIsWithin(canonicalRoot, canonicalCandidate)) return null;
  try {
    const metadata = await stat(canonicalCandidate);
    return metadata.isFile()
      ? { path: canonicalCandidate, size: metadata.size }
      : null;
  } catch {
    return null;
  }
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await lstat(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findStaticFile(
  root: string,
  urlPath: string,
): Promise<StaticFile | null> {
  if (isApiRequestPath(urlPath)) return null;
  const candidate = resolveStaticPath(root, urlPath);
  if (candidate === null) return null;

  const direct = await existingFile(root, candidate);
  if (direct) return { ...direct, fallback: false };
  if (await pathExists(candidate)) return null;
  if (!isClientRoute(urlPath)) return null;

  const shell = resolveStaticPath(root, '/');
  if (shell === null) return null;
  const fallback = await existingFile(root, shell);
  return fallback ? { ...fallback, fallback: true } : null;
}

export function registerStaticFiles(
  server: FastifyInstance,
  options: { webRoot: string },
) {
  server.route({
    method: ['GET', 'HEAD'],
    url: '/*',
    handler: async (request, reply) => {
      const urlPath = request.raw.url ?? request.url;
      const file = await findStaticFile(options.webRoot, urlPath);
      if (file === null) return reply.code(404).send();

      reply
        .header(
          'Cache-Control',
          !file.fallback && isViteHashedAsset(urlPath)
            ? immutableCache
            : noCache,
        )
        .header('Content-Length', String(file.size))
        .type(contentTypeForPath(file.path));
      if (request.method === 'HEAD') return reply.send();
      return reply.send(createReadStream(file.path));
    },
  });
}
