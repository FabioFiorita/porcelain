export class DataDirectoryInsecureError extends Error {
  override readonly name = 'DataDirectoryInsecureError';
  constructor(directory: string, reason: string) {
    super(
      `The data directory ${directory} is not private: ${reason}. ` +
        'Owner operations are protected by directory permissions, so Porcelain ' +
        `will not start until it is owner-only. Run: chmod 700 ${directory}`,
    );
  }
}
