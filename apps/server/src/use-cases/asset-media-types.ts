import { extname } from 'node:path';

/**
 * What a preview may load. An extension that is not here is not readable
 * through either asset route, whatever the path: it is what keeps `.env`,
 * `.pem` and anything else unrecognised out of a preview even when it sits
 * beside the document.
 */
const mediaTypes: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export const assetMediaType = (path: string): string | undefined =>
  mediaTypes[extname(path).toLowerCase()];
