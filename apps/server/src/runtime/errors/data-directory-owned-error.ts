export class DataDirectoryOwnedError extends Error {
  override readonly name = 'DataDirectoryOwnedError';
  constructor(directory: string) {
    super(
      `Another Porcelain server is using ${directory}. ` +
        'Stop it before starting a second one.',
    );
  }
}
