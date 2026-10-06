import { Context, Effect, Layer } from 'effect';
import { withSignal } from '@porcelain/effects';
import { AccessStore } from '../store.ts';
import { EnvironmentMutations } from '../store/environment-mutations.ts';
import { FileDrafts } from '../../files/store.ts';
import { WorkspaceSelectionCleanup } from '../../projects/ports/workspace-selection-cleanup.ts';
import { ConnectionError } from '../../../shared/api/connection-error.ts';
import { UNSAVED_DRAFTS_MESSAGE } from '../rules/connection-error-message.ts';
import { remoteLink } from '../rules/pairing-link.ts';
import { AccessPlatform } from '../ports/access-platform.ts';
import { pairEnvironment } from './pairing.ts';

const makeEnvironmentCommands = Effect.gen(function* () {
  const access = yield* AccessStore;
  const platform = yield* AccessPlatform;
  const mutations = yield* EnvironmentMutations;
  const drafts = yield* FileDrafts;
  const selection = yield* WorkspaceSelectionCleanup;
  return {
    read: Effect.fn('Environments.read')(() =>
      mutations.run('access', access.load()),
    ),
    pair: Effect.fn('Environments.pair')(
      (input: {
        readonly value: string;
        readonly localEnvironmentId?: string | undefined;
        readonly signal?: AbortSignal;
      }) => {
        const work = mutations.run(
          'access',
          Effect.gen(function* () {
            if (
              input.localEnvironmentId &&
              remoteLink(input.value)?.environmentId ===
                input.localEnvironmentId
            )
              return yield* Effect.fail(
                new ConnectionError({
                  message: 'That link is for this computer.',
                }),
              );
            return yield* pairEnvironment(input.value).pipe(
              Effect.provideService(AccessStore, access),
              Effect.provideService(AccessPlatform, platform),
            );
          }),
        );
        return input.signal ? withSignal(work, input.signal) : work;
      },
    ),
    forget: Effect.fn('Environments.forget')((environmentId: string) =>
      mutations.run(
        'selection',
        Effect.gen(function* () {
          if (!(yield* drafts.save(environmentId)))
            return yield* Effect.fail(
              new ConnectionError({ message: UNSAVED_DRAFTS_MESSAGE }),
            );
          yield* Effect.gen(function* () {
            yield* access.forget(environmentId);
            yield* selection.forgetEnvironment(environmentId);
            yield* drafts.drop(environmentId);
          }).pipe(Effect.uninterruptible);
        }),
      ),
    ),
  };
});

export class EnvironmentCommands extends Context.Service<
  EnvironmentCommands,
  Effect.Success<typeof makeEnvironmentCommands>
>()('@porcelain/client/EnvironmentCommands') {
  static readonly layer = Layer.effect(
    EnvironmentCommands,
    makeEnvironmentCommands,
  );
}
