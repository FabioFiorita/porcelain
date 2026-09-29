export class UnsupportedProofFileError extends Error {
  override readonly name = 'UnsupportedProofFileError';

  constructor() {
    super(
      'A proof file is not the kind it names: an image must be PNG, JPEG, GIF or WebP and a video MP4 or WebM',
    );
  }
}
