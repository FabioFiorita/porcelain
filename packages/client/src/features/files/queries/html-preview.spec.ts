import { clientFixtures } from '../../../../spec/kit/client-fixture.ts';
import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit, Layer } from 'effect';
import { HtmlPreviewPlatform } from '@porcelain/client/files';
import { AtomRegistry } from 'effect/reactivity';

import { readHtmlPreview } from './html-preview.ts';

const fixture = clientFixtures('environment-1');

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
    const assets = await Effect.runPromise(
      preview(subject, 'index.html', [image.path, 'missing.css']),
      { signal: new AbortController().signal },
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
    const subject = fixture(() => {
      void subject.close();
      return Promise.resolve(
        Response.json({ assets: [{ kind: 'asset', ...image }] }),
      );
    });
    const exit = await Effect.runPromiseExit(
      preview(subject, 'index.html', [image.path]),
    );
    expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(
      true,
    );
  });
});
