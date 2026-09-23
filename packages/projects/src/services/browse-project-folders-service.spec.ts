import { describe, expect, it } from 'vitest';
import {
  FolderNotFoundError,
  FolderNotReadableError,
  UnsupportedFolderNameError,
} from '@porcelain/projects/errors';
import { ScriptedProjectFolderReader } from '../../spec/fakes/scripted-project-folder-reader.ts';
import { ScriptedProjectRepositoryReader } from '../../spec/fakes/scripted-project-repository-reader.ts';
import { BrowseProjectFoldersService } from './browse-project-folders-service.ts';

function setup() {
  const folders = new ScriptedProjectFolderReader();
  const service = new BrowseProjectFoldersService(
    folders,
    new ScriptedProjectRepositoryReader(),
    { home: '/home/owner' },
  );
  return { folders, service };
}

describe('BrowseProjectFoldersService', () => {
  it('lists the home folder when no path is given', async () => {
    const { folders, service } = setup();
    folders.folder({
      path: '/home/owner',
      parent: '/home',
      directories: [
        { name: 'code', path: '/home/owner/code', symbolicLink: false },
      ],
      gitMarker: false,
      truncated: false,
    });
    await expect(service.execute({})).resolves.toEqual({
      path: '/home/owner',
      parent: '/home',
      directories: [{ name: 'code', path: '/home/owner/code' }],
      repository: false,
      truncated: false,
    });
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
