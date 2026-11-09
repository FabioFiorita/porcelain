import { randomUUID } from 'node:crypto';
import { Effect, Layer } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { GitHubReader, GitHubAccountStore } from '@porcelain/reviews/ports';
import { EvidenceReader } from '@porcelain/walkthroughs/ports';
import { WalkthroughFailedError } from '@porcelain/walkthroughs/errors';
import type { EvidenceAsset } from '@porcelain/walkthroughs/models';
import { captureGitPlatform, readOriginUrl } from '@porcelain/git/discovery';
import type { Limits } from '../../config/limits.ts';

function allowedImageUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    url.port === '' &&
    [
      'private-user-images.githubusercontent.com',
      'user-images.githubusercontent.com',
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
export const githubEvidenceReaderLayer = (limits: Limits['git']) =>
  Layer.effect(
    EvidenceReader,
    Effect.gen(function* () {
      const fetch = yield* FetchHttpClient.Fetch;
      const github = yield* GitHubReader;
      const accounts = yield* GitHubAccountStore;
      const provideGit = yield* captureGitPlatform();
      return EvidenceReader.of({
        read: Effect.fn('EvidenceReader.read')(
          function* (job) {
            if (job.run.pullRequestNumber === undefined)
              return { title: '', body: '', checks: undefined, assets: [] };
            let preference = yield* accounts.read({
              projectId: job.run.projectId,
            });
            if (!preference) {
              const origin = yield* readOriginUrl(
                job.worktreePath,
                limits,
              ).pipe(provideGit);
              const repository = (origin ?? '')
                .trim()
                .replace(/^.*github.com[:/]/, '')
                .replace(/\.git$/, '');
              const available = yield* github.accounts();
              const account = available[0];
              if (!account)
                return yield* new WalkthroughFailedError({
                  kind: 'other',
                  message: 'Sign in to GitHub to read this pull request.',
                });
              preference = {
                repository,
                detected: account,
                override: undefined,
              };
            }
            const [owner, repo] = preference.repository.split('/');
            const account = preference.override ?? preference.detected;
            if (!owner || !repo || !account)
              return yield* new WalkthroughFailedError({
                kind: 'other',
                message: 'Choose a GitHub account for this project.',
              });
            const pr = yield* github.read({
              owner,
              repo,
              account,
              number: job.run.pullRequestNumber,
            });
            if (pr.headRefOid !== job.run.headOid)
              return yield* new WalkthroughFailedError({
                kind: 'other',
                message:
                  'The pull request head no longer matches the pinned walkthrough head.',
              });
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
                    (response.headers.get('content-type') ?? '').split(
                      ';',
                    )[0] ?? '';
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
          Effect.mapError(
            () =>
              new WalkthroughFailedError({
                kind: 'other',
                message:
                  'The pull request evidence could not be read from GitHub.',
              }),
          ),
        ),
      });
    }),
  );
