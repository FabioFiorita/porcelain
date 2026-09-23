import type { FastifyReply, FastifyRequest } from 'fastify';

export async function preventCaching(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  reply.header('Cache-Control', 'no-store');
}
