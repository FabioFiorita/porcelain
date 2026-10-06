import { Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { readPreviewAssets } from './preview-assets.ts';
import { HtmlPreviewPlatform } from '../ports/html-preview-platform.ts';

const previewRuntime = Atom.family(
  ({
    connection,
    platform,
  }: {
    connection: RuntimeConnection;
    platform: Layer.Layer<HtmlPreviewPlatform>;
  }) =>
    connection.atoms((get) =>
      Layer.provideMerge(
        Layer.merge(readPreviewAssets(connection).layer, platform),
        get(clientRuntime(connection).layer),
      ),
    ),
);

export const readHtmlPreview = Atom.family(
  ({
    connection,
    scope,
    path,
    html,
    platform,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    path: string;
    html: string;
    platform: Layer.Layer<HtmlPreviewPlatform>;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['html-preview', path, html],
      Effect.gen(function* () {
        const renderer = yield* HtmlPreviewPlatform;
        const assets = yield* readPreviewAssets(connection);
        return yield* renderer.render(html, path, (paths) =>
          assets.read(scope, path, paths),
        );
      }),
      previewRuntime({ connection, platform }),
      [path],
    ),
);
