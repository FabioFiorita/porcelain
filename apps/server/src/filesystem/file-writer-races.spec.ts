import { createHash } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The real filesystem, with seams: each operation runs a hook first. That puts
 * a competing writer exactly inside the window between a check and the step it
 * was meant to protect — the only way to test a race rather than hope for one.
 */
const hooks = vi.hoisted(() => ({
  beforeOpen: async () => {},
  beforeLink: async () => {},
  beforeRename: async () => {},
  beforeMkdir: async () => {},
  beforeUnlink: async () => {},
  beforeRealpath: async () => {},
  afterOpen: async () => {},
}));
vi.mock('node:fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...real,
    open: async (...args: Parameters<typeof real.open>) => {
      await hooks.beforeOpen();
      const file = await real.open(...args);
      await hooks.afterOpen();
      return file;
    },
    link: async (...args: Parameters<typeof real.link>) => {
      await hooks.beforeLink();
      return real.link(...args);
    },
    rename: async (...args: Parameters<typeof real.rename>) => {
      await hooks.beforeRename();
      return real.rename(...args);
    },
    mkdir: async (...args: Parameters<typeof real.mkdir>) => {
      await hooks.beforeMkdir();
      return real.mkdir(...args);
    },
    unlink: async (...args: Parameters<typeof real.unlink>) => {
      await hooks.beforeUnlink();
      return real.unlink(...args);
    },
    realpath: async (...args: Parameters<typeof real.realpath>) => {
      await hooks.beforeRealpath();
      return real.realpath(...args);
    },
  };
});

const { NodeFileWriter } = await import('./file-writer.ts');

const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'porcelain-races-'));
  roots.push(root);
  const checkout = join(root, 'checkout');
  await mkdir(join(checkout, 'src'), { recursive: true });
  await writeFile(join(checkout, 'src', 'a.ts'), 'original\n');
  await mkdir(join(root, 'outside'));
  return { root, checkout };
}

afterEach(async () => {
  hooks.beforeOpen = async () => {};
  hooks.beforeLink = async () => {};
  hooks.beforeRename = async () => {};
  hooks.beforeMkdir = async () => {};
  hooks.beforeUnlink = async () => {};
  hooks.beforeRealpath = async () => {};
  hooks.afterOpen = async () => {};
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

/** A directory that was real when it was checked, a link by the time it is used. */
async function swapAncestor(root: string, checkout: string) {
  await rename(join(checkout, 'src'), join(checkout, 'src-gone'));
  await symlink(join(root, 'outside'), join(checkout, 'src'));
}

describe('mutation races', () => {
  it('does not create outside the checkout when an ancestor is swapped for a link', async () => {
    const { root, checkout } = await fixture();
    const writer = new NodeFileWriter();
    hooks.beforeOpen = async () => {
      hooks.beforeOpen = async () => {};
      await swapAncestor(root, checkout);
    };
    await expect(
      writer.edit(checkout, {
        kind: 'create',
        path: 'src/new.ts',
        entryKind: 'file',
      }),
      // The ancestors are no longer readable, which is what the check after
      // the create is for; the refusal names that rather than a content change.
    ).rejects.toMatchObject({ code: 'PATH_NOT_READABLE' });
    // And whatever it did create outside is taken back.
    expect(await readdir(join(root, 'outside'))).toEqual([]);
  });

  /**
   * `rename` would overwrite whatever took the destination after the check.
   * `link` refuses the name outright, so there is no window to lose data in.
   */
  it('refuses a move whose destination was taken after it was verified', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter();
    hooks.beforeLink = async () => {
      hooks.beforeLink = async () => {};
      await writeFile(join(checkout, 'src', 'b.ts'), 'someone else\n');
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      }),
    ).rejects.toMatchObject({ code: 'ENTRY_EXISTS' });
    // Neither file lost anything.
    expect(await readFile(join(checkout, 'src', 'b.ts'), 'utf8')).toBe(
      'someone else\n',
    );
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'original\n',
    );
  });

  it('refuses a move whose source was replaced after it was verified', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter();
    hooks.beforeLink = async () => {
      hooks.beforeLink = async () => {};
      await rm(join(checkout, 'src', 'a.ts'));
      await writeFile(join(checkout, 'src', 'a.ts'), 'a different file\n');
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_CHANGED' });
    // The replacement is still where it was, and no half-move was left behind.
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'a different file\n',
    );
    expect(await readdir(join(checkout, 'src'))).toEqual(['a.ts']);
  });

  it('does not move a directory outside the checkout when an ancestor is swapped', async () => {
    const { root, checkout } = await fixture();
    await mkdir(join(checkout, 'src', 'folder'));
    const writer = new NodeFileWriter();
    hooks.beforeMkdir = async () => {
      hooks.beforeMkdir = async () => {};
      hooks.beforeUnlink = async () => {};
      await swapAncestor(root, checkout);
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/folder',
        destination: 'src/moved',
      }),
    ).rejects.toMatchObject({ code: 'PATH_NOT_READABLE' });
    expect(await readdir(join(root, 'outside'))).toEqual([]);
  });

  /**
   * The window between the final comparison and the replace cannot be closed
   * without a lock Node does not offer. What is promised is that a change
   * observed *up to that comparison* is refused — so the edit has to land
   * after the fingerprint was read and before the rename, which is the seam
   * the final comparison exists for. Changing the file earlier would trip the
   * fingerprint instead and prove nothing about that comparison.
   */
  it('refuses a write whose file changed between the fingerprint and the replace', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter();
    // The second open is the temporary file, which is after the fingerprint
    // was read and before the final comparison — the window that comparison
    // exists for. Editing at the first open would trip the fingerprint instead
    // and prove nothing about it.
    let opens = 0;
    hooks.beforeOpen = async () => {
      opens += 1;
      if (opens !== 2) return;
      await writeFile(join(checkout, 'src', 'a.ts'), 'someone else typed\n');
    };
    await expect(
      writer.edit(checkout, {
        kind: 'write',
        path: 'src/a.ts',
        text: 'mine\n',
        expectedFingerprint: hash('original\n'),
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_CHANGED' });
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'someone else typed\n',
    );
    // No temporary file is left in the folder either.
    expect(await readdir(join(checkout, 'src'))).toEqual(['a.ts']);
  });

  /**
   * The last check before an irreversible step must be about the thing that
   * step destroys. A move confirms its source immediately before unlinking it,
   * against the link it just made: anything else at that name is not this file.
   */
  it('refuses to unlink a source that was replaced after the move was confirmed', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter();
    // Between confirming the move and unlinking the source. The check made
    // immediately before the unlink is what has to catch this.
    hooks.beforeLink = async () => {
      hooks.beforeLink = async () => {};
      queueMicrotask(() => {
        void (async () => {
          await rm(join(checkout, 'src', 'a.ts'));
          await writeFile(
            join(checkout, 'src', 'a.ts'),
            'someone else entirely\n',
          );
        })();
      });
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      }),
    ).rejects.toMatchObject({ code: 'CONTENT_CHANGED' });
    // The replacement is still there; only the link the move made is gone.
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'someone else entirely\n',
    );
    expect(await readdir(join(checkout, 'src'))).toEqual(['a.ts']);
  });

  it('refuses a directory move whose reservation was replaced before the rename', async () => {
    const { checkout } = await fixture();
    await mkdir(join(checkout, 'src', 'folder'));
    const writer = new NodeFileWriter();
    hooks.beforeRename = async () => {
      hooks.beforeRename = async () => {};
      await rm(join(checkout, 'src', 'moved'), { recursive: true });
      await mkdir(join(checkout, 'src', 'moved'));
      await writeFile(join(checkout, 'src', 'moved', 'theirs.ts'), 'theirs\n');
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/folder',
        destination: 'src/moved',
      }),
      // `rename` refuses a non-empty directory outright, which is the whole
      // reason a directory move can only ever replace an empty one.
    ).rejects.toMatchObject({ code: 'ENTRY_EXISTS' });
    expect(await readdir(join(checkout, 'src', 'moved'))).toEqual([
      'theirs.ts',
    ]);
    expect(await readdir(join(checkout, 'src', 'folder'))).toEqual([]);
  });

  /**
   * The window that cannot be closed, written down as a test so it cannot be
   * forgotten: trash hands a pathname to an implementation that works by name,
   * and Node offers no `unlinkat`, so an entry replaced *inside* that handoff
   * is the entry that gets trashed. Everything up to the handoff is checked.
   * docs/decisions/files-read-boundary.md states this as the product promise.
   */
  it('documents that a replacement inside the trash handoff is what gets trashed', async () => {
    const { checkout } = await fixture();
    const trashed: string[] = [];
    const writer = new NodeFileWriter(async (paths) => {
      // The competing writer lands between the last check and the removal.
      await rm(join(checkout, 'src', 'a.ts'));
      await writeFile(join(checkout, 'src', 'a.ts'), 'someone else\n');
      for (const path of paths) {
        trashed.push(await readFile(path, 'utf8'));
        await rm(path);
      }
    });
    await expect(
      writer.edit(checkout, { kind: 'trash', path: 'src/a.ts' }),
    ).resolves.toMatchObject({ path: 'src/a.ts' });
    // It took the replacement, not the file that was checked. No portable API
    // can tell it otherwise; what this proves is that we know it.
    expect(trashed).toEqual(['someone else\n']);
  });

  it('refuses a trash this machine cannot perform, and leaves the file', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter(async () => {
      throw new Error('no trash on this machine');
    });
    await expect(
      writer.edit(checkout, { kind: 'trash', path: 'src/a.ts' }),
    ).rejects.toMatchObject({ code: 'TRASH_UNAVAILABLE' });
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'original\n',
    );
  });

  it('refuses a move across filesystems instead of copying', async () => {
    const { checkout } = await fixture();
    const writer = new NodeFileWriter();
    hooks.beforeLink = async () => {
      hooks.beforeLink = async () => {};
      const error: NodeJS.ErrnoException = new Error('cross-device link');
      error.code = 'EXDEV';
      throw error;
    };
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      }),
    ).rejects.toMatchObject({ code: 'CROSS_DEVICE' });
    expect(await readFile(join(checkout, 'src', 'a.ts'), 'utf8')).toBe(
      'original\n',
    );
    expect(await lstat(join(checkout, 'src', 'b.ts')).catch(() => null)).toBe(
      null,
    );
  });
  /**
   * The swap put back before anyone looks. The ancestors are checked again and
   * the request is refused, but taking the entry back is by name, and the name
   * now leads to the restored directory inside the checkout: what was created
   * outside is no longer reachable and stays. Refusal is certain, removal is
   * not, and docs/decisions/files-read-boundary.md says exactly that.
   */
  it('documents that an ancestor put back again hides what was created outside', async () => {
    const { root, checkout } = await fixture();
    hooks.beforeOpen = async () => {
      hooks.beforeOpen = async () => {};
      await swapAncestor(root, checkout);
    };
    hooks.afterOpen = async () => {
      hooks.afterOpen = async () => {};
      // Back to the real directory before the create is inspected at all.
      await rm(join(checkout, 'src'));
      await rename(join(checkout, 'src-gone'), join(checkout, 'src'));
    };
    const writer = new NodeFileWriter(async () => {});
    await expect(
      writer.edit(checkout, {
        kind: 'create',
        path: 'src/new.ts',
        entryKind: 'file',
      }),
    ).rejects.toThrow();
    // Nothing was added where it was asked for.
    expect(await readdir(join(checkout, 'src'))).toEqual(['a.ts']);
    // And the entry outside is still there. No portable API can find it by
    // name once the ancestor is back; what this proves is that we know it.
    expect(await readdir(join(root, 'outside'))).toEqual(['new.ts']);
  });

  /**
   * The last window in a move. The source is confirmed against the link just
   * made, and then `unlink` takes a name rather than that entry, so a writer
   * who substitutes the source in between loses their file and the move still
   * reports success. docs/decisions/files-read-boundary.md states this.
   */
  it('documents that a source substituted before the unlink is what is removed', async () => {
    const { checkout } = await fixture();
    hooks.beforeUnlink = async () => {
      hooks.beforeUnlink = async () => {};
      // The competing writer lands after the final check, in the only gap
      // `unlink` leaves open.
      await rm(join(checkout, 'src', 'a.ts'));
      await writeFile(join(checkout, 'src', 'a.ts'), 'someone else\n');
    };
    const writer = new NodeFileWriter(async () => {});
    await expect(
      writer.edit(checkout, {
        kind: 'move',
        path: 'src/a.ts',
        destination: 'src/b.ts',
      }),
    ).resolves.toMatchObject({ path: 'src/b.ts' });
    // Their file is gone, and the move said it succeeded.
    expect(await readdir(join(checkout, 'src'))).toEqual(['b.ts']);
    expect(await readFile(join(checkout, 'src', 'b.ts'), 'utf8')).toBe(
      'original\n',
    );
  });

  /**
   * What the final pre-handoff check is for. The parent has already been read
   * by the time this lands, so the ancestor comparison still passes and only
   * the last look at the entry itself can refuse. Remove that look and the
   * replacement is trashed instead.
   */
  it('refuses to trash an entry replaced after the ancestors were confirmed', async () => {
    const { checkout } = await fixture();
    let reads = 0;
    hooks.beforeRealpath = async () => {
      // The second resolution is the one inside the re-check, after the
      // entry's own stats were taken and before they are taken again.
      reads += 1;
      if (reads !== 2) return;
      await rm(join(checkout, 'src', 'a.ts'));
      await writeFile(join(checkout, 'src', 'a.ts'), 'someone else\n');
    };
    const trashed: string[] = [];
    const writer = new NodeFileWriter(async (paths) => {
      for (const path of paths) trashed.push(await readFile(path, 'utf8'));
    });
    await expect(
      writer.edit(checkout, { kind: 'trash', path: 'src/a.ts' }),
    ).rejects.toMatchObject({ code: 'CONTENT_CHANGED' });
    expect(trashed).toEqual([]);
  });
});
