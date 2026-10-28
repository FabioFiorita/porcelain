import type { GitHubReadError } from '../errors/github-read-error.ts';
import { Context, Effect, Layer } from 'effect';
import type {
  GitHubAccountPreference,
  GitHubAccountResult,
  GitHubRepository,
} from '../models/pull-request.ts';
import { GitHubReader } from '../ports/github-reader.ts';
import {
  githubAccountCandidates,
  pickGitHubAccount,
} from '../rules/github-account.ts';

export class SelectGitHubAccountService extends Context.Service<
  SelectGitHubAccountService,
  {
    readonly execute: (
      input: GitHubRepository & {
        preference: GitHubAccountPreference | undefined;
      },
    ) => Effect.Effect<GitHubAccountResult>;
  }
>()('@porcelain/reviews/SelectGitHubAccountService') {
  static readonly layer = Layer.effect(
    SelectGitHubAccountService,
    Effect.gen(function* () {
      const github = yield* GitHubReader;
      return {
        execute: Effect.fn('SelectGitHubAccountService.execute')(
          function* (input) {
            const repository = `${input.owner}/${input.repo}`;
            const preference = input.preference;
            const override = preference?.override;
            const accountsResult = yield* github.accounts().pipe(Effect.result);
            if (accountsResult._tag === 'Failure')
              return {
                repository,
                accounts: [],
                choice: undefined,
                override: override ?? undefined,
                unavailable: {
                  kind: 'unavailable',
                  reason: accountsResult.failure.reason,
                },
              };
            const accounts = accountsResult.success;
            if (accounts.length === 0)
              return {
                repository,
                accounts,
                choice: undefined,
                override: override ?? undefined,
                unavailable: { kind: 'unavailable', reason: 'no-accounts' },
              };
            const candidates = githubAccountCandidates(
              accounts,
              preference,
              repository.toLowerCase(),
            );
            let unavailableReason: GitHubReadError['reason'] | undefined;
            for (const account of candidates) {
              const probe = yield* github
                .canRead({ ...input, account })
                .pipe(Effect.result);
              if (probe._tag === 'Failure') {
                unavailableReason = probe.failure.reason;
                continue;
              }
              const choice = pickGitHubAccount(
                [{ account, canRead: probe.success }],
                override,
              );
              if (choice !== undefined)
                return {
                  repository,
                  accounts,
                  choice,
                  override: override ?? undefined,
                  unavailable: undefined,
                };
            }
            return {
              repository,
              accounts,
              choice: undefined,
              override: override ?? undefined,
              unavailable: {
                kind: 'unavailable',
                reason: unavailableReason ?? 'no-access',
              },
            };
          },
        ),
      };
    }),
  );
}
