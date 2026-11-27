import { Effect, Layer } from 'effect';
import { Atom } from 'effect/reactivity';
import type {
  RuntimeConnection,
  WorktreeScope,
} from '../../../shared/api/connection.ts';
import { clientRuntime } from '../../../shared/api/runtime.ts';
import { worktreeRead } from '../../../shared/api/worktree-read.ts';
import { readPreviewAssets } from './preview-assets.ts';

const assetRuntime = Atom.family((connection: RuntimeConnection) =>
  connection.atoms((get) =>
    Layer.provideMerge(
      readPreviewAssets(connection).layer,
      get(clientRuntime(connection).layer),
    ),
  ),
);

export const readPreviewAsset = Atom.family(
  ({
    connection,
    scope,
    document,
    path,
    streamMedia,
  }: {
    connection: RuntimeConnection;
    scope: WorktreeScope;
    document: string;
    path: string;
    streamMedia: boolean;
  }) =>
    worktreeRead(
      connection,
      scope,
      ['preview-asset', document, path, streamMedia],
      Effect.gen(function* () {
        const assets = yield* readPreviewAssets(connection);
        const answer = yield* assets.read(scope, document, [path], streamMedia);
        return answer.get(path) ?? null;
      }),
      assetRuntime(connection),
      [path],
    ),
);
