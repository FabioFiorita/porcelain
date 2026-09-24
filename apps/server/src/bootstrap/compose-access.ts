import type {
  DeviceSightingStore,
  DeviceStore,
  PairingReachReader,
  RuntimeStatusReader,
} from '@porcelain/access/ports';
import {
  AuthenticateDeviceService,
  FlushDeviceActivityService,
  IssuePairingService,
  ListAccessService,
  type ReadEnvironmentService,
  ReadOwnerStatusService,
  RedeemPairingService,
  RefundPairingAttemptService,
  RevokeDeviceService,
  RevokePairingGrantService,
  TakePairingAttemptService,
} from '@porcelain/access/services';
import { createPairingGrantStore } from '@porcelain/storage/access';
import { InMemoryPairingAttemptStore } from '../adapters/access/in-memory-pairing-attempt-store.ts';
import { RandomSecretSource } from '../adapters/access/random-secret-source.ts';
import type { DeviceConnections } from '../ports/device-connections.ts';
import { AuthenticateDeviceUseCase } from '../use-cases/access/authenticate-device.ts';
import { CheckRequestOriginUseCase } from '../use-cases/access/check-request-origin.ts';
import { ClearBrowserSessionUseCase } from '../use-cases/access/clear-browser-session.ts';
import { FlushDeviceActivityUseCase } from '../use-cases/access/flush-device-activity.ts';
import { IssuePairingUseCase } from '../use-cases/access/issue-pairing.ts';
import { ListAccessUseCase } from '../use-cases/access/list-access.ts';
import { ReadHealthUseCase } from '../use-cases/access/read-health.ts';
import { ReadOwnerStatusUseCase } from '../use-cases/access/read-owner-status.ts';
import { RedeemPairingUseCase } from '../use-cases/access/redeem-pairing.ts';
import { RefundPairingAttemptUseCase } from '../use-cases/access/refund-pairing-attempt.ts';
import { RevokeAccessUseCase } from '../use-cases/access/revoke-access.ts';
import { TakePairingAttemptUseCase } from '../use-cases/access/take-pairing-attempt.ts';
import type { ComposeContext } from './compose-context.ts';

export type AccessAdapters = {
  readEnvironment: ReadEnvironmentService;
  deviceStore: DeviceStore;
  deviceSightingStore: DeviceSightingStore;
  deviceConnections: DeviceConnections;
  pairingReachReader: PairingReachReader;
  runtimeStatusReader: RuntimeStatusReader;
};

export function composeAccess(
  context: ComposeContext,
  adapters: AccessAdapters,
) {
  const { session, lanes, laneKeys, clock, ids } = context;
  const limits = context.settings.limits.access;
  const { readEnvironment, deviceStore, deviceSightingStore } = adapters;
  const secretSource = new RandomSecretSource(limits.credentials);
  const pairingGrants = createPairingGrantStore(session);
  const pairingAttempts = new InMemoryPairingAttemptStore();
  return {
    authenticateDevice: new AuthenticateDeviceUseCase(
      new AuthenticateDeviceService(
        deviceStore,
        deviceSightingStore,
        clock,
        limits.device,
      ),
    ),
    clearBrowserSession: new ClearBrowserSessionUseCase(),
    checkRequestOrigin: new CheckRequestOriginUseCase(),
    flushDeviceActivity: new FlushDeviceActivityUseCase(
      new FlushDeviceActivityService(deviceSightingStore, deviceStore),
      lanes,
      laneKeys,
    ),
    issuePairing: new IssuePairingUseCase(
      readEnvironment,
      new IssuePairingService(
        pairingGrants,
        adapters.pairingReachReader,
        clock,
        ids,
        secretSource,
        limits.pairingGrant,
        limits.deviceDetails,
      ),
      lanes,
      laneKeys,
    ),
    listAccess: new ListAccessUseCase(
      new ListAccessService(pairingGrants, deviceStore, clock),
      lanes,
      laneKeys,
    ),
    readHealth: new ReadHealthUseCase(readEnvironment),
    readOwnerStatus: new ReadOwnerStatusUseCase(
      new ReadOwnerStatusService(adapters.runtimeStatusReader),
    ),
    redeemPairing: new RedeemPairingUseCase(
      new RedeemPairingService(
        pairingGrants,
        clock,
        ids,
        secretSource,
        limits.deviceDetails,
      ),
      lanes,
      laneKeys,
    ),
    takePairingAttempt: new TakePairingAttemptUseCase(
      new TakePairingAttemptService(
        pairingAttempts,
        clock,
        limits.pairingAttempts,
      ),
    ),
    refundPairingAttempt: new RefundPairingAttemptUseCase(
      new RefundPairingAttemptService(
        pairingAttempts,
        clock,
        limits.pairingAttempts,
      ),
    ),
    revokeAccess: new RevokeAccessUseCase(
      new RevokePairingGrantService(pairingGrants, clock),
      new RevokeDeviceService(deviceStore, deviceSightingStore, clock),
      adapters.deviceConnections,
      lanes,
      laneKeys,
    ),
  };
}
