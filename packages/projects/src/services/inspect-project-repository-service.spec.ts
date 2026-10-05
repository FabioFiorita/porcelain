import { RepositoryUnavailableError } from '@porcelain/kernel/errors';
import { ProjectRepositoryReader } from '@porcelain/projects/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { ScriptedProjectRepositoryReader } from '../../spec/fakes/scripted-project-repository-reader.ts';
import { InspectProjectRepositoryService } from './inspect-project-repository-service.ts';

const repository = {
  commonDirectory: '/srv/api/.git',
  repositoryIdentity: 'identity-1',
  worktrees: [{ path: '/srv/api', main: true, available: true }],
};

const service = Effect.runSync(
  InspectProjectRepositoryService.pipe(
    Effect.provide(InspectProjectRepositoryService.layer),
    Effect.provideService(
      ProjectRepositoryReader,
      new ScriptedProjectRepositoryReader({
        repositories: { '/srv/api': repository },
      }),
    ),
  ),
);

describe('InspectProjectRepositoryService', () => {
  it('answers the repository Git found at the path', async () => {
    await expect(
      Effect.runPromise(service.execute({ path: '/srv/api' })),
    ).resolves.toEqual(repository);
  });

  it('refuses a path where Git finds no usable repository', async () => {
    await expect(
      Effect.runPromise(service.execute({ path: '/srv/notes' })),
    ).rejects.toThrow(RepositoryUnavailableError);
  });
});
