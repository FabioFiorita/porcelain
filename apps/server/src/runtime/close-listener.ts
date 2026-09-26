import type { ClosableListener } from '../ports/closable-listener.ts';

export async function closeListener(
  listener: ClosableListener,
  graceMs: number,
): Promise<void> {
  const deadline = setTimeout(
    () => listener.server.closeAllConnections(),
    graceMs,
  );
  deadline.unref();
  try {
    await listener.close();
  } finally {
    clearTimeout(deadline);
  }
}
