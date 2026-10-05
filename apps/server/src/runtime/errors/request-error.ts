import { Data } from 'effect';

export class RequestError extends Data.TaggedError('RequestError')<{
  readonly statusCode: number;
  readonly message: string;
}> {}
