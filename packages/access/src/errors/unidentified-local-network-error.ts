import { Schema } from 'effect';

export class UnidentifiedLocalNetworkError extends Schema.TaggedError<UnidentifiedLocalNetworkError>()(
  'UnidentifiedLocalNetworkError',
  {},
) {
  override get message() {
    return 'Porcelain cannot tell this network from another one yet, because the hardware address of its router is not known. Try again in a moment.';
  }
}
