import { describe, expect, it } from 'vitest';
import type { DiscoveredProjectRepository } from '@porcelain/projects/models';
import { InMemoryInventoryStore } from '../../spec/fakes/in-memory-inventory-store.ts';
import { ScriptedProjectFolderReader } from '../../spec/fakes/scripted-project-folder-reader.ts';
import { ScriptedProjectRepositoryReader } from '../../spec/fakes/scripted-project-repository-reader.ts';
import { DiscoverProjectsService } from './discover-projects-service.ts';

const home = '/home/me/code';

function repository(
  identity: string,
  worktrees: DiscoveredProjectRepository['worktrees'] = [],
): DiscoveredProjectRepository {
  return {
    commonDirectory: `/x/${identity}/.git`,
    repositoryIdentity: identity,
    worktrees,
  };
}

function setup(candidates: string[], limited = false) {
  const folders = new ScriptedProjectFolderReader();
  folders.searchFinds({ candidates, limited });
  const repositories = new ScriptedProjectRepositoryReader();
  const service = new DiscoverProjectsService(
    new InMemoryInventoryStore('environment', [
      {
        id: 'project-1',
        name: 'api',
        namedByOwner: false,
        commonDirectory: '/srv/work/api/.git',
        repositoryIdentity: 'registered',
        available: true,
      },
    ]),
    folders,
    repositories,
    { home },
  );
  return { folders, repositories, service };
}

describe('DiscoverProjectsService', () => {
  it('searches the project home and the folders holding registered projects', async () => {
    const { folders, service } = setup([]);
    await service.execute();
    expect(folders.searches.map((search) => search.roots)).toEqual([
      [home, '/srv/work'],
    ]);
  });

  it('lists each repository once, sorted by name, named after its folder', async () => {
    const { repositories, service } = setup([
      `${home}/zeta`,
      `${home}/alpha`,
      `${home}/alpha-copy`,
    ]);
    repositories.repository(`${home}/zeta`, repository('z'));
    repositories.repository(`${home}/alpha`, repository('a'));
    repositories.repository(`${home}/alpha-copy`, repository('a'));
    expect(await service.execute()).toEqual({
      repositories: [
        { name: 'alpha', path: `${home}/alpha` },
        { name: 'zeta', path: `${home}/zeta` },
      ],
      limited: false,
    });
  });

  it('points at the available main checkout rather than a linked worktree', async () => {
    const { repositories, service } = setup([`${home}/feature`]);
    repositories.repository(
      `${home}/feature`,
      repository('a', [
        { path: `${home}/feature`, main: false, available: true },
        { path: `${home}/app`, main: true, available: true },
      ]),
    );
    expect((await service.execute()).repositories).toEqual([
      { name: 'app', path: `${home}/app` },
    ]);
  });

  it('skips a folder with a Git marker that is not a usable repository', async () => {
    const { service } = setup([`${home}/broken`]);
    expect(await service.execute()).toEqual({
      repositories: [],
      limited: false,
    });
  });

  it('says the search was cut short when the folder search was', async () => {
    const { service } = setup([], true);
    expect((await service.execute()).limited).toBe(true);
  });

  it('stops at fifty repositories and says so', async () => {
    const candidates = Array.from(
      { length: 51 },
      (_, index) => `${home}/r${index}`,
    );
    const { repositories, service } = setup(candidates);
    for (const [index, path] of candidates.entries())
      repositories.repository(path, repository(`identity-${index}`));
    const discovery = await service.execute();
    expect(discovery.repositories).toHaveLength(50);
    expect(discovery.limited).toBe(true);
  });

  it('is not cut short at exactly fifty repositories', async () => {
    const candidates = Array.from(
      { length: 50 },
      (_, index) => `${home}/r${index}`,
    );
    const { repositories, service } = setup(candidates);
    for (const [index, path] of candidates.entries())
      repositories.repository(path, repository(`identity-${index}`));
    const discovery = await service.execute();
    expect(discovery.repositories).toHaveLength(50);
    expect(discovery.limited).toBe(false);
  });
});
