import {
  FILE_PREVIEW_MAX_ASSETS,
  FILE_PREVIEW_MAX_BYTES,
  FILE_PREVIEW_MAX_ROUNDS,
} from '../../../config/limits.ts';
import { Effect } from 'effect';
import type { ReadFileAssetResponse as AssetResponse } from '@porcelain/contracts/files';
function decode(asset: AssetResponse) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0)),
  );
}

export const collectHtmlAssets = Effect.fn('HtmlPreview.collectAssets')(
  function* <E>(
    initial: string[],
    readAssets: (
      paths: string[],
    ) => Effect.Effect<Map<string, AssetResponse | null>, E>,
    cssReferences: (css: string, path: string) => string[],
  ) {
    const assets = new Map<string, AssetResponse | null>();
    let bytes = 0;
    let wanted = initial;
    for (let round = 0; round < FILE_PREVIEW_MAX_ROUNDS; round += 1) {
      const fresh = [...new Set(wanted)].filter(
        (candidate) => !assets.has(candidate),
      );
      if (fresh.length === 0) return assets;
      const room = FILE_PREVIEW_MAX_ASSETS - assets.size;
      if (room <= 0) {
        for (const candidate of fresh) assets.set(candidate, null);
        return assets;
      }
      const batch = fresh.slice(0, room);
      for (const candidate of fresh.slice(room)) assets.set(candidate, null);
      const answered = yield* readAssets(batch);
      const next: string[] = [];
      for (const candidate of batch) {
        const asset = answered.get(candidate) ?? null;
        if (asset === null) {
          assets.set(candidate, null);
          continue;
        }
        bytes += asset.base64.length;
        if (bytes > FILE_PREVIEW_MAX_BYTES) {
          assets.set(candidate, null);
          continue;
        }
        assets.set(candidate, asset);
        if (asset.mediaType === 'text/css')
          next.push(...cssReferences(decode(asset), candidate));
      }
      wanted = next;
    }
    return assets;
  },
);
