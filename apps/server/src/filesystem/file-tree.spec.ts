import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTreePaths } from '@porcelain/git/tree-paths';
import { expect, it } from 'vitest';
import { NodeFileTree } from './file-tree.ts';

it('lists a large repository whose tree exceeds 20,000 paths and 2 MB without dropping files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-large-tree-'));
  try {
    execFileSync('git', ['init', '--quiet', root], {
      env: {
        ...process.env,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
      },
    });
    const paths: string[] = [];
    for (let folder = 0; folder < 101; folder++) {
      const directory = `package-${folder}-${'long-name-'.repeat(5)}`;
      await mkdir(join(root, directory));
      const files = Array.from(
        { length: 200 },
        (_, file) => `${directory}/module-${file}-${'source-'.repeat(5)}.ts`,
      );
      await Promise.all(files.map((path) => writeFile(join(root, path), '')));
      paths.push(...files);
    }
    const listed = await readTreePaths(root);
    const tree = await new NodeFileTree().read(root, 'fixture', listed);
    expect(tree.entries.map((entry) => entry.path).sort()).toEqual(
      paths.sort(),
    );
    expect(Buffer.byteLength(JSON.stringify(tree))).toBeGreaterThan(
      2 * 1024 * 1024,
    );
    expect(
      tree.entries.every((entry) => entry.kind === 'file' && !entry.ignored),
    ).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20000);

it('still rejects trees beyond the bounded path capacity before inspecting files', async () => {
  await expect(
    new NodeFileTree().read('/unused', 'fixture', {
      paths: Array(50001).fill('file'),
      ignored: [],
    }),
  ).rejects.toMatchObject({ code: 'DIRECTORY_TOO_LARGE' });
});
