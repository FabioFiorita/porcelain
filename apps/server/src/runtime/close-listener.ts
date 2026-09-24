export type ClosableListener = {
  close(): PromiseLike<unknown>;
  server: { closeAllConnections(): void };
};

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
