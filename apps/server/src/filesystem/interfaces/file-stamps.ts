/** Identifies the current content of working files without reading them. */
export type FileStamps = (
  root: string,
  paths: readonly string[],
) => Promise<string>;
