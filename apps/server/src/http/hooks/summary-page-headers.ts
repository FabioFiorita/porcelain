import type { FastifyReply, FastifyRequest } from 'fastify';

export async function summaryPageHeaders(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  reply
    .header('Cache-Control', 'private, no-store')
    .header(
      'Content-Security-Policy',
      'sandbox allow-scripts allow-forms allow-popups allow-modals',
    )
    .header('Referrer-Policy', 'no-referrer');
}
