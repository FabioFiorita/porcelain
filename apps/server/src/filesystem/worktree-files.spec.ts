import {
  mkdir,
  mkdtemp,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';

/**
 * The real filesystem, with one seam: `open` runs a hook first. That places a
 * change exactly inside the window between checking a path's ancestors and
 * reading its bytes, which is otherwise a race no test could land on.
 */
const hooks = vi.hoisted(() => ({
  beforeOpen: async () => {},
  beforeReadlink: async () => {},
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    open: async (...args: Parameters<typeof real.open>) => {
      await hooks.beforeOpen();
      return real.open(...args);
    },
    readlink: async (...args: Parameters<typeof real.readlink>) => {
      await hooks.beforeReadlink();
      return real.readlink(...args);
    },
  };
});

const { readWorktreeFiles } = await import('./worktree-files.ts');

afterEach(() => {
  hooks.beforeOpen = async () => {};
  hooks.beforeReadlink = async () => {};
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-worktree-files-'));
  const checkout = join(root, 'checkout');
  await mkdir(join(checkout, 'src'), { recursive: true });
  await writeFile(join(checkout, 'src', 'file.ts'), 'inside\n');
  await writeFile(join(root, 'secret.ts'), 'outside-secret\n');
  await mkdir(join(root, 'elsewhere'));
  await writeFile(join(root, 'elsewhere', 'file.ts'), 'also-outside\n');
  return { root, checkout };
}

it('digests a regular file and reads a symlink without following it', async () => {
  const { root, checkout } = await fixture();
  try {
    await symlink(join(root, 'secret.ts'), join(checkout, 'link.ts'));
    const entries = await readWorktreeFiles(checkout, [
      'src/file.ts',
      'link.ts',
    ]);
    expect(entries.get('src/file.ts')).toEqual({
      kind: 'file',
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      stamp: expect.any(String),
    });
    expect(entries.get('link.ts')).toEqual({
      kind: 'symlink',
      target: join(root, 'secret.ts'),
      stamp: expect.any(String),
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * Opening without following guards the last component only. An ancestor that
 * was a real directory when it was checked, and a link out of the checkout by
 * the time the bytes were read, would otherwise digest a file outside it — and
 * that digest would become a fingerprint the reader could mark.
 */
it('does not digest a file whose ancestor was replaced after it was checked', async () => {
  const { root, checkout } = await fixture();
  try {
    hooks.beforeOpen = async () => {
      hooks.beforeOpen = async () => {};
      await swapAncestor(root, checkout);
    };
    const entries = await readWorktreeFiles(checkout, ['src/file.ts']);
    // No digest at all: not the file that was checked, and certainly not the
    // one the replaced ancestor points at.
    expect(entries.get('src/file.ts')?.kind).not.toBe('file');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * Reading a link's target has no handle to re-stat, so the ancestors are the
 * only thing standing between it and a target read from outside the checkout.
 */
it('does not report a link target read through a replaced ancestor', async () => {
  const { root, checkout } = await fixture();
  try {
    await symlink('./file.ts', join(checkout, 'src', 'alias.ts'));
    await symlink('outside-target', join(root, 'elsewhere', 'alias.ts'));
    hooks.beforeReadlink = async () => {
      hooks.beforeReadlink = async () => {};
      await swapAncestor(root, checkout);
    };
    const entries = await readWorktreeFiles(checkout, ['src/alias.ts']);
    expect(entries.has('src/alias.ts')).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** A directory that was real when it was checked, a link by the time it is read. */
async function swapAncestor(root: string, checkout: string) {
  await rename(join(checkout, 'src'), join(checkout, 'src-gone'));
  await symlink(join(root, 'elsewhere'), join(checkout, 'src'));
}

it('refuses a path whose ancestor is already a link out of the checkout', async () => {
  const { root, checkout } = await fixture();
  try {
    await symlink(join(root, 'elsewhere'), join(checkout, 'through'));
    const entries = await readWorktreeFiles(checkout, ['through/file.ts']);
    expect(entries.has('through/file.ts')).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/**
 * The stamp answers what a digest cannot: was this written at all. Content
 * changed and changed back reads the same, so only the change time — which the
 * owner of a file cannot set backwards — tells the two apart.
 */
it('moves a file stamp on a write that leaves the content identical', async () => {
  const { root, checkout } = await fixture();
  try {
    const path = 'src/file.ts';
    const before = await readWorktreeFiles(checkout, [path]);
    await writeFile(join(checkout, path), 'briefly different\n');
    await writeFile(join(checkout, path), 'inside\n');
    const after = await readWorktreeFiles(checkout, [path]);
    const one = before.get(path);
    const two = after.get(path);
    if (one?.kind !== 'file' || two?.kind !== 'file')
      throw new Error('Expected both reads to digest the file');
    expect(two.digest).toBe(one.digest);
    expect(two.stamp).not.toBe(one.stamp);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

/** Two thousand changed files must not become two thousand open handles. */
it('bounds how many files it reads at once', async () => {
  const { root, checkout } = await fixture();
  try {
    const paths = await Promise.all(
      Array.from({ length: 40 }, async (_, index) => {
        const path = `src/many-${index}.ts`;
        await writeFile(join(checkout, path), `body ${index}\n`);
        return path;
      }),
    );
    let open = 0;
    let peak = 0;
    hooks.beforeOpen = async () => {
      open += 1;
      peak = Math.max(peak, open);
      // Hold the slot open long enough for every other reader to pile up.
      await new Promise((settle) => setTimeout(settle, 5));
      open -= 1;
    };
    const entries = await readWorktreeFiles(checkout, paths);
    expect(entries.size).toBe(paths.length);
    expect(peak).toBeLessThanOrEqual(8);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
