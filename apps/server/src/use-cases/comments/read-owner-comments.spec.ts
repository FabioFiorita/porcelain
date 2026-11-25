import { Effect, Exit, Layer } from 'effect';
import { expect, it } from 'vite-plus/test';
import type { ReadInventoryResponse } from '@porcelain/contracts/projects';
import { ReadInventoryUseCasePort } from '../../ports/read-inventory-use-case-port.ts';
import { ListCommentsUseCasePort } from '../../ports/list-comments-use-case-port.ts';
import { ReadOwnerCommentsUseCase } from './read-owner-comments.ts';

const worktree = (id: string, path: string) => ({
  id,
  path,
  main: false,
  branch: id,
  available: true,
});
const inventory: ReadInventoryResponse = {
  environmentId: 'fixture',
  environment: { name: 'Fixture', custom: true },
  projects: [
    {
      id: 'project',
      name: 'Fixture',
      available: true,
      worktrees: [
        worktree('main', '/work/repo'),
        worktree('nested', '/work/repo/.worktrees/topic'),
        worktree('sibling', '/work/repo-other'),
      ],
    },
  ],
};

function read(path: string) {
  const asked: string[] = [];
  const program = ReadOwnerCommentsUseCase.pipe(
    Effect.flatMap((useCase) => useCase.execute({ path })),
    Effect.provide(ReadOwnerCommentsUseCase.layer),
    Effect.provide(
      Layer.mergeAll(
        Layer.succeed(ReadInventoryUseCasePort, {
          execute: () => Effect.succeed(inventory),
        }),
        Layer.succeed(ListCommentsUseCasePort, {
          execute: (input) =>
            Effect.sync(() => {
              asked.push(input.worktreeId);
              return {
                branch: input.worktreeId,
                headOid: 'h',
                comments: [],
                markdown: '',
              };
            }),
        }),
      ),
    ),
  );
  return Effect.runPromiseExit(program).then((exit) => ({ exit, asked }));
}

it('prints the comments of the innermost worktree holding the directory', async () => {
  expect((await read('/work/repo')).asked).toEqual(['main']);
  expect((await read('/work/repo/src/lib')).asked).toEqual(['main']);
  expect((await read('/work/repo/.worktrees/topic/src')).asked).toEqual([
    'nested',
  ]);
  expect((await read('/work/repo-other/docs')).asked).toEqual(['sibling']);
});

it('refuses a directory outside every known worktree', async () => {
  const { exit, asked } = await read('/work/repository');
  expect(Exit.isFailure(exit)).toBe(true);
  expect(JSON.stringify(exit)).toContain('WorktreeNotFoundError');
  expect(asked).toEqual([]);
});
