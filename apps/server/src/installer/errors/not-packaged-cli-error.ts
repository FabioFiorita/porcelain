import { Schema } from 'effect';

export class NotPackagedCliError extends Schema.TaggedError<NotPackagedCliError>()(
  'NotPackagedCliError',
  {},
) {
  override get message() {
    return 'Service management requires the packaged Porcelain CLI. Run it with `npx @fabiofiorita/porcelain@latest service ...`.';
  }
}
