import { createHash, timingSafeEqual } from 'node:crypto';

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function constantTimeEquals(
  expected: string,
  supplied: string,
): boolean {
  return timingSafeEqual(digest(expected), digest(supplied));
}
