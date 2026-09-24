export class LiveUpdateCapacityError extends Error {
  override readonly name = 'LiveUpdateCapacityError';
  constructor() {
    super('Live update capacity reached');
  }
}
