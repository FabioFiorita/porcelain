import type { ReadFileAssetResponse as AssetResponse } from '@porcelain/contracts/files';

export const assetUrl = (asset: AssetResponse) =>
  `data:${asset.mediaType};base64,${asset.base64}`;
