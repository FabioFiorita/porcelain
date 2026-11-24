import { GitHubReadError } from '@porcelain/reviews/errors';
import type { githubPullRequestSchema } from '@porcelain/reviews/models';
import { expect, it } from 'vite-plus/test';
import { Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { GitHubReader, GitHubAccountStore } from '@porcelain/reviews/ports';
import { EvidenceReader } from '@porcelain/walkthroughs/ports';
import { githubEvidenceReaderLayer } from './github-evidence-reader.ts';

const source =
  'https://github.com/user-attachments/assets/f52cbae9-dae7-4fa4-8905-9ef69d8718c0';
const image =
  'https://github-production-user-asset-6210df.s3.amazonaws.com/49520710/699206213-f52cbae9-dae7-4fa4-8905-9ef69d8718c0.png?X-Amz-Signature=fixture';
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const target = {
  projectId: 'project',
  number: 702,
  headOid: 'b'.repeat(40),
  repository: { owner: 'example', repo: 'porcelain' },
};
const githubReader = GitHubReader.of({
  accounts: () => Effect.succeed(['fixture']),
  canRead: () => Effect.succeed(true),
  checks: () => Effect.die('Unexpected checks read'),
  list: () => Effect.die('Unexpected pull request list'),
  read: () =>
    Effect.succeed({
      number: 702,
      title: 'Public change',
      url: 'https://github.com/example/porcelain/pull/702',
      state: 'OPEN' as const,
      isDraft: false,
      author: null,
      headRefName: 'feature',
      updatedAt: '2026-11-09T00:00:00Z',
      commits: { nodes: [] },
      body: 'A screenshot',
      bodyHTML: `<img src="${source}">`,
      baseRefName: 'main',
      headRefOid: 'b'.repeat(40),
      mergeable: 'MERGEABLE',
      labels: { nodes: [], pageInfo: { hasNextPage: false } },
      comments: { nodes: [], pageInfo: { hasNextPage: false } },
      reviews: { nodes: [], pageInfo: { hasNextPage: false } },
    }),
});
const github = Layer.succeed(GitHubReader, githubReader);
const accountStore = GitHubAccountStore.of({
  read: () =>
    Effect.succeed({
      repository: 'example/porcelain',
      detected: 'fixture',
      override: undefined,
    }),
  detect: () => Effect.void,
  override: () => Effect.void,
});
const accounts = Layer.succeed(GitHubAccountStore, accountStore);
const readEvidence = (
  fetch: typeof globalThis.fetch,
  input = target,
  readerLayer = github,
  accountsLayer = accounts,
) =>
  Effect.gen(function* () {
    const reader = yield* EvidenceReader;
    return yield* reader.read(input);
  }).pipe(
    Effect.provide(
      githubEvidenceReaderLayer.pipe(
        Layer.provide(Layer.mergeAll(readerLayer, accountsLayer)),
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
      ),
    ),
  );

it.each(['unreadable', 'rate-limited'] as const)(
  'reads evidence from the captured repository when the other repository has the same head and the first account is %s',
  async (firstAccount) => {
    const reads: Array<{
      owner: string;
      repo: string;
      number: number;
      account: string;
    }> = [];
    const readerLayer = Layer.succeed(GitHubReader, {
      ...githubReader,
      accounts: () => Effect.succeed(['fixture', 'second']),
      canRead: ({ owner, repo, account }) =>
        account === 'fixture' && firstAccount === 'rate-limited'
          ? Effect.fail(new GitHubReadError({ reason: 'rate-limited' }))
          : Effect.succeed(
              owner === 'captured' &&
                repo === 'original' &&
                account === 'second',
            ),
      read: (input) => {
        reads.push(input);
        return githubReader.read(input).pipe(
          Effect.map((pr) => ({
            ...pr,
            title: `${input.owner}/${input.repo}`,
            bodyHTML: undefined,
          })),
        );
      },
    });
    const captured = {
      ...target,
      repository: { owner: 'captured', repo: 'original' },
    };
    const evidence = await Effect.runPromise(
      readEvidence(
        async () => {
          throw new Error('Unexpected image request');
        },
        captured,
        readerLayer,
      ),
    );
    expect(evidence.title).toBe('captured/original');
    expect(reads).toEqual([
      { owner: 'captured', repo: 'original', number: 702, account: 'second' },
    ]);
  },
);

it('attaches PR evidence with a matching captured head', async () => {
  const requested: string[] = [];
  const redirects: (string | undefined)[] = [];
  const evidence = await Effect.runPromise(
    readEvidence(async (input, options) => {
      const url = input instanceof Request ? input.url : input.toString();
      requested.push(url);
      redirects.push(options?.redirect);
      return url === source
        ? new Response(null, { status: 302, headers: { location: image } })
        : new Response(bytes, { headers: { 'content-type': 'image/png' } });
    }),
  );
  expect(requested).toEqual([source, image]);
  expect(redirects).toEqual(['manual', 'manual']);
  expect(evidence.assets).toHaveLength(1);
  expect(evidence.assets[0]?.id).toEqual(expect.any(String));
  expect(
    evidence.assets.map(({ bytes, mediaType, caption }) => ({
      bytes,
      mediaType,
      caption,
    })),
  ).toEqual([
    {
      bytes: Buffer.from(bytes),
      mediaType: 'image/png',
      caption: 'Image attached to the pull request',
    },
  ]);
});
it.each([
  'https://example.com/private.png',
  'https://private-user-images.githubusercontent.com.evil.example/private.png',
  'http://private-user-images.githubusercontent.com/private.png',
  'https://github.com/other/private.png',
  'https://unrelated.s3.amazonaws.com/private.png',
  'https://github-production-user-asset-6210df.s3.amazonaws.com.evil.example/private.png',
  'https://github-production-user-asset-6210df.evil.example/private.png',
])(
  'refuses a redirect outside the image allowlist: %s',
  async (destination) => {
    const requested: string[] = [];
    const evidence = await Effect.runPromise(
      readEvidence(async (input) => {
        requested.push(input instanceof Request ? input.url : input.toString());
        return requested.length === 1
          ? new Response(null, { status: 302, headers: { location: image } })
          : new Response(null, {
              status: 307,
              headers: { location: destination },
            });
      }),
    );
    expect(requested).toEqual([source, image]);
    expect(evidence.assets).toEqual([]);
  },
);
it('stops a redirect loop after five redirects', async () => {
  const requested: string[] = [];
  const evidence = await Effect.runPromise(
    readEvidence(async (input) => {
      requested.push(input instanceof Request ? input.url : input.toString());
      return new Response(null, {
        status: 302,
        headers: { location: '/user-attachments/assets/loop' },
      });
    }),
  );
  expect(requested).toHaveLength(6);
  expect(evidence.assets).toEqual([]);
});

it('reads matching images and checks but never fetches images at another commit or without GitHub access', async () => {
  let head = 'local';
  let account: string | undefined = 'fixture';
  let outage = false;
  const fetched: string[] = [];
  const fetchImage: typeof fetch = async (input) => {
    fetched.push(input instanceof Request ? input.url : input.toString());
    return new Response(new Uint8Array([137, 80, 78, 71]), {
      headers: { 'content-type': 'image/png' },
    });
  };
  const pr: typeof githubPullRequestSchema.Type = {
    number: 42,
    title: 'Change',
    body: 'Change',
    bodyHTML: '<img src="https://github.com/user-attachments/assets/fixture">',
    state: 'OPEN',
    url: 'https://github.com/o/r/pull/42',
    isDraft: false,
    author: { login: 'fixture' },
    headRefName: 'topic',
    baseRefName: 'main',
    headRefOid: 'local',
    updatedAt: '2026-11-10T00:00:00Z',
    mergeable: 'MERGEABLE',
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: {
              state: 'SUCCESS',
              contexts: {
                nodes: [
                  {
                    __typename: 'CheckRun',
                    name: 'Tests',
                    status: 'COMPLETED',
                    conclusion: 'SUCCESS',
                    detailsUrl: null,
                  },
                  {
                    __typename: 'StatusContext',
                    context: 'Package',
                    state: 'SUCCESS',
                    targetUrl: null,
                  },
                ],
                pageInfo: { hasNextPage: true },
              },
            },
          },
        },
      ],
    },
    labels: { nodes: [], pageInfo: { hasNextPage: false } },
    comments: { nodes: [], pageInfo: { hasNextPage: false } },
    reviews: { nodes: [], pageInfo: { hasNextPage: false } },
  };
  const dependencies = Layer.mergeAll(
    Layer.succeed(FetchHttpClient.Fetch, fetchImage),
    Layer.succeed(GitHubAccountStore, {
      read: () =>
        Effect.succeed({
          repository: 'o/r',
          detected: account,
          override: undefined,
        }),
      detect: () => Effect.void,
      override: () => Effect.void,
    }),
    Layer.succeed(GitHubReader, {
      accounts: () => Effect.succeed(account === undefined ? [] : [account]),
      canRead: () => Effect.succeed(true),
      read: () =>
        outage
          ? Effect.fail(new GitHubReadError({ reason: 'invalid-response' }))
          : Effect.succeed({ ...pr, headRefOid: head }),
      list: () => Effect.die('Unused'),
      checks: () => Effect.die('Unused'),
    }),
  );
  const read = () =>
    Effect.runPromise(
      Effect.gen(function* () {
        return yield* (yield* EvidenceReader).read({
          projectId: 'project',
          number: 42,
          headOid: 'local',
          repository: { owner: 'o', repo: 'r' },
        });
      }).pipe(
        Effect.provide(
          githubEvidenceReaderLayer.pipe(Layer.provide(dependencies)),
        ),
      ),
    );
  const matching = await read();
  expect(matching.checks).toEqual({
    state: 'SUCCESS',
    checksTruncated: true,
    results: [
      { name: 'Tests', status: 'SUCCESS' },
      { name: 'Package', status: 'SUCCESS' },
    ],
  });
  expect(matching.assets[0]?.bytes).toEqual(Buffer.from([137, 80, 78, 71]));
  expect(fetched).toEqual([
    'https://github.com/user-attachments/assets/fixture',
  ]);
  head = 'behind';
  expect(await read()).toMatchObject({
    unavailable: 'head_mismatch',
    assets: [],
    checks: undefined,
  });
  account = undefined;
  expect(await read()).toMatchObject({
    unavailable: 'github_account',
    assets: [],
  });
  account = 'fixture';
  outage = true;
  expect(await read()).toMatchObject({
    unavailable: 'github_unavailable',
    assets: [],
  });
  expect(fetched).toEqual([
    'https://github.com/user-attachments/assets/fixture',
  ]);
});
