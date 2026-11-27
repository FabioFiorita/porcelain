import {
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { Effect, Layer } from 'effect';
import { AsyncResult, AtomRegistry } from 'effect/reactivity';
import { expect, it, onTestFinished } from 'vite-plus/test';
import { commandBinding } from '../../../shared/api/command-binding.ts';
import { postReviewFailureText } from '../rules/comments.ts';
import { commentCommands } from './comments.ts';

const scope = { projectId: 'project', worktreeId: '0'.repeat(32) };
const request = {
  pullRequest: { owner: 'o', repo: 'r', number: 7 },
  headOid: 'a'.repeat(40),
  summary: '',
  bodies: { first: 'Please rename this.' },
};

async function postFailure(transport: Transport, timeoutMs = 10_000) {
  const lifetime = createWorktreeConnection(
    { environmentId: 'environment', timeoutMs, transport },
    undefined,
    Layer.empty,
  );
  onTestFinished(lifetime.close);
  const registry = AtomRegistry.make();
  const publish = commentCommands({
    connection: lifetime.connection,
    scope,
  }).publish;
  const post = commandBinding([
    AsyncResult.initial(),
    (input: typeof request) => {
      registry.set(publish, input);
      return Effect.runPromise(
        Effect.exit(
          AtomRegistry.getResult(registry, publish, { suspendOnWaiting: true }),
        ),
      );
    },
  ]);
  const error = await post.run(request).then(
    () => undefined,
    (failure: unknown) => failure,
  );
  expect(error).toBeDefined();
  return postReviewFailureText(error);
}

it.each([
  {
    outcome: 'the connection drops',
    transport: () => Promise.reject(new TypeError('Failed to fetch')),
    timeoutMs: undefined,
  },
  {
    outcome: 'the request times out',
    transport: () => new Promise<Response>(() => {}),
    timeoutMs: 200,
  },
  {
    outcome: 'the server fails after GitHub answered',
    transport: () =>
      Promise.resolve(new Response('Internal Server Error', { status: 500 })),
    timeoutMs: undefined,
  },
])(
  'tells the developer GitHub may have the review when $outcome',
  async ({ transport, timeoutMs }) => {
    expect(await postFailure(transport, timeoutMs)).toBe(
      'GitHub may have received this review. Check the pull request before posting again.',
    );
  },
);

it.each([
  {
    refusal: 'GitHub refused the review',
    statusCode: 502,
    error: 'Bad Gateway',
    message:
      'GitHub did not take this review. Check your sign-in and that the pull request is still open, then try again.',
  },
  {
    refusal: 'the pull request moved',
    statusCode: 409,
    error: 'Conflict',
    message:
      'The pull request has new commits since this preview. Review it again before posting.',
  },
])(
  'keeps the server message when $refusal',
  async ({ statusCode, error, message }) => {
    expect(
      await postFailure(() =>
        Promise.resolve(
          Response.json({ statusCode, error, message }, { status: statusCode }),
        ),
      ),
    ).toBe(message);
  },
);
