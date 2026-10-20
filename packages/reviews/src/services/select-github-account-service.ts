import type { GitHubReadError } from '../errors/github-read-error.ts';
import { Context, Effect, Layer } from 'effect';
import type {
  GitHubAccountResult,
  GitHubRepository,
} from '../models/pull-request.ts';
import { GitHubReader } from '../ports/github-reader.ts';
import { GitHubAccountStore } from '../ports/github-account-store.ts';
import {
  githubAccountCandidates,
  pickGitHubAccount,
} from '../rules/github-account.ts';

export class SelectGitHubAccountService extends Context.Service<
  SelectGitHubAccountService,
  {
    readonly execute: (
      input: GitHubRepository & { projectId: string },
    ) => Effect.Effect<GitHubAccountResult>;
  }
>()('@porcelain/reviews/SelectGitHubAccountService') {
  static readonly layer = Layer.effect(
    SelectGitHubAccountService,
    Effect.gen(function* () {
      const github = yield* GitHubReader;
      const store = yield* GitHubAccountStore;
      return {
        execute: Effect.fn('SelectGitHubAccountService.execute')(
          function* (input) {
            const repository = `${input.owner}/${input.repo}`.toLowerCase();
            const preference = yield* store.read(input);
            const override = preference?.override;
            const accountsResult = yield* github.accounts().pipe(Effect.result);
            if (accountsResult._tag === 'Failure')
              return {
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
                accounts,
                choice: undefined,
                override: override ?? undefined,
                unavailable: { kind: 'unavailable', reason: 'no-accounts' },
              };
            const candidates = githubAccountCandidates(
              accounts,
              preference,
              repository,
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
              if (choice !== undefined) {
                if (choice.source === 'detected')
                  yield* store.detect({
                    projectId: input.projectId,
                    repository,
                    account,
                  });
                return {
                  accounts,
                  choice,
                  override: override ?? undefined,
                  unavailable: undefined,
                };
              }
            }
            return {
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
