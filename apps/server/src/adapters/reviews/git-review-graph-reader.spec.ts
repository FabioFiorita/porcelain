import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { ReviewGraphReader } from '@porcelain/reviews/ports';
import { expect, it } from 'vitest';
import { LIMITS } from '../../config/limits.ts';
import { gitReviewGraphReaderLayer } from './git-review-graph-reader.ts';

it('reads immutable imports, re-exports, dynamic imports and workspace packages without executing repository code', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-import-map-'));
  const git = (args: string[]) =>
    promisify(execFile)('git', ['-C', root, ...args]).then((r) =>
      r.stdout.trim(),
    );
  const runtime = ManagedRuntime.make(
    gitReviewGraphReaderLayer(LIMITS).pipe(Layer.provide(NodeServices.layer)),
  );
  try {
    await git(['init', '--initial-branch=main']);
    await git(['config', 'user.name', 'Fixture']);
    await git(['config', 'user.email', 'fixture@example.test']);
    await mkdir(join(root, 'packages/core/src'), { recursive: true });
    await mkdir(join(root, 'apps/web/src'), { recursive: true });
    await writeFile(
      join(root, 'packages/core/package.json'),
      JSON.stringify({
        name: '@fixture/core',
        exports: { '.': './src/index.ts' },
      }),
    );
    await writeFile(
      join(root, 'packages/core/src/index.ts'),
      'export const value = 1;',
    );
    await writeFile(
      join(root, 'apps/web/src/view.ts'),
      "export { value } from '@fixture/core'; export const load = () => import('./lazy.ts');",
    );
    await writeFile(
      join(root, 'apps/web/tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    );
    await writeFile(
      join(root, 'apps/web/src/alias.ts'),
      "export {load} from '@/view';",
    );
    await writeFile(
      join(root, 'apps/web/src/lazy.ts'),
      'throw new Error("Never execute this repository");',
    );
    await git(['add', '.']);
    await git(['commit', '-m', 'Base']);
    const oid = await git(['rev-parse', 'HEAD']);
    await writeFile(
      join(root, 'apps/web/src/view.ts'),
      'export const changed = 2;',
    );
    const graph = await runtime.runPromise(
      Effect.gen(function* () {
        const reader = yield* ReviewGraphReader;
        return yield* reader.read({ commonDirectory: join(root, '.git'), oid });
      }),
    );
    expect(graph?.find((m) => m.path === 'apps/web/src/view.ts')).toEqual({
      path: 'apps/web/src/view.ts',
      owner: 'apps/web/src',
      imports: ['apps/web/src/lazy.ts', 'packages/core/src/index.ts'],
      unresolved: 0,
    });
    expect(graph?.find((m) => m.path === 'apps/web/src/alias.ts')).toEqual({
      path: 'apps/web/src/alias.ts',
      owner: 'apps/web/src',
      imports: ['apps/web/src/view.ts'],
      unresolved: 0,
    });
    expect(graph?.find((m) => m.path === 'packages/core/src/index.ts')).toEqual(
      {
        path: 'packages/core/src/index.ts',
        owner: 'packages/core',
        imports: [],
        unresolved: 0,
      },
    );
  } finally {
    await runtime.dispose();
    await rm(root, { recursive: true, force: true });
  }
});
