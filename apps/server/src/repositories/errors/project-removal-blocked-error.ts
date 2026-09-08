export class ProjectRemovalBlockedError extends Error {
  constructor() {
    super('Project has an active or unresolved Git operation');
    this.name = 'ProjectRemovalBlockedError';
  }
}
