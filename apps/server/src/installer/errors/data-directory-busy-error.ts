import { Schema } from 'effect';

export class DataDirectoryBusyError extends Schema.TaggedError<DataDirectoryBusyError>()(
  'DataDirectoryBusyError',
  {
    state: Schema.Literals(['running', 'unreadable']),
    phase: Schema.Literals(['install', 'update']),
  },
) {
  override get message() {
    return this.phase === 'install'
      ? `Refusing to install while the data directory is ${this.state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'}. Stop it first.`
      : `The data directory remained ${this.state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'} after stopping the service.`;
  }
}
