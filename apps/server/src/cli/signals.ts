/** Install the process shutdown signals used by both launcher entry points. */
export function installShutdownSignals(
  controller: AbortController,
): () => void {
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return () => {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  };
}
