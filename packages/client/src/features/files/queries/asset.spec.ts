import { expect, it } from 'vitest';
import type { WorktreeConnection } from '@porcelain/client/transport';
import { assetQueryOptions } from './asset.ts';
const scope = {
  projectId: '11111111111111111111111111111111',
  worktreeId: '22222222222222222222222222222222',
};
const image = {
  path: 'image #1.png',
  mediaType: 'image/png',
  base64: 'aGVsbG8=',
};
it('isolates the image cache by connection and encodes the asset path once', async () => {
  const sent: string[] = [];
  const connection: WorktreeConnection = {
    environmentId: 'environment-1',
    cacheIdentity: ['paired-device-1'],
    request: (signal = new AbortController().signal) => ({ signal }),
    transport: (path) => {
      sent.push(path);
      return Promise.resolve(Response.json(image));
    },
  };
  const options = assetQueryOptions(scope, connection, image.path);
  expect(options.queryKey).toEqual([
    'review',
    'environment-1',
    scope.projectId,
    scope.worktreeId,
    'asset',
    image.path,
    'paired-device-1',
  ]);
  await expect(
    options.queryFn({ signal: new AbortController().signal }),
  ).resolves.toEqual(image);
  expect(sent).toEqual([
    `/api/worktrees/${scope.worktreeId}/asset?path=image+%231.png`,
  ]);
});
