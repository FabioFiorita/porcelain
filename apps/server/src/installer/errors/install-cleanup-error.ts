export class InstallCleanupError extends Error {
  override readonly name = 'InstallCleanupError';
  constructor(detail: string) {
    super(
      `Porcelain installation failed and the service could not be stopped safely. The runtime and backup were retained. ${detail}`,
    );
  }
}
