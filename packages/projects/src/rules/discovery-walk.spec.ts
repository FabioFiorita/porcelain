import { describe, expect, it } from 'vitest';
import type {
  DiscoveryPolicy,
  DiscoveryWalk,
  FolderEntry,
  ProjectFolderRead,
} from '@porcelain/projects/models';
import {
  discoveryLimited,
  nextDiscoveryFolder,
  startDiscoveryWalk,
  visitDiscoveryFolder,
} from './discovery-walk.ts';

const policy: DiscoveryPolicy = {
  maxDepth: 2,
  maxFolders: 10,
  skipHidden: true,
  skippedNames: ['node_modules'],
};

type Folder = {
  children?: string[];
  links?: string[];
  git?: boolean;
  truncated?: boolean;
  unreadable?: boolean;
  realPath?: string;
};

function entry(
  parent: string,
  name: string,
  symbolicLink = false,
): FolderEntry {
  return { name, path: `${parent}/${name}`, symbolicLink };
}

function listing(path: string, folder: Folder | undefined): ProjectFolderRead {
  if (folder === undefined || folder.unreadable) return { kind: 'unreadable' };
  const real = folder.realPath ?? path;
  return {
    kind: 'read',
    contents: {
      path: real,
      parent: undefined,
      directories: [
        ...(folder.children ?? []).map((name) => entry(real, name)),
        ...(folder.links ?? []).map((name) => entry(real, name, true)),
      ],
      gitMarker: folder.git ?? false,
      truncated: folder.truncated ?? false,
    },
  };
}

function walk(
  roots: string[],
  tree: Record<string, Folder>,
  rules: DiscoveryPolicy = policy,
): { walk: DiscoveryWalk; read: string[] } {
  let state = startDiscoveryWalk(roots);
  const read: string[] = [];
  for (
    let folder = nextDiscoveryFolder(state, rules);
    folder !== undefined;
    folder = nextDiscoveryFolder(state, rules)
  ) {
    read.push(folder.path);
    state = visitDiscoveryFolder(
      state,
      folder,
      listing(folder.path, tree[folder.path]),
      rules,
    );
  }
  return { walk: state, read };
}

describe('discovery walk', () => {
  it('reads folders breadth first and keeps each folder with a Git marker as a candidate', () => {
    const { walk: done, read } = walk(['/h'], {
      '/h': { children: ['a', 'b'] },
      '/h/a': { children: ['deep'] },
      '/h/b': { git: true },
      '/h/a/deep': { git: true },
    });
    expect(read).toEqual(['/h', '/h/a', '/h/b', '/h/a/deep']);
    expect(done.candidates).toEqual(['/h/b', '/h/a/deep']);
    expect(discoveryLimited(done, policy)).toBe(false);
  });

  it('does not look inside a repository it found', () => {
    const { read } = walk(['/h'], {
      '/h': { children: ['repo'] },
      '/h/repo': { git: true, children: ['nested'] },
      '/h/repo/nested': { git: true },
    });
    expect(read).toEqual(['/h', '/h/repo']);
  });

  it('skips hidden folders, skipped names and symbolic links', () => {
    const { read } = walk(['/h'], {
      '/h': {
        children: ['.cache', 'node_modules', 'code'],
        links: ['elsewhere'],
      },
      '/h/code': {},
    });
    expect(read).toEqual(['/h', '/h/code']);
  });

  it('follows hidden folders when the policy allows them', () => {
    const { read } = walk(
      ['/h'],
      { '/h': { children: ['.config'] }, '/h/.config': {} },
      { ...policy, skipHidden: false },
    );
    expect(read).toEqual(['/h', '/h/.config']);
  });

  it('stops at the depth limit and says the search was cut short when folders lay below it', () => {
    const { walk: done, read } = walk(['/h'], {
      '/h': { children: ['a'] },
      '/h/a': { children: ['b'] },
      '/h/a/b': { children: ['c'] },
    });
    expect(read).toEqual(['/h', '/h/a', '/h/a/b']);
    expect(discoveryLimited(done, policy)).toBe(true);
  });

  it('is not cut short at the depth limit when nothing lies below it', () => {
    const { walk: done } = walk(['/h'], {
      '/h': { children: ['a'] },
      '/h/a': { children: ['b'] },
      '/h/a/b': {},
    });
    expect(discoveryLimited(done, policy)).toBe(false);
  });

  it('reads at most the folder limit and says the search was cut short', () => {
    const names = Array.from({ length: 12 }, (_, index) => `f${index}`);
    const tree: Record<string, Folder> = { '/h': { children: names } };
    for (const name of names) tree[`/h/${name}`] = {};
    const { walk: done, read } = walk(['/h'], tree);
    expect(read).toHaveLength(10);
    expect(discoveryLimited(done, policy)).toBe(true);
  });

  it('is not cut short when the folders fill the limit exactly', () => {
    const names = Array.from({ length: 9 }, (_, index) => `f${index}`);
    const tree: Record<string, Folder> = { '/h': { children: names } };
    for (const name of names) tree[`/h/${name}`] = {};
    const { walk: done, read } = walk(['/h'], tree);
    expect(read).toHaveLength(10);
    expect(discoveryLimited(done, policy)).toBe(false);
  });

  it('says the search was cut short when a folder cannot be read or was listed only in part', () => {
    expect(
      discoveryLimited(
        walk(['/h'], { '/h': { unreadable: true } }).walk,
        policy,
      ),
    ).toBe(true);
    expect(
      discoveryLimited(
        walk(['/h'], { '/h': { truncated: true } }).walk,
        policy,
      ),
    ).toBe(true);
  });

  it('looks inside a folder reached by two paths only once', () => {
    const { walk: done } = walk(['/h', '/other'], {
      '/h': { children: ['repo'] },
      '/other': { realPath: '/h' },
      '/h/repo': { git: true },
    });
    expect(done.candidates).toEqual(['/h/repo']);
  });
});
