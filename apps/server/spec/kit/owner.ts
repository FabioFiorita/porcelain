import { readOwnerStatusResponseSchema } from '@porcelain/contracts/access';
import { askOwner } from '../../src/cli/owner-client.ts';

const ANSWER_WITHIN_MS = 5000;

export function askServerOwner(
  dataDirectory: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  return askOwner(dataDirectory, method, path, body, ANSWER_WITHIN_MS);
}

export async function ownerStatus(dataDirectory: string) {
  return readOwnerStatusResponseSchema.parse(
    await askServerOwner(dataDirectory, 'GET', '/status'),
  );
}
