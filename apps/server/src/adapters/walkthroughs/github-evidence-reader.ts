import { randomUUID } from 'node:crypto';
import { Effect, Layer, Option } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { GitHubReader, GitHubAccountStore } from '@porcelain/reviews/ports';
import { githubAccountCandidates } from '@porcelain/reviews/rules';
import { EvidenceReader } from '@porcelain/walkthroughs/ports';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type {
  EvidenceAsset,
  WalkthroughEvidence,
} from '@porcelain/walkthroughs/models';

function withoutEvidence(
  unavailable: WalkthroughEvidence['unavailable'],
): WalkthroughEvidence {
  return { title: '', body: '', checks: undefined, assets: [], unavailable };
}

function allowedImageUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    [
      'private-user-images.githubusercontent.com',
      'user-images.githubusercontent.com',
      'github-production-user-asset-6210df.s3.amazonaws.com',
      'github.com',
    ].includes(url.hostname) &&
    (url.hostname !== 'github.com' ||
      url.pathname.startsWith('/user-attachments/assets/'))
  );
}
function githubImageUrls(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)]
        .map((match) => (match[1] ?? '').replaceAll('&amp;', '&'))
        .filter((value) => {
          try {
            return allowedImageUrl(new URL(value));
          } catch {
            return false;
          }
        }),
    ),
  ].slice(0, 20);
}
export const githubEvidenceReaderLayer = Layer.effect(
  EvidenceReader,
  Effect.gen(function* () {
    const fetch = yield* FetchHttpClient.Fetch;
    const github = yield* GitHubReader;
    const accounts = yield* GitHubAccountStore;
    return EvidenceReader.of({
      read: Effect.fn('EvidenceReader.read')(
        function* ({ projectId, repository, number, headOid }) {
          const preference = yield* accounts.read({ projectId });
          const repositoryKey =
            `${repository.owner}/${repository.repo}`.toLowerCase();
          const candidates = githubAccountCandidates(
            yield* github.accounts(),
            preference?.repository.toLowerCase() === repositoryKey
              ? preference
              : undefined,
            repositoryKey,
          );
          let probeFailed = false;
          const account = yield* Effect.findFirst(candidates, (account) =>
            github.canRead({ ...repository, account }).pipe(
              Effect.orElseSucceed(() => {
                probeFailed = true;
                return false;
              }),
            ),
          );
          if (Option.isNone(account))
            return withoutEvidence(
              probeFailed ? 'github_unavailable' : 'github_account',
            );
          const pr = yield* github.read({
            ...repository,
            account: account.value,
            number,
          });
          if (pr.headRefOid !== headOid)
            return withoutEvidence('head_mismatch');
          const rollup = pr.commits.nodes[0]?.commit.statusCheckRollup;
          const checks = rollup
            ? `${rollup.state}: ${rollup.contexts.nodes.map((check) => (check.__typename === 'CheckRun' ? `${check.name}: ${check.conclusion ?? check.status}` : `${check.context}: ${check.state}`)).join('; ')}`
            : undefined;
          const assets: EvidenceAsset[] = [];
          for (const url of githubImageUrls(pr.bodyHTML ?? '')) {
            const asset = yield* Effect.tryPromise({
              try: async () => {
                const signal = AbortSignal.timeout(15000);
                let destination = new URL(url);
                let response: Response;
                for (let redirects = 0; ; redirects++) {
                  if (!allowedImageUrl(destination)) return undefined;
                  response = await fetch(destination, {
                    signal,
                    redirect: 'manual',
                  });
                  if (![301, 302, 303, 307, 308].includes(response.status))
                    break;
                  await response.body?.cancel();
                  const location = response.headers.get('location');
                  if (!location || redirects === 5) return undefined;
                  destination = new URL(location, destination);
                }
                const mediaType =
                  (response.headers.get('content-type') ?? '').split(';')[0] ??
                  '';
                if (
                  !response.ok ||
                  ![
                    'image/png',
                    'image/jpeg',
                    'image/webp',
                    'image/gif',
                  ].includes(mediaType)
                )
                  return undefined;
                const reader = response.body?.getReader();
                if (!reader) return undefined;
                const chunks: Uint8Array[] = [];
                let size = 0;
                try {
                  while (true) {
                    const next:
                      | { done: true; value?: undefined }
                      | { done: false; value: Uint8Array } =
                      await reader.read();
                    if (next.done) break;
                    size += next.value.byteLength;
                    if (size > 10 * 1024 * 1024) return undefined;
                    chunks.push(next.value);
                  }
                  return {
                    id: randomUUID(),
                    mediaType,
                    bytes: Buffer.concat(chunks),
                    caption: 'Image attached to the pull request',
                  };
                } finally {
                  await reader.cancel();
                }
              },
              catch: () =>
                new WalkthroughFailedError({
                  kind: 'other',
                  message: 'A pull request image could not be read.',
                }),
            }).pipe(Effect.orElseSucceed(() => undefined));
            if (asset) assets.push(asset);
          }
          return { title: pr.title, body: pr.body, checks, assets };
        },
        Effect.orElseSucceed(() => withoutEvidence('github_unavailable')),
      ),
    });
  }),
);
