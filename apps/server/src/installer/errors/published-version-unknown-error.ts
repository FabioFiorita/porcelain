import { Schema } from 'effect';

export class PublishedVersionUnknownError extends Schema.TaggedError<PublishedVersionUnknownError>()(
  'PublishedVersionUnknownError',
  {},
) {
  override get message() {
    return 'Could not read the newest published Porcelain version from npm, so the service was left unchanged. `npm view @fabiofiorita/porcelain version` shows why.';
  }
}
