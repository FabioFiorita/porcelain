import { Effect } from 'effect';
import { Atom } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { ConnectionError } from '../../../shared/api/connection-error.ts';
import type { RegisterProjectResponse } from '@porcelain/contracts/projects';
import { reconnectProject, registerProject } from './projects.ts';

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
        readonly reconnectProjectId?: string;
        readonly recover: (
          project: RegisterProjectResponse,
          path: string,
        ) => void;
        readonly remote: string | null;
        readonly complete: () => void;
        readonly select: (
          target: WorktreeTarget,
        ) => Effect.Effect<void, ConnectionError>;
      },
      get,
    ) =>
      Effect.gen(function* () {
        const path = input.path.trim();
        const project = input.reconnectProjectId
          ? yield* get.setResult(reconnectProject(connection), {
              path,
              reconnectProjectId: input.reconnectProjectId,
            })
          : yield* get.setResult(registerProject(connection), path);
        if (!project.available) {
          input.recover(project, path);
          return;
        }
        const worktree = project.worktrees.find((entry) => entry.available);
        if (worktree)
          yield* input.select({
            remote: input.remote,
            projectId: project.id,
            worktreeId: worktree.id,
          });
        input.complete();
      }),
  ),
);
