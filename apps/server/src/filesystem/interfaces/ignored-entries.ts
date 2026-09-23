export type IgnoredEntries = (
  paths: readonly string[],
  signal?: AbortSignal,
) => Promise<Set<string>>;
