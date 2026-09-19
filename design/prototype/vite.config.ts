import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * The sandbox the server sends with every agent or worktree page. SVG gets it too:
 * opened on its own (a new tab), an SVG runs its scripts like a page would.
 */
const SANDBOX = 'sandbox allow-scripts allow-forms allow-popups allow-modals';

/**
 * Serves the mock's pages and files (review summaries, HTML previews, images) from
 * their own links, the way the server will: the mock posts a page, then the iframe loads it
 * with the sandbox header. Blob URLs are the fallback outside the dev server; some
 * browsers refuse to run scripts in a sandboxed blob page.
 */
function mockPages(): Plugin {
  const pages = new Map<string, { type: string; bytes: Buffer }>();
  return {
    name: 'porcelain-mock-pages',
    configureServer(server) {
      server.middlewares.use('/__mock/page', (request, response) => {
        if (request.method === 'POST') {
          let body = '';
          request.setEncoding('utf8');
          request.on('data', (chunk: string) => {
            body += chunk;
          });
          request.on('end', () => {
            const type = String(request.headers['x-mock-type'] ?? 'text/html');
            const base64 = request.headers['x-mock-encoding'] === 'base64';
            const bytes = Buffer.from(body, base64 ? 'base64' : 'utf8');
            const id = createHash('sha256')
              .update(type)
              .update(bytes)
              .digest('hex')
              .slice(0, 24);
            pages.set(id, { type, bytes });
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ url: `/__mock/page/${id}` }));
          });
          return;
        }
        const page = pages.get(
          (request.url ?? '').replace(/^\//, '').split(/[?#]/)[0] ?? '',
        );
        if (page == null) {
          response.statusCode = 404;
          response.end('Not found');
          return;
        }
        response.setHeader(
          'Content-Type',
          page.type.startsWith('text/')
            ? `${page.type}; charset=utf-8`
            : page.type,
        );
        response.setHeader('Content-Security-Policy', SANDBOX);
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Cache-Control', 'no-store');
        response.end(page.bytes);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockPages()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '0.0.0.0', port: 5181, strictPort: true },
});
