export class ArtifactQuotaError extends Error {
  constructor() {
    super('Artifact storage quota exceeded');
    this.name = 'ArtifactQuotaError';
  }
}
