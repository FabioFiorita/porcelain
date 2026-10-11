import { Schema } from 'effect';

export class LatestUpdateDowngradeError extends Schema.TaggedError<LatestUpdateDowngradeError>()(
  'LatestUpdateDowngradeError',
  {},
) {
  override get message() {
    return '--allow-downgrade requires an exact version: run `npx @fabiofiorita/porcelain@<version> service update --allow-downgrade`.';
  }
}
