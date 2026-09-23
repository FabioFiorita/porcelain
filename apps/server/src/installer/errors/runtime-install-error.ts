export class RuntimeInstallError extends Error {
  override readonly name = 'RuntimeInstallError';
  constructor(detail: string) {
    super(`Could not install the persistent runtime: ${detail}`);
  }
}
