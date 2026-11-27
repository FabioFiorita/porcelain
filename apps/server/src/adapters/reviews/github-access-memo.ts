import { Clock, Effect, Ref } from 'effect';

const ACCOUNTS_TTL_MS = 60_000;
const ACCESS_TTL_MS = 10 * 60_000;

type GitHubTarget = {
  readonly account: string;
  readonly owner: string;
  readonly repo: string;
};

const targetKey = (target: GitHubTarget) =>
  `${target.account}\n${target.owner}/${target.repo}`.toLowerCase();

export type GitHubAccessMemo = {
  readonly accounts: Effect.Effect<readonly string[] | undefined>;
  readonly rememberAccounts: (
    accounts: readonly string[],
  ) => Effect.Effect<void>;
  readonly forgetAccounts: Effect.Effect<void>;
  readonly readable: (target: GitHubTarget) => Effect.Effect<boolean>;
  readonly rememberReadable: (
    target: GitHubTarget,
    allowed: boolean,
  ) => Effect.Effect<void>;
  readonly forgetWhenRefused: <E>(
    target: GitHubTarget,
    refused: (error: E) => boolean,
  ) => <A, Failure extends E, R>(
    effect: Effect.Effect<A, Failure, R>,
  ) => Effect.Effect<A, Failure, R>;
};

export const lacksAccess = (error: {
  readonly _tag: string;
  readonly reason?: unknown;
}) => error.reason === 'no-access';

export const makeGitHubAccessMemo = Effect.gen(function* () {
  const known = yield* Ref.make<
    { readonly at: number; readonly accounts: readonly string[] } | undefined
  >(undefined);
  const seen = yield* Ref.make(new Map<string, number>());
  const setReadable = (target: GitHubTarget, at: number | undefined) =>
    Ref.update(seen, (entries) => {
      const next = new Map(entries);
      if (at === undefined) next.delete(targetKey(target));
      else next.set(targetKey(target), at);
      return next;
    });
  const memo: GitHubAccessMemo = {
    accounts: Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const cached = yield* Ref.get(known);
      return cached && now - cached.at < ACCOUNTS_TTL_MS
        ? cached.accounts
        : undefined;
    }),
    rememberAccounts: (accounts) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* Ref.set(
          known,
          accounts.length > 0 ? { at: now, accounts } : undefined,
        );
      }),
    forgetAccounts: Ref.set(known, undefined),
    readable: (target) =>
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        const at = (yield* Ref.get(seen)).get(targetKey(target));
        return at !== undefined && now - at < ACCESS_TTL_MS;
      }),
    rememberReadable: (target, allowed) =>
      Effect.gen(function* () {
        yield* setReadable(
          target,
          allowed ? yield* Clock.currentTimeMillis : undefined,
        );
      }),
    forgetWhenRefused: (target, refused) => (effect) =>
      effect.pipe(
        Effect.tapError((error) =>
          refused(error)
            ? Effect.andThen(
                Ref.set(known, undefined),
                setReadable(target, undefined),
              )
            : Effect.void,
        ),
      ),
  };
  return memo;
});
