import {
  ownerHttpClient,
  ownerClient,
  runOwner,
} from '../../src/cli/owner-client.ts';
import { Effect } from 'effect';
import { HttpClientRequest } from 'effect/http';
import { OwnerRequestError } from '../../src/cli/errors/owner-request-error.ts';

const ANSWER_WITHIN_MS = 5000;

export function askServerOwner(
  dataDirectory: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<unknown> {
  const request = HttpClientRequest.make(method)(path);
  return runOwner(
    Effect.gen(function* () {
      const response = yield* ownerHttpClient(
        dataDirectory,
        ANSWER_WITHIN_MS,
      ).execute(
        body === undefined
          ? request
          : yield* HttpClientRequest.bodyJson(request, body),
      );
      const json: unknown = yield* response.json;
      if (response.status !== 200)
        return yield* Effect.die(new OwnerRequestError(JSON.stringify(json)));
      return json;
    }),
  );
}

export function ownerStatus(dataDirectory: string) {
  return runOwner(
    ownerClient(dataDirectory, ANSWER_WITHIN_MS).ownerStatus.readOwnerStatus(),
  );
}
