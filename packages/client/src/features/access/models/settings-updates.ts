import type { ReadServiceUpdateResponse } from '@porcelain/contracts/access';
import type { Effect } from 'effect';
import type { RuntimeConnection } from '../../../shared/api/connection.ts';
import type { SettingsUpdateError } from '../errors/settings-update-error.ts';

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

export type SettingsUpdateEntry = UpdateIdentity & {
  readonly kind: SettingsUpdateTarget['kind'];
  readonly version: string;
} & (
    | { readonly status: 'queued' | 'updating' | 'updated' }
    | { readonly status: 'failed'; readonly message: string }
  );

export type SettingsUpdateBatch = {
  readonly running: boolean;
  readonly entries: readonly SettingsUpdateEntry[];
};
