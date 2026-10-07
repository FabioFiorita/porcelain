import { Cause, Effect, Schema } from 'effect';
import { expect } from 'vitest';
import { it } from '@effect/vitest';
import type { ReadFileAssetResponse } from '@porcelain/contracts/files';
import { collectHtmlAssets } from './html-assets.ts';

class AssetReadFailure extends Schema.TaggedError<AssetReadFailure>()(
  'AssetReadFailure',
  {},
) {}

const stylesheet: ReadFileAssetResponse = {
  path: 'style.css',
  mediaType: 'text/css',
  base64: btoa('body { background: url(image.png) }'),
};
const image: ReadFileAssetResponse = {
  path: 'image.png',
  mediaType: 'image/png',
  base64: 'aW1hZ2U=',
};

it.effect('collects nested stylesheets once and retains missing assets', () =>
  Effect.gen(function* () {
    const batches: string[][] = [];
    const collected = yield* collectHtmlAssets(
      ['style.css', 'style.css', 'missing.png'],
      (paths) =>
        Effect.sync(() => {
          batches.push(paths);
          return new Map(
            paths.map((path) => [
              path,
              path === 'style.css'
                ? stylesheet
                : path === 'image.png'
                  ? image
                  : null,
            ]),
          );
        }),
      (css) => {
        expect(css).toBe('body { background: url(image.png) }');
        return ['image.png', 'style.css'];
      },
    );
    expect(batches).toEqual([['style.css', 'missing.png'], ['image.png']]);
    expect([...collected]).toEqual([
      ['style.css', stylesheet],
      ['missing.png', null],
      ['image.png', image],
    ]);
  }),
);

it.effect(
  'bounds asset acquisition and marks excess references unavailable',
  () =>
    Effect.gen(function* () {
      const paths = Array.from(
        { length: 66 },
        (_, index) => `image-${index}.png`,
      );
      let requested: string[] = [];
      const collected = yield* collectHtmlAssets(
        paths,
        (paths) =>
          Effect.sync(() => {
            requested = paths;
            return new Map(paths.map((path) => [path, image]));
          }),
        () => [],
      );
      expect(requested).toHaveLength(64);
      expect(requested[63]).toBe('image-63.png');
      expect(collected.get('image-63.png')).toEqual(image);
      expect(collected.get('image-64.png')).toBeNull();
      expect(collected.get('image-65.png')).toBeNull();
    }),
);

it.effect(
  'propagates a failed asset read before acquiring dependent resources',
  () =>
    Effect.gen(function* () {
      const result = yield* Effect.exit(
        collectHtmlAssets(
          ['style.css'],
          () => Effect.fail(new AssetReadFailure()),
          () => ['image.png'],
        ),
      );
      expect(result._tag).toBe('Failure');
      if (result._tag === 'Failure')
        expect(Cause.squash(result.cause)).toBeInstanceOf(AssetReadFailure);
    }),
);
