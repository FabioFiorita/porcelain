import type { ZodTypeProvider } from '@fastify/type-provider-zod';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Application } from '../../application.ts';

const paramsSchema = z.strictObject({ token: z.uuid() });
const querySchema = z.strictObject({
  expires: z.coerce.number().int().positive(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export function reviewSummaryRoute(
  server: FastifyInstance,
  options: { application: Application },
) {
  const api = server.withTypeProvider<ZodTypeProvider>();
  api.get(
    '/review-summaries/:token',
    { schema: { params: paramsSchema, querystring: querySchema } },
    async (request, reply) => {
      const summary = options.application.reviewSummary(
        request.params.token,
        request.query.expires,
        request.query.signature,
      );
      if (summary === null) return reply.code(404).send();
      return reply
        .header('Cache-Control', 'private, no-store')
        .header(
          'Content-Security-Policy',
          'sandbox allow-scripts allow-forms allow-popups allow-modals',
        )
        .header('Referrer-Policy', 'no-referrer')
        .type('text/html; charset=utf-8')
        .send(injectBridge(summary));
    },
  );
}

const BRIDGE = `<style id="porcelain-theme">:root{color-scheme:light dark;--porcelain-background:#fff;--porcelain-foreground:#171717}:root[data-theme=light]{color-scheme:light;--porcelain-background:#fff;--porcelain-foreground:#171717}:root[data-theme=dark]{color-scheme:dark;--porcelain-background:#111;--porcelain-foreground:#eee}@media(prefers-color-scheme:dark){:root:not([data-theme]){--porcelain-background:#111;--porcelain-foreground:#eee}}</style><script>(()=>{const apply=t=>{if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}};const hash=()=>{const t=new URLSearchParams(location.hash.slice(1)).get('theme');apply(t)};hash();addEventListener('hashchange',hash);addEventListener('message',e=>{if(e.source!==parent||!e.data||e.data.source!=='porcelain'||e.data.type!=='theme')return;apply(e.data.theme)});addEventListener('click',e=>{const a=e.target instanceof Element?e.target.closest('a[href]'):null;if(!a)return;const m=/^#layer-(\\d+)$/.exec(a.getAttribute('href')||'');if(!m)return;e.preventDefault();parent.postMessage({source:'porcelain-summary',openLayer:Number(m[1])},'*')})})()</script>`;

function injectBridge(html: string) {
  const body = html.toLowerCase().lastIndexOf('</body>');
  return body === -1
    ? `${html}${BRIDGE}`
    : `${html.slice(0, body)}${BRIDGE}${html.slice(body)}`;
}
