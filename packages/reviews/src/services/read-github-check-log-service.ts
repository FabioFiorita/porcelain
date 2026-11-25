import { Context, Effect, Layer } from 'effect';
import type {
  CheckLogExcerpt,
  CheckLogUnavailableReason,
  GitHubRepository,
} from '../models/pull-request.ts';
import type { GitHubReadError } from '../errors/github-read-error.ts';
import { GitHubCheckReader } from '../ports/github-check-reader.ts';
import { checkLogExcerpt } from '../rules/check-log.ts';
export class ReadGitHubCheckLogService extends Context.Service<
  ReadGitHubCheckLogService,
  {
    readonly execute: (
      input: GitHubRepository & {
        account: string;
        jobId: number;
        from?: string | undefined;
        to?: string | undefined;
      },
    ) => Effect.Effect<
      | { readonly kind: 'available'; readonly excerpt: CheckLogExcerpt }
      | {
          readonly kind: 'unavailable';
          readonly reason: CheckLogUnavailableReason;
        },
      GitHubReadError
    >;
  }
>()('@porcelain/reviews/ReadGitHubCheckLogService') {
  static readonly layer = Layer.effect(
    ReadGitHubCheckLogService,
    Effect.gen(function* () {
      const github = yield* GitHubCheckReader;
      return {
        execute: Effect.fn('ReadGitHubCheckLogService.execute')(function* ({
          from,
          to,
          ...input
        }) {
          const log = yield* github.jobLog(input);
          if (log.kind !== 'log')
            return { kind: 'unavailable' as const, reason: log.kind };
          return {
            kind: 'available' as const,
            excerpt: checkLogExcerpt(log.text, { from, to }),
          };
        }),
      };
    }),
  );
}
