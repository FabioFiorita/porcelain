import { readHealthResponseSchema } from '@porcelain/contracts/access';
import { Schema } from 'effect';

export async function readServerHealth(address: string) {
  const response = await fetch(`${address}/api/health`);
  const contentType = response.headers.get('content-type');
  if (response.status !== 200 || !contentType?.includes('application/json'))
    throw new Error(
      `Expected JSON 200 from /api/health, received ${response.status} (${contentType ?? 'no content type'})`,
    );
  return Schema.decodeUnknownSync(readHealthResponseSchema)(
    await response.json(),
  );
}
