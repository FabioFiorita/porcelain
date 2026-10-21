import type { LiveConnection } from './session.ts';

export async function liveNotices(
  connection: Pick<LiveConnection, 'next'>,
  accepts: readonly ((notice: Record<string, unknown>) => boolean)[],
) {
  const pending = new Set(accepts.keys());
  const found: Record<string, unknown>[] = [];
  while (pending.size > 0) {
    const notice = await connection.next((entry) =>
      [...pending].some((index) => accepts[index]?.(entry)),
    );
    for (const index of pending) {
      if (accepts[index]?.(notice)) {
        found[index] = notice;
        pending.delete(index);
        break;
      }
    }
  }
  return found;
}
