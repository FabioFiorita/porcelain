import { Data } from 'effect';

export class PathRefusedError extends Data.TaggedError('PathRefusedError')<{
  readonly refusal:
    | 'unreadable'
    | 'changed'
    | 'trash-unavailable'
    | 'too-large';
  readonly cause?: unknown;
}> {
  override get message(): string {
    return `The path guard refused the path: ${this.refusal}`;
  }
}
