import {
  Cause,
  Context,
  Effect,
  Exit,
  Layer,
  PubSub,
  Ref,
  Scope,
  Semaphore,
} from 'effect';
import type { LiveNotice } from '@porcelain/contracts/access';
import type { FollowedTargets } from '../../ports/followed-targets.ts';
import type { LiveChannel } from '../../ports/live-channel.ts';
import type { LiveConnector } from '../../ports/live-connector.ts';
import { Logger } from '../../ports/logger.ts';
import { ApplicationClosedError } from '../errors/application-closed-error.ts';

type Broadcast =
  | { kind: 'everyone'; notice: LiveNotice }
  | { kind: 'project'; projectId: string; notice: LiveNotice }
  | {
      kind: 'worktree';
      worktreeId: string;
      notice: (projectId: string) => LiveNotice;
    }
  | {
      kind: 'project-or-worktree';
      projectId: string;
      worktreeId: string;
      notice: LiveNotice;
    };

type ClientState = {
  closed: boolean;
  projects: ReadonlySet<string>;
  worktrees: ReadonlyMap<string, string>;
  answered: boolean;
};

type Connection = {
  scope: Scope.Closeable;
  channel: LiveChannel;
  state: Ref.Ref<ClientState>;
  subscription: PubSub.Subscription<Broadcast>;
  subscriptionScope: Scope.Closeable;
};

type Connections = {
  closed: boolean;
  active: Map<Scope.Closeable, Connection>;
};

function selected(
  event: Broadcast,
  state: ClientState,
): LiveNotice | undefined {
  if (state.closed) return undefined;
  switch (event.kind) {
    case 'everyone':
      return event.notice;
    case 'project':
      return state.projects.has(event.projectId) ? event.notice : undefined;
    case 'worktree': {
      const projectId = state.worktrees.get(event.worktreeId);
      return projectId === undefined ? undefined : event.notice(projectId);
    }
    case 'project-or-worktree':
      return state.projects.has(event.projectId) ||
        state.worktrees.get(event.worktreeId) === event.projectId
        ? event.notice
        : undefined;
  }
}

export class LiveConnections extends Context.Service<
  LiveConnections,
  LiveConnector & {
    readonly toEveryone: (notice: LiveNotice) => Effect.Effect<void>;
    readonly toProject: (
      projectId: string,
      notice: LiveNotice,
    ) => Effect.Effect<void>;
    readonly toWorktree: (
      worktreeId: string,
      notice: (projectId: string) => LiveNotice,
    ) => Effect.Effect<void>;
    readonly toProjectOrWorktree: (
      projectId: string,
      worktreeId: string,
      notice: LiveNotice,
    ) => Effect.Effect<void>;
    readonly heartbeat: () => Effect.Effect<void>;
    readonly ping: () => Effect.Effect<void>;
    readonly close: () => Effect.Effect<void>;
  }
>()('@porcelain/server/LiveConnections') {
  static readonly layer = (eventBuffer: number) =>
    Layer.effect(
      LiveConnections,
      Effect.gen(function* () {
        const loggerCapability = yield* Logger;
        const ownerScope = yield* Scope.make();
        const broadcasts = yield* PubSub.bounded<Broadcast>(eventBuffer);
        const registry = yield* Ref.make<Connections>({
          closed: false,
          active: new Map(),
        });
        const admissions = yield* Semaphore.make(1);
        const report = (cause: Cause.Cause<never>) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.interrupt
            : Effect.sync(() =>
                loggerCapability.failure({
                  kind: 'live-updates',
                  error: Cause.squash(cause),
                }),
              );
        const broadcast = Effect.fn('LiveConnections.broadcast')(
          (event: Broadcast) =>
            PubSub.publish(broadcasts, event).pipe(Effect.asVoid),
        );
        const close = yield* Effect.cached(
          Effect.uninterruptible(
            Effect.gen(function* () {
              yield* admissions.withPermit(
                Ref.update(registry, (state) => ({ ...state, closed: true })),
              );
              yield* Scope.close(ownerScope, Exit.void);
              yield* PubSub.shutdown(broadcasts);
            }),
          ),
        );
        yield* Effect.addFinalizer(() => close);
        return {
          connect: Effect.fn('LiveConnections.connect')(function* (
            channel: LiveChannel,
          ) {
            const connectionScope = yield* Effect.acquireRelease(
              Scope.fork(ownerScope),
              (scope) => Scope.close(scope, Exit.void),
            );
            const connection = yield* admissions.withPermit(
              Effect.uninterruptible(
                Effect.gen(function* () {
                  const state = yield* Ref.get(registry);
                  if (state.closed)
                    return yield* Effect.die(new ApplicationClosedError());
                  const clientState = yield* Ref.make<ClientState>({
                    closed: false,
                    projects: new Set(),
                    worktrees: new Map(),
                    answered: true,
                  });
                  const subscriptionScope = yield* Scope.fork(connectionScope);
                  const subscription = yield* PubSub.subscribe(broadcasts).pipe(
                    Effect.provideService(Scope.Scope, subscriptionScope),
                  );
                  const current: Connection = {
                    scope: connectionScope,
                    channel,
                    state: clientState,
                    subscription,
                    subscriptionScope,
                  };
                  yield* Effect.acquireRelease(
                    Effect.sync(() => {
                      state.active.set(connectionScope, current);
                    }),
                    () =>
                      Effect.gen(function* () {
                        yield* Ref.update(clientState, (client) => ({
                          ...client,
                          closed: true,
                        }));
                        yield* Ref.update(registry, (latest) => {
                          latest.active.delete(connectionScope);
                          return latest;
                        });
                      }),
                  ).pipe(Effect.provideService(Scope.Scope, connectionScope));
                  return current;
                }),
              ),
            );
            yield* Effect.gen(function* () {
              yield* channel.send({ type: 'ready' });
              yield* Effect.forkIn(
                Effect.forever(
                  Effect.gen(function* () {
                    const event = yield* PubSub.take(connection.subscription);
                    const notice = selected(
                      event,
                      yield* Ref.get(connection.state),
                    );
                    if (notice) yield* channel.send(notice);
                  }),
                ).pipe(
                  Effect.catchCause((cause) =>
                    report(cause).pipe(Effect.andThen(channel.terminate())),
                  ),
                  Effect.ensuring(
                    Effect.gen(function* () {
                      yield* Scope.close(
                        connection.subscriptionScope,
                        Exit.void,
                      );
                      yield* Ref.update(connection.state, (state) => ({
                        ...state,
                        closed: true,
                      }));
                      yield* Ref.update(registry, (state) => {
                        state.active.delete(connectionScope);
                        return state;
                      });
                    }),
                  ),
                ),
                connectionScope,
                { startImmediately: true },
              );
            }).pipe(
              Effect.onExit((exit) =>
                Exit.isFailure(exit)
                  ? Scope.close(connectionScope, exit)
                  : Effect.void,
              ),
            );
            return {
              follow: Effect.fn('LiveClient.follow')(function* (
                targets: FollowedTargets,
              ) {
                const active = yield* Ref.modify(connection.state, (state) =>
                  state.closed
                    ? ([false, state] as const)
                    : ([
                        true,
                        {
                          ...state,
                          projects: new Set(targets.projects),
                          worktrees: new Map(
                            targets.worktrees.map((entry) => [
                              entry.worktreeId,
                              entry.projectId,
                            ]),
                          ),
                        },
                      ] as const),
                );
                if (active) yield* channel.send({ type: 'subscribed' });
              }),
              answered: () =>
                Ref.update(connection.state, (state) => ({
                  ...state,
                  answered: true,
                })),
              close: () => Scope.close(connectionScope, Exit.void),
            };
          }),
          toEveryone: (notice: LiveNotice) =>
            broadcast({ kind: 'everyone', notice }),
          toProject: (projectId: string, notice: LiveNotice) =>
            broadcast({ kind: 'project', projectId, notice }),
          toWorktree: (
            worktreeId: string,
            notice: (projectId: string) => LiveNotice,
          ) => broadcast({ kind: 'worktree', worktreeId, notice }),
          toProjectOrWorktree: (
            projectId: string,
            worktreeId: string,
            notice: LiveNotice,
          ) =>
            broadcast({
              kind: 'project-or-worktree',
              projectId,
              worktreeId,
              notice,
            }),
          heartbeat: () =>
            broadcast({ kind: 'everyone', notice: { type: 'heartbeat' } }),
          ping: Effect.fn('LiveConnections.ping')(function* () {
            const connections = yield* Ref.get(registry).pipe(
              Effect.map((state) => [...state.active.values()]),
            );
            yield* Effect.forEach(
              connections,
              (connection) =>
                Effect.gen(function* () {
                  const answered = yield* Ref.modify(
                    connection.state,
                    (state) =>
                      [state.answered, { ...state, answered: false }] as const,
                  );
                  if (!answered) {
                    yield* Scope.close(connection.scope, Exit.void);
                    yield* connection.channel.terminate();
                  } else yield* connection.channel.ping();
                }).pipe(Effect.catchCause(report)),
              { discard: true },
            );
          }),
          close: () => close,
        };
      }),
    );
}
