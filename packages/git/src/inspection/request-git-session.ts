import type { CheckoutFilterFailure } from './dtos/checkout-session-failure.ts';
import { Duration, Effect, Exit } from 'effect';
import { verifyCheckoutEffect } from './commands/verify-checkout.ts';
import { runGitEffect } from '../shared/commands/run-git.ts';
import type {
  CheckoutSession,
  EffectCheckoutSession,
  EffectGitSession,
} from './interfaces/git-session.ts';
import type { ChildProcessSpawner } from 'effect/process';
import type { GitLimits } from '../shared/dtos/git-limits.ts';

const makeCheckoutSession = Effect.fn('Git.makeCheckoutSession')(function* (
  path: string,
  metadataIdentity: string,
  repositoryIdentity: string,
  limits: GitLimits,
) {
  const [verified, invalidate] = yield* Effect.cachedInvalidateWithTTL(
    verifyCheckoutEffect(path, metadataIdentity, repositoryIdentity, limits),
    Duration.infinity,
  );
  const verify = verified.pipe(
    Effect.onExit((exit) => (Exit.isFailure(exit) ? invalidate : Effect.void)),
  );
  let filters:
    | Effect.Effect<
        string[],
        CheckoutFilterFailure,
        ChildProcessSpawner.ChildProcessSpawner
      >
    | undefined;
  return {
    path,
    verify: () => verify,
    confirm: () => Effect.andThen(invalidate, verify),
    conversionFilters: (
      read: Effect.Effect<
        string[],
        CheckoutFilterFailure,
        ChildProcessSpawner.ChildProcessSpawner
      >,
    ) =>
      Effect.gen(function* () {
        if (filters === undefined)
          filters = (yield* Effect.cached(read)).pipe(
            Effect.onExit((exit) =>
              Effect.sync(() => {
                if (Exit.isFailure(exit)) filters = undefined;
              }),
            ),
          );
        return yield* filters;
      }),
  } satisfies EffectCheckoutSession;
});

export const makeGitSession = Effect.fn('Git.makeSession')(
  (limits: GitLimits) =>
    Effect.sync(() => {
      const checkouts = new Map<string, EffectCheckoutSession>();
      return {
        checkout: Effect.fn('Git.checkoutSession')(function* (
          path: string,
          metadataIdentity: string,
          repositoryIdentity: string,
        ) {
          const key = `${path}\0${metadataIdentity}\0${repositoryIdentity}`;
          const existing = checkouts.get(key);
          if (existing) return existing;
          const created = yield* makeCheckoutSession(
            path,
            metadataIdentity,
            repositoryIdentity,
            limits,
          );
          checkouts.set(key, created);
          return created;
        }),
        confirmAll: Effect.fn('Git.confirmAll')(function* () {
          for (const checkout of checkouts.values()) yield* checkout.confirm();
        }),
      } satisfies EffectGitSession;
    }),
);

export function promiseCheckoutSession(
  checkout: EffectCheckoutSession,
): CheckoutSession {
  return {
    path: checkout.path,
    verify: (signal) => runGitEffect(checkout.verify(), signal),
    confirm: (signal) => runGitEffect(checkout.confirm(), signal),
  };
}
