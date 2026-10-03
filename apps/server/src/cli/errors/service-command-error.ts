export class ServiceCommandError extends Error {
  override readonly name = 'ServiceCommandError';
  constructor(detail: string) {
    super(`Service management failed: ${detail}`);
  }
}
