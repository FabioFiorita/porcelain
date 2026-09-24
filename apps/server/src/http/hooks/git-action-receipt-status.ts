import { runGitActionResponseSchema } from '@porcelain/contracts/git-actions';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { gitActionReceiptStatus } from '../status-policy.ts';

export async function answerWithReceiptStatus(
  _request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
) {
  const receipt = runGitActionResponseSchema.safeParse(payload);
  if (reply.statusCode === 200 && receipt.success)
    reply.code(gitActionReceiptStatus(receipt.data));
  return payload;
}
