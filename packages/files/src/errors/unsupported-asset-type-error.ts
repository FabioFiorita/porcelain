export class UnsupportedAssetTypeError extends Error {
  override readonly name = 'UnsupportedAssetTypeError';

  constructor() {
    super('File type cannot be previewed');
  }
}
