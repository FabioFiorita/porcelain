export function matchingFilePaths(paths: readonly string[], search: string) {
  const needle = search.trim().toLowerCase();
  return paths.filter((path) => path.toLowerCase().includes(needle));
}

export function childFilePath(directory: string, name: string) {
  return directory ? `${directory}/${name}` : name;
}

export function fileReadError(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'This file could not be loaded. Try again.';
}
