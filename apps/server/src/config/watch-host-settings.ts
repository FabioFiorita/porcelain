import { fileURLToPath } from 'node:url';

export function watchHostEntry(moduleUrl: string = import.meta.url): string {
  const source = moduleUrl.endsWith('.ts');
  return fileURLToPath(
    new URL(`../bootstrap/watch-host.${source ? 'ts' : 'mjs'}`, moduleUrl),
  );
}
