import { Effect, Layer } from 'effect';
import { EventPublisher } from '../../ports/event-publisher.ts';
import { LiveConnections } from '../../runtime/live-updates/live-connections.ts';

export const webSocketEventPublisherLayer = Layer.effect(
  EventPublisher,
  Effect.gen(function* () {
    const connectionsCapability = yield* LiveConnections;
    return {
      inventoryChanged: Effect.fn('EventPublisher.inventoryChanged')(() =>
        connectionsCapability.toEveryone({ type: 'inventory' }),
      ),
      projectChanged: Effect.fn('EventPublisher.projectChanged')((input) =>
        connectionsCapability.toProject(input.projectId, {
          type: 'project',
          projectId: input.projectId,
          change: input.change,
        }),
      ),
      worktreeChanged: Effect.fn('EventPublisher.worktreeChanged')((input) =>
        connectionsCapability.toWorktree(input.worktreeId, (projectId) => ({
          type: 'worktree',
          projectId,
          worktreeId: input.worktreeId,
          change: input.change,
        })),
      ),
      filesChanged: Effect.fn('EventPublisher.filesChanged')((input) =>
        connectionsCapability.toWorktree(input.worktreeId, (projectId) => ({
          type: 'worktree',
          projectId,
          worktreeId: input.worktreeId,
          change: 'files',
        })),
      ),
      gitActionChanged: Effect.fn('EventPublisher.gitActionChanged')((input) =>
        connectionsCapability.toProjectOrWorktree(
          input.projectId,
          input.worktreeId,
          {
            type: 'git-action',
            projectId: input.projectId,
            worktreeId: input.worktreeId,
            receipt: input,
          },
        ),
      ),
    };
  }),
);
