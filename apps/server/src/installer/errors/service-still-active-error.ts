export class ServiceStillActiveError extends Error {
  override readonly name = 'ServiceStillActiveError';
  constructor(after: 'stop' | 'disable') {
    super(`porcelain.service remained active after ${after}.`);
  }
}
