import { Effect } from 'effect';
import { HttpApiClient } from 'effect/http-api';
import { OwnerCommentsApi } from '@porcelain/contracts/comments';
import type { Limits } from '../config/limits.ts';
import { ownerHttpClient, ownerRequest } from './owner-client.ts';

export const printComments = Effect.fn('printComments')(function* (
  input: {
    readonly dataDirectory: string;
    readonly directory: string;
    readonly json: boolean;
  },
  stdout: (message: string) => void,
  limits: Limits,
) {
  const client = yield* HttpApiClient.makeWith(OwnerCommentsApi, {
    httpClient: ownerHttpClient(
      input.dataDirectory,
      limits.owner.requestTimeoutMs,
    ),
  });
  const view = yield* ownerRequest(
    client.ownerComments.readOwnerComments({
      query: { path: input.directory },
    }),
  );
  if (input.json) {
    stdout(
      `${JSON.stringify(
        {
          branch: view.branch,
          headOid: view.headOid,
          comments: view.comments.filter(
            (comment) => comment.publication.status === 'draft',
          ),
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  stdout(view.markdown);
});
