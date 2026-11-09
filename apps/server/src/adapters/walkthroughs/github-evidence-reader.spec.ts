import { expect, it } from 'vitest';
import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { GitHubReader, GitHubAccountStore } from '@porcelain/reviews/ports';
import { EvidenceReader } from '@porcelain/walkthroughs/ports';
import type { WalkthroughJob } from '@porcelain/walkthroughs/models';
import { LIMITS } from '../../config/limits.ts';
import { githubEvidenceReaderLayer } from './github-evidence-reader.ts';

const source =
  'https://github.com/user-attachments/assets/f52cbae9-dae7-4fa4-8905-9ef69d8718c0';
const image =
  'https://github-production-user-asset-6210df.s3.amazonaws.com/49520710/699206213-f52cbae9-dae7-4fa4-8905-9ef69d8718c0.png?X-Amz-Signature=fixture';
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const job: WalkthroughJob = {
  run: {
    id: 'run',
    projectId: 'project',
    worktreeId: 'worktree',
    pullRequestNumber: 702,
    baseOid: 'a'.repeat(40),
    headOid: 'b'.repeat(40),
    writer: { provider: 'claude', model: 'claude-opus-5-5' },
    sessionId: undefined,
    createdAt: '2026-11-09T00:00:00Z',
    state: { status: 'running' },
  },
  worktreePath: '/unused',
  files: [],
};
const github = Layer.succeed(GitHubReader, {
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
const accounts = Layer.succeed(GitHubAccountStore, {
  read: () =>
    Effect.succeed({
      repository: 'example/porcelain',
      detected: 'fixture',
      override: undefined,
    }),
  detect: () => Effect.void,
  override: () => Effect.void,
});
const readEvidence = (fetch: typeof globalThis.fetch) =>
  Effect.gen(function* () {
    const reader = yield* EvidenceReader;
    return yield* reader.read(job);
  }).pipe(
    Effect.provide(
      githubEvidenceReaderLayer(LIMITS.git).pipe(
        Layer.provide(Layer.mergeAll(NodeServices.layer, github, accounts)),
        Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
      ),
    ),
  );

it('downloads exact image bytes after allowed GitHub attachment redirects', async () => {
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
