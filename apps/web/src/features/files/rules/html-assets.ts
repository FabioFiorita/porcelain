import type { ReadFileAssetResponse as AssetResponse } from '@porcelain/contracts/files';

export const isImagePath = (path: string) =>
  /\.(png|jpe?g|gif|webp|avif|svg|ico)$/i.test(path);
export const assetUrl = (asset: AssetResponse) =>
  `data:${asset.mediaType};base64,${asset.base64}`;
