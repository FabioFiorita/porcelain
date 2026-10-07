import type { Effect } from 'effect';
import type { ChildProcessSpawner } from 'effect/process';
import type {
  CheckoutVerificationFailure,
  CheckoutFilterFailure,
} from '../dtos/checkout-session-failure.ts';

export interface EffectCheckoutSession {
  readonly path: string;
  readonly verify: () => Effect.Effect<
    void,
    CheckoutVerificationFailure,
    ChildProcessSpawner.ChildProcessSpawner
  >;
  readonly confirm: () => Effect.Effect<
    void,
    CheckoutVerificationFailure,
    ChildProcessSpawner.ChildProcessSpawner
  >;
  readonly conversionFilters: (
    read: Effect.Effect<
      string[],
      CheckoutFilterFailure,
      ChildProcessSpawner.ChildProcessSpawner
    >,
  ) => Effect.Effect<
    string[],
    CheckoutFilterFailure,
    ChildProcessSpawner.ChildProcessSpawner
  >;
}

export interface EffectGitSession {
  readonly checkout: (
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ) => Effect.Effect<EffectCheckoutSession>;
  readonly confirmAll: () => Effect.Effect<
    void,
    CheckoutVerificationFailure,
    ChildProcessSpawner.ChildProcessSpawner
  >;
}

export interface CheckoutSession {
  readonly path: string;
  verify(signal?: AbortSignal): Promise<void>;
  confirm(signal?: AbortSignal): Promise<void>;
  conversionFilters(read: () => Promise<string[]>): Promise<string[]>;
}

export interface GitSession {
  checkout(
    path: string,
    metadataIdentity: string,
    repositoryIdentity: string,
  ): CheckoutSession;
  confirmAll(signal?: AbortSignal): Promise<void>;
}
