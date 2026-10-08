import { afterEach, beforeEach, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimPoolFile,
  poolProcess,
  readPoolClaim,
  releasePoolFile,
  removeStalePoolClaim,
} from './simulator-pool.ts';

let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'porcelain-pool-spec-'));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

async function deadOwner() {
  const child = spawn(process.execPath, ['-e', 'process.stdin.resume()'], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });
  await once(child, 'spawn');
  if (child.pid === undefined) throw new Error('The fixture child has no PID.');
  const exited = once(child, 'exit');
  try {
    const identity = poolProcess(child.pid);
    if (identity === undefined)
      throw new Error('The fixture child had no identity.');
    return { owner: 'interrupted-run', process: identity };
  } finally {
    child.stdin.end();
    await exited;
  }
}

it('a lock left by a dead process does not block the next allocation', async () => {
  const path = join(directory, 'pool.lock');
  await writeFile(path, JSON.stringify(await deadOwner()));

  const allocated = claimPoolFile(path, 'next-run');

  expect(readPoolClaim(path)?.owner).toBe('next-run');
  expect(allocated.process.pid).toBe(process.pid);
  releasePoolFile(path, allocated);
  expect(readPoolClaim(path)).toBeUndefined();
});

it('a claim left by a dead process frees its simulator for the next run', async () => {
  const path = join(directory, 'simulator.claim');
  await writeFile(path, JSON.stringify(await deadOwner()));

  expect(removeStalePoolClaim(path)).toBe(true);
  expect(readPoolClaim(path)).toBeUndefined();
  const allocated = claimPoolFile(path, 'next-run');
  expect(readPoolClaim(path)?.owner).toBe('next-run');
  releasePoolFile(path, allocated);
});

it('a live owner keeps its simulator claim when another run tries to allocate it', async () => {
  const path = join(directory, 'simulator.claim');
  const owner = claimPoolFile(path, 'live-run');
  const before = await readFile(path, 'utf8');

  expect(removeStalePoolClaim(path)).toBe(false);
  expect(() => claimPoolFile(path, 'other-run')).toThrow();
  expect(await readFile(path, 'utf8')).toBe(before);
  releasePoolFile(path, owner);
});

it('a live allocation lock still refuses another allocator', () => {
  const path = join(directory, 'pool.lock');
  const owner = claimPoolFile(path, 'live-run');

  expect(() => claimPoolFile(path, 'other-run')).toThrow();
  expect(readPoolClaim(path)?.owner).toBe('live-run');
  releasePoolFile(path, owner);
});

it('a reused PID with a different start time does not keep a simulator busy', async () => {
  const path = join(directory, 'simulator.claim');
  await writeFile(
    path,
    JSON.stringify({
      owner: 'old-run',
      process: { pid: process.pid, birth: 'previous-process-start' },
    }),
  );

  expect(removeStalePoolClaim(path)).toBe(true);
  expect(readPoolClaim(path)).toBeUndefined();
});

it('a different run cannot release the live owners claim', () => {
  const path = join(directory, 'simulator.claim');
  const owner = claimPoolFile(path, 'live-run');

  expect(() => releasePoolFile(path, { ...owner, owner: 'other-run' })).toThrow(
    'this run does not own its claim',
  );
  expect(readPoolClaim(path)?.owner).toBe('live-run');
  releasePoolFile(path, owner);
});

it('an old process cannot release a replacement claim even with the same run token', () => {
  const path = join(directory, 'simulator.claim');
  const owner = claimPoolFile(path, 'same-run');

  expect(() =>
    releasePoolFile(path, {
      ...owner,
      process: { ...owner.process, birth: 'previous-process-start' },
    }),
  ).toThrow('this run does not own its claim');
  expect(readPoolClaim(path)?.owner).toBe('same-run');
  releasePoolFile(path, owner);
});
