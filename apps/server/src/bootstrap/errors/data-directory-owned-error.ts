export class DataDirectoryOwnedError extends Error {
  constructor(directory: string, cause?: unknown) {
    super(
      `Another Porcelain server is using ${directory}. ` +
        'Stop it before starting a second one.',
      { cause },
    );
    this.name = 'DataDirectoryOwnedError';
  }
}
