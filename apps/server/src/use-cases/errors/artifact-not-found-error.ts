export class ArtifactNotFoundError extends Error {
  constructor() {
    super('Artifact or registered worktree not found');
    this.name = 'ArtifactNotFoundError';
  }
}
