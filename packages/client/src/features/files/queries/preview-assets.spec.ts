import { describe, expect, it } from 'vitest';
import {
  runRequest,
  type WorktreeConnection,
} from '@porcelain/client/transport';
import { readPreviewAssets } from './preview-assets.ts';

const scope = {
  projectId: '11111111111111111111111111111111',
  worktreeId: '22222222222222222222222222222222',
};
const image = {
  path: 'image #1.png',
  mediaType: 'image/png',
  base64: 'aGVsbG8=',
};

describe('portable file previews', () => {
  it('sends a preview batch and keeps unavailable assets distinguishable', async () => {
    const sent: {
      path: string;
      method: string | undefined;
      payload: unknown;
    }[] = [];
    const connection: WorktreeConnection = {
      environmentId: 'environment-1',
      request: (signal = new AbortController().signal) => ({ signal }),
      transport: (path, init) => {
        const body = init?.body;
        if (!(body instanceof Uint8Array))
          throw new Error('Expected a JSON request encoded as bytes');
        sent.push({
          path,
          method: init?.method,
          payload: JSON.parse(new TextDecoder().decode(body)),
        });
        return Promise.resolve(
          Response.json({
            assets: [
              { kind: 'asset', ...image },
              { kind: 'unavailable', path: 'missing.css' },
            ],
          }),
        );
      },
    };
    const assets = await runRequest(
      readPreviewAssets(connection, scope, 'index.html', [
        image.path,
        'missing.css',
      ]),
      new AbortController().signal,
    );
    expect([...assets]).toEqual([
      [image.path, { kind: 'asset', ...image }],
      ['missing.css', null],
    ]);
    expect(sent).toEqual([
      {
        path: `/api/worktrees/${scope.worktreeId}/preview-assets`,
        method: 'POST',
        payload: { document: 'index.html', paths: [image.path, 'missing.css'] },
      },
    ]);
  });

  it('refuses a preview answer when the connection changes during transport', async () => {
    const controller = new AbortController();
    const disconnected = new Error('Another workspace is connected');
    const connection: WorktreeConnection = {
      environmentId: 'environment-1',
      request: () => ({ signal: controller.signal }),
      transport: () => {
        controller.abort(disconnected);
        return Promise.resolve(
          Response.json({ assets: [{ kind: 'asset', ...image }] }),
        );
      },
    };
    await expect(
      runRequest(
        readPreviewAssets(connection, scope, 'index.html', [image.path]),
        controller.signal,
      ),
    ).rejects.toBe(disconnected);
  });
});
