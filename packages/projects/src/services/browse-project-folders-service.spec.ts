import { describe, expect, it } from 'vitest';
import {
  FolderNotFoundError,
  FolderNotReadableError,
  UnsupportedFolderNameError,
} from '@porcelain/projects/errors';
import type {
  DiscoveredProjectRepository,
  ProjectFolderContents,
} from '@porcelain/projects/models';
import { ScriptedProjectFolderReader } from '../../spec/fakes/scripted-project-folder-reader.ts';
import { ScriptedProjectRepositoryReader } from '../../spec/fakes/scripted-project-repository-reader.ts';
import { BrowseProjectFoldersService } from './browse-project-folders-service.ts';

function folder(
  path: string,
  contents: Partial<ProjectFolderContents> = {},
): ProjectFolderContents {
  return {
    path,
    parent: '/home',
    directories: [],
    gitMarker: false,
    truncated: false,
    ...contents,
  };
}

function setup(repositories: Record<string, DiscoveredProjectRepository> = {}) {
  const folders = new ScriptedProjectFolderReader();
  const reader = new ScriptedProjectRepositoryReader({ repositories });
  const service = new BrowseProjectFoldersService(folders, reader, {
    home: '/home/owner',
    maxEntries: 2000,
  });
  return { folders, service };
}

describe('BrowseProjectFoldersService', () => {
  it('lists the home folder when no path is given', async () => {
    const { folders, service } = setup();
    folders.folder(
      folder('/home/owner', {
        directories: [
          { name: 'code', path: '/home/owner/code', symbolicLink: false },
        ],
      }),
    );
    await expect(service.execute({})).resolves.toEqual({
      path: '/home/owner',
      parent: '/home',
      directories: [{ name: 'code', path: '/home/owner/code' }],
      repository: false,
      truncated: false,
    });
  });

  it('lists the folder that was asked for', async () => {
    const { folders, service } = setup();
    folders.folder(folder('/srv', { parent: '/' }));
    expect((await service.execute({ path: '/srv' })).path).toBe('/srv');
  });

  it('never offers the Git directory as a folder to open', async () => {
    const { folders, service } = setup();
    folders.folder(
      folder('/srv/api', {
        gitMarker: true,
        directories: [
          { name: '.git', path: '/srv/api/.git', symbolicLink: false },
          { name: 'src', path: '/srv/api/src', symbolicLink: false },
        ],
      }),
    );
    expect((await service.execute({ path: '/srv/api' })).directories).toEqual([
      { name: 'src', path: '/srv/api/src' },
    ]);
  });

  it('marks a folder as a repository when Git can open it', async () => {
    const { folders, service } = setup({
      '/srv/api': {
        commonDirectory: '/srv/api/.git',
        repositoryIdentity: 'identity-1',
        worktrees: [{ path: '/srv/api', main: true, available: true }],
      },
    });
    folders.folder(folder('/srv/api', { gitMarker: true }));
    expect((await service.execute({ path: '/srv/api' })).repository).toBe(true);
  });

  it('does not mark a folder whose Git marker Git cannot open', async () => {
    const { folders, service } = setup();
    folders.folder(folder('/srv/broken', { gitMarker: true }));
    expect((await service.execute({ path: '/srv/broken' })).repository).toBe(
      false,
    );
  });

  it('does not mark a folder without a Git marker, even inside a repository', async () => {
    const { folders, service } = setup({
      '/srv/api/src': {
        commonDirectory: '/srv/api/.git',
        repositoryIdentity: 'identity-1',
        worktrees: [],
      },
    });
    folders.folder(folder('/srv/api/src'));
    expect((await service.execute({ path: '/srv/api/src' })).repository).toBe(
      false,
    );
  });

  it('says when the folder held more entries than it lists', async () => {
    const { folders, service } = setup();
    folders.folder(folder('/srv/large', { truncated: true }));
    expect((await service.execute({ path: '/srv/large' })).truncated).toBe(
      true,
    );
  });

  it('refuses a folder that does not exist', async () => {
    const { folders, service } = setup();
    folders.failing('/missing', 'missing');
    await expect(service.execute({ path: '/missing' })).rejects.toThrow(
      FolderNotFoundError,
    );
  });

  it('refuses a folder it may not read', async () => {
    const { folders, service } = setup();
    folders.failing('/root', 'unreadable');
    await expect(service.execute({ path: '/root' })).rejects.toThrow(
      FolderNotReadableError,
    );
  });

  it('refuses a folder holding a name that is not UTF-8', async () => {
    const { folders, service } = setup();
    folders.failing('/odd', 'unsupported-name');
    await expect(service.execute({ path: '/odd' })).rejects.toThrow(
      UnsupportedFolderNameError,
    );
  });
});
