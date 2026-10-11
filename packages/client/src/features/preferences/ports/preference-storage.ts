import { Context, type Cause, type Effect } from 'effect';
import type { Preferences } from '../store/saved-preferences.ts';

export class PreferenceStorage extends Context.Service<
  PreferenceStorage,
  {
    readonly read: () => Effect.Effect<Preferences, Cause.UnknownError>;
    readonly write: (
      preferences: Preferences,
    ) => Effect.Effect<void, Cause.UnknownError>;
  }
>()('@porcelain/client/PreferenceStorage') {}
