export function folderName(path: string): string {
  return path.replace(/\/+$/, '').split('/').at(-1) ?? '';
}
