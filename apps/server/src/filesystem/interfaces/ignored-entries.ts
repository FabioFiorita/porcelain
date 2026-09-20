/**
 * Which of these exact paths the repository ignores.
 *
 * It is a port rather than a Git call inside the reader because the reader
 * must be able to run the question inside its own safety boundary — the
 * directory is verified again after the answer comes back, so names can never
 * be paired with a different checkout.
 */
export type IgnoredEntries = (
  paths: readonly string[],
  signal?: AbortSignal,
) => Promise<Set<string>>;
