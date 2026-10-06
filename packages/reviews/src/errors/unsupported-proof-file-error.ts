import { Schema } from 'effect';

export class UnsupportedProofFileError extends Schema.TaggedError<UnsupportedProofFileError>()(
  'UnsupportedProofFileError',
  {},
) {
  override get message() {
    return 'A proof file is not the kind it names: an image must be PNG, JPEG, GIF or WebP and a video MP4 or WebM';
  }
}
