import { Schema } from 'effect';

export class DataDirectoryBusyError extends Schema.TaggedError<DataDirectoryBusyError>()(
  'DataDirectoryBusyError',
  {
    state: Schema.Literals(['running', 'unreadable']),
    phase: Schema.Literals(['install', 'update', 'recover']),
  },
) {
  override get message() {
    if (this.phase === 'recover')
      return 'Refusing to restore the database while the data directory is owned by a running Porcelain server. Stop it first.';
    return this.phase === 'install'
      ? `Refusing to install while the data directory is ${this.state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'}. Stop it first.`
      : `The data directory remained ${this.state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'} after stopping the service.`;
  }
}
