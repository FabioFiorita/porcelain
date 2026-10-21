import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import { Cause, Effect, Exit, Option, Schema, Stream } from 'effect';
import { AsyncResult, Atom, AtomRegistry } from 'effect/reactivity';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import { RequestError } from '../../../shared/api/request-error.ts';
import { readServiceUpdate } from '../queries/share.ts';
import {
  settingsUpdateVersion,
  type SettingsUpdateEntry,
} from '../rules/settings-updates.ts';
import { settingsUpdateBatch } from '../store/settings-updates.ts';
import { startServiceUpdate } from './share.ts';

export class SettingsUpdateError extends Schema.TaggedError<SettingsUpdateError>()(
  'SettingsUpdateError',
  { message: Schema.String },
) {}

type UpdateIdentity = {
  readonly id: string;
  readonly name: string;
};

export type ServiceUpdateTarget = UpdateIdentity & {
  readonly kind: 'service';
  readonly connection: RuntimeConnection;
  readonly state: ReadServiceUpdateResponse;
  readonly deviceId: string | undefined;
};

export type MacAppUpdateTarget = UpdateIdentity & {
  readonly kind: 'mac-app';
  readonly available: boolean;
  readonly latest: string | undefined;
  readonly update: (
    version: string,
  ) => Effect.Effect<void, SettingsUpdateError>;
};

export type SettingsUpdateTarget = ServiceUpdateTarget | MacAppUpdateTarget;

const updateTarget = Effect.fn('updateSettingsTarget')(function* (
  target: SettingsUpdateTarget,
  version: string,
  registry: AtomRegistry.AtomRegistry,
) {
  if (target.kind === 'mac-app') return yield* target.update(version);
  const command = startServiceUpdate(target.connection);
  const unmount = registry.mount(command);
  yield* Effect.addFinalizer(() => Effect.sync(unmount));
  registry.set(command, version);
  yield* AtomRegistry.getResult(registry, command, { suspendOnWaiting: true });
  const outcome = yield* AtomRegistry.toStream(
    registry,
    readServiceUpdate(target.connection),
  ).pipe(
    Stream.map(
      (
        answer,
      ): Option.Option<
        { status: 'updated' } | { status: 'failed'; message: string }
      > => {
        if (AsyncResult.isFailure(answer)) {
          const error = Cause.squash(answer.cause);
          if (
            error instanceof RequestError &&
            (error.status === 401 || error.status === 403)
          )
            return Option.some({
              status: 'failed',
              message: `Could not confirm the update: access to this computer was denied (${error.status}). Pair or trust this device again.`,
            });
          return Option.none();
        }
        if (!AsyncResult.isSuccess(answer)) return Option.none();
        const state = answer.value;
        if (!state.managed)
          return Option.some({
            status: 'failed',
            message: 'This computer no longer runs the managed service.',
          });
        if (state.running) return Option.none();
        if (state.version === version)
          return Option.some({ status: 'updated' as const });
        if (state.last?.target === version && state.last.stage === 'failed')
          return Option.some({
            status: 'failed' as const,
            message: state.last.reason ?? 'The updater gave no reason.',
          });
        return Option.none();
      },
    ),
    Stream.filter(Option.isSome),
    Stream.map((answer) => answer.value),
    Stream.runHead,
  );
  if (Option.isNone(outcome))
    return yield* new SettingsUpdateError({
      message: 'The update stopped before completion.',
    });
  if (outcome.value.status === 'failed')
    return yield* new SettingsUpdateError({ message: outcome.value.message });
});

export const runSettingsUpdates = Atom.fn(
  (targets: readonly SettingsUpdateTarget[], get) =>
    Effect.gen(function* () {
      const registry = get.registry;
      if (registry.get(settingsUpdateBatch).running) return;
      const selected: { target: SettingsUpdateTarget; version: string }[] = [];
      const seen = new Set<string>();
      for (const target of targets) {
        const version = settingsUpdateVersion(target);
        const key = `${target.kind}:${target.id}`;
        if (version === undefined || seen.has(key)) continue;
        seen.add(key);
        selected.push({ target, version });
      }
      selected.sort(
        (a, b) =>
          Number(a.target.kind === 'mac-app') -
          Number(b.target.kind === 'mac-app'),
      );
      if (selected.length === 0) return;
      let entries: readonly SettingsUpdateEntry[] = selected.map(
        ({ target, version }) => ({
          id: target.id,
          name: target.name,
          kind: target.kind,
          version,
          status: 'queued',
        }),
      );
      const publish = (running: boolean) =>
        registry.set(settingsUpdateBatch, { running, entries });
      publish(true);
      yield* Effect.gen(function* () {
        for (const [index, { target, version }] of selected.entries()) {
          entries = entries.map((entry, position) =>
            position === index ? { ...entry, status: 'updating' } : entry,
          );
          publish(true);
          const result = yield* Effect.exit(
            updateTarget(target, version, registry).pipe(Effect.scoped),
          );
          const error = Exit.isFailure(result)
            ? Cause.squash(result.cause)
            : undefined;
          entries = entries.map((entry, position) =>
            position !== index
              ? entry
              : Exit.isSuccess(result)
                ? { ...entry, status: 'updated' }
                : {
                    ...entry,
                    status: 'failed',
                    message:
                      error instanceof Error
                        ? error.message
                        : 'The update failed.',
                  },
          );
          publish(true);
        }
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            entries = entries.map((entry) =>
              entry.status === 'queued' || entry.status === 'updating'
                ? {
                    ...entry,
                    status: 'failed',
                    message: 'The update was interrupted.',
                  }
                : entry,
            );
            publish(false);
          }),
        ),
      );
    }),
  { concurrent: true },
).pipe(Atom.keepAlive);
