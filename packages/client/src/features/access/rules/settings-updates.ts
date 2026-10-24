import type { ServiceUpdate } from './service-update.ts';

export type SettingsUpdateEntry = {
  readonly id: string;
  readonly name: string;
  readonly kind: 'service' | 'mac-app';
  readonly version: string;
} & (
  | { readonly status: 'queued' | 'updating' | 'updated' }
  | { readonly status: 'failed'; readonly message: string }
);

export type SettingsUpdateBatch = {
  readonly running: boolean;
  readonly entries: readonly SettingsUpdateEntry[];
};

type UpdateOffer =
  | { readonly kind: 'service'; readonly state: ServiceUpdate }
  | {
      readonly kind: 'mac-app';
      readonly available: boolean;
      readonly latest: string | undefined;
    };

export function settingsUpdateAvailable(target: UpdateOffer) {
  return target.kind === 'service'
    ? target.state.managed &&
        target.state.available &&
        target.state.latest !== undefined
    : target.available && target.latest !== undefined;
}

export function settingsUpdatesVisible(
  targets: readonly UpdateOffer[],
  batch: Pick<SettingsUpdateBatch, 'running'>,
) {
  return batch.running || targets.some(settingsUpdateAvailable);
}

export function settingsUpdateVersion(target: UpdateOffer) {
  if (target.kind === 'mac-app')
    return settingsUpdateAvailable(target) ? target.latest : undefined;
  const { state } = target;
  return settingsUpdateAvailable(target) &&
    state.managed &&
    state.canUpdate &&
    !state.running
    ? state.latest
    : undefined;
}

export function settingsUpdateTrust(target: {
  readonly state: ServiceUpdate;
  readonly deviceId: string | undefined;
}) {
  if (!target.state.managed || target.state.canUpdate) return undefined;
  return {
    label: 'Needs trust',
    deviceId: target.deviceId,
    hint: target.deviceId
      ? `Run porcelain trust ${target.deviceId} on that computer, or allow it in the Mac app → Computers → This computer → Paired devices`
      : 'Find this device’s id with porcelain devices on that computer, then run porcelain trust <id>, or allow it in the Mac app → Computers → This computer → Paired devices',
  };
}

export function settingsUpdateCount(
  targets: readonly (UpdateOffer & { readonly id: string })[],
) {
  const eligible = new Set<string>();
  for (const target of targets)
    if (settingsUpdateVersion(target) !== undefined)
      eligible.add(`${target.kind}:${target.id}`);
  return eligible.size;
}

export function settingsUpdateBatchProgress(batch: {
  readonly running: boolean;
  readonly entries: readonly {
    readonly status: 'queued' | 'updating' | 'updated' | 'failed';
  }[];
}) {
  const index = batch.entries.findIndex((entry) => entry.status === 'updating');
  return {
    total: batch.entries.length,
    current: index < 0 ? undefined : index + 1,
    label:
      index < 0
        ? undefined
        : `Updating ${index + 1} of ${batch.entries.length}`,
  };
}

export function computersSummary(paired: number, updates: number) {
  return {
    paired: paired === 0 ? 'No computers paired' : `${paired} paired`,
    updates:
      updates === 0
        ? undefined
        : `${updates} ${updates === 1 ? 'update' : 'updates'} ready`,
  };
}
