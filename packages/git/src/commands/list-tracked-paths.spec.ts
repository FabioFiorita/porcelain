import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { UnsupportedPathEncodingError } from '../errors/unsupported-path-encoding-error.ts';
import {
  listTrackedPaths,
  MAX_QUICK_OPEN_PATHS,
} from './list-tracked-paths.ts';

const environment = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
};
const roots: string[] = [];

async function repository(files: (checkout: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-quick-open-'));
  roots.push(root);
  const checkout = join(root, 'checkout');
  await mkdir(checkout);
  execFileSync('git', ['init', '-b', 'main', checkout], {
    env: environment,
    stdio: 'ignore',
  });
  await files(checkout);
  return checkout;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

it('answers every name at the bound, and refuses one path past it', async () => {
  const checkout = await repository(async (path) => {
    await mkdir(join(path, 'many'));
    // Bound fixture I/O too: opening every file at once exceeds macOS limits.
    for (let start = 0; start < MAX_QUICK_OPEN_PATHS; start += 64)
      await Promise.all(
        Array.from(
          { length: Math.min(64, MAX_QUICK_OPEN_PATHS - start) },
          (_, offset) =>
            writeFile(join(path, 'many', `f${start + offset}.ts`), 'x'),
        ),
      );
  });
  const answered = await listTrackedPaths(checkout);
  expect(answered.complete).toBe(true);
  expect(answered.paths).toHaveLength(MAX_QUICK_OPEN_PATHS);
  expect(answered.paths[0]).toMatch(/^many\//);

  await writeFile(join(checkout, 'one-too-many.ts'), 'x');
  const refused = await listTrackedPaths(checkout);
  // A truncated list would quietly stop finding files that are there.
  expect(refused).toEqual({ paths: [], complete: false });
}, 20_000);

/**
 * A raw `0xff` name and a real U+FFFD name decode to the same string when
 * invalid bytes are replaced, and quick open would then offer one file and
 * open the other. Refusing the whole answer is the only honest option.
 */
it('refuses a repository holding a name that is not valid UTF-8', async () => {
  const checkout = await repository(async (path) => {
    // Put raw bytes in Git's index: APFS rejects creating such a disk name,
    // but the quick-open decoder must still reject a malformed index entry.
    const blob = execFileSync(
      'git',
      ['-C', path, 'hash-object', '-w', '--stdin'],
      {
        input: 'x',
        encoding: 'utf8',
        env: environment,
      },
    ).trim();
    execFileSync('git', ['-C', path, 'update-index', '-z', '--index-info'], {
      input: Buffer.concat([
        Buffer.from(`100644 ${blob}\t`),
        Buffer.from([0xff]),
        Buffer.from('.ts\0'),
      ]),
      env: environment,
    });
    await writeFile(join(path, '�.ts'), 'x');
  });
  await expect(listTrackedPaths(checkout)).rejects.toBeInstanceOf(
    UnsupportedPathEncodingError,
  );
});
