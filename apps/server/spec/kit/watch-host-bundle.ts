import { build } from 'esbuild';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const entry = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../src/bootstrap/watch-host.ts',
);

export async function bundleWatchHost(
  serverSource: string,
  external: readonly string[],
): Promise<void> {
  await build({
    entryPoints: [entry],
    outfile: join(serverSource, 'bootstrap/watch-host.mjs'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    external: [...external],
    logLevel: 'warning',
  });
}
