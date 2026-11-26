import type { ReadFileAssetResponse } from '@porcelain/contracts/files';

export const assetUrl = (
  asset: ReadFileAssetResponse | { readonly url: string },
) =>
  'url' in asset ? asset.url : `data:${asset.mediaType};base64,${asset.base64}`;
