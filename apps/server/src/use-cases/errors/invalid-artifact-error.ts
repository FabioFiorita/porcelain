export class InvalidArtifactError extends Error {
  constructor() {
    super('Invalid artifact');
    this.name = 'InvalidArtifactError';
  }
}
