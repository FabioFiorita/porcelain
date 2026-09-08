import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

// The launcher supplies one disposable token file. Browser input never selects a file.
export function playgroundBridge(tokenFile: string) {
  return async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void,
  ) => {
    if (request.url !== '/__porcelain/playground') {
      next();
      return;
    }
    response.setHeader('Cache-Control', 'no-store');
    const host = request.headers.host ?? '';
    if (
      request.method !== 'POST' ||
      !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
      request.headers.origin !== `http://${host}` ||
      request.headers['x-porcelain-playground'] !== '1' ||
      (request.headers['sec-fetch-site'] !== undefined &&
        request.headers['sec-fetch-site'] !== 'same-origin')
    ) {
      response.writeHead(403).end();
      return;
    }
    try {
      const token = (await readFile(tokenFile, 'utf8')).trim();
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ tokenFile, token }));
    } catch {
      response.writeHead(503).end();
    }
  };
}
