import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import { registerProject } from './projects.ts';

type WorktreeTarget = {
  readonly remote: string | null;
  readonly projectId: string;
  readonly worktreeId: string;
};

export const openProject = Atom.family((connection: RuntimeConnection) =>
  Atom.fn(
    (
      input: {
        readonly path: string;
        readonly remote: string | null;
        readonly complete: () => void;
        readonly select: (
          target: WorktreeTarget,
        ) => Effect.Effect<void, ConnectionError>;
      },
      get,
    ) =>
      Effect.gen(function* () {
        const project = yield* get.setResult(
          registerProject(connection),
          input.path.trim(),
        );
        const worktree = project.worktrees.find((entry) => entry.available);
        input.complete();
        if (worktree)
          yield* input.select({
            remote: input.remote,
            projectId: project.id,
            worktreeId: worktree.id,
          });
      }),
  ),
);
