export class InvalidPackageVersionError extends Error {
  override readonly name = 'InvalidPackageVersionError';
  constructor(version: string) {
    super(`Invalid package version: ${version}`);
  }
}
