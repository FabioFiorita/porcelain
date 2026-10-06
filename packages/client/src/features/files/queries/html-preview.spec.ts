import { afterEach, describe, expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import { HtmlPreviewPlatform } from '@porcelain/client/files';
import { AtomRegistry } from 'effect/reactivity';
import {
  runRequest,
  createWorktreeConnection,
  type Transport,
} from '@porcelain/client/transport';
import { readHtmlPreview } from './html-preview.ts';

const owned: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of owned) await close();
  owned.length = 0;
});
function fixture(transport: Transport) {
  const lifetime = createWorktreeConnection({
    environmentId: 'environment-1',
    transport,
    timeoutMs: 10_000,
  });
  const registry = AtomRegistry.make();
  owned.push(async () => {
    registry.dispose();
    await lifetime.close();
  });
  return { ...lifetime, registry };
}
function preview(
  subject: ReturnType<typeof fixture>,
  document: string,
  paths: readonly string[],
) {
  const platform = Layer.succeed(HtmlPreviewPlatform, {
    render: (_, _path, read) =>
      Effect.map(read(paths), (assets) => ({
        html: JSON.stringify([...assets]),
        missing: [...assets]
          .filter(([, asset]) => asset === null)
          .map(([path]) => path),
      })),
  });
  return Effect.map(
    AtomRegistry.getResult(
      subject.registry,
      readHtmlPreview({
        connection: subject.connection,
        scope,
        path: document,
        html: '<p>Test</p>',
        platform,
      }),
    ),
    (response) => ({
      ...response,
      assets: JSON.parse(response.html) as unknown,
    }),
  );
}

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
    const subject = fixture((path, init) => {
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
    });
    const assets = await runRequest(
      preview(subject, 'index.html', [image.path, 'missing.css']),
      new AbortController().signal,
    );
    expect(assets.assets).toEqual([
      [image.path, { kind: 'asset', ...image }],
      ['missing.css', null],
    ]);
    expect(assets.missing).toEqual(['missing.css']);
    expect(sent).toEqual([
      {
        path: `/api/worktrees/${scope.worktreeId}/preview-assets`,
        method: 'POST',
        payload: { document: 'index.html', paths: [image.path, 'missing.css'] },
      },
    ]);
  });

  it('refuses a preview answer when the connection changes during transport', async () => {
    const disconnected = new Error('Another workspace is connected');
    const subject = fixture(() => {
      subject.controller.abort(disconnected);
      return Promise.resolve(
        Response.json({ assets: [{ kind: 'asset', ...image }] }),
      );
    });
    await expect(
      runRequest(
        preview(subject, 'index.html', [image.path]),
        subject.controller.signal,
      ),
    ).rejects.toBe(disconnected);
  });
});
