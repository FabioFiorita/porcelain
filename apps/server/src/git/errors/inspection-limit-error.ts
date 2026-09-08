export class InspectionLimitError extends Error {
  override readonly name = 'InspectionLimitError';

  constructor(options?: ErrorOptions) {
    super('Git inspection exceeds its limit', options);
  }
}
