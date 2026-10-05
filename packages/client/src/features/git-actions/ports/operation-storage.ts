import { Context, type Cause, type Effect } from 'effect';

export class OperationStorage extends Context.Service<
  OperationStorage,
  {
    readonly read: () => Effect.Effect<string | null, Cause.UnknownError>;
    readonly write: (value: string) => Effect.Effect<void, Cause.UnknownError>;
    readonly clear: () => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/OperationStorage') {}
