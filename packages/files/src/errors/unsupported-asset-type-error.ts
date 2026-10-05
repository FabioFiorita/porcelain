import { Schema } from 'effect';

export class UnsupportedAssetTypeError extends Schema.TaggedError<UnsupportedAssetTypeError>()(
  'UnsupportedAssetTypeError',
  {},
) {
  override get message() {
    return 'File type cannot be previewed';
  }
}
