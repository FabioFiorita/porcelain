export class DataDirectoryBusyError extends Error {
  override readonly name = 'DataDirectoryBusyError';
  constructor(state: 'running' | 'unreadable', phase: 'install' | 'update') {
    super(
      phase === 'install'
        ? `Refusing to install while the data directory is ${state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'}. Stop it first.`
        : `The data directory remained ${state === 'running' ? 'owned by a running Porcelain server' : 'not safely readable'} after stopping the service.`,
    );
  }
}
