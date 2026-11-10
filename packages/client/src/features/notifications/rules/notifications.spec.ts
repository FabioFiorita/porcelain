import { describe, expect, it } from 'vitest';
import { pushRegistrationPlan, pushTokenFailure } from './notifications.ts';

const both = { reviewReady: true, agentReply: true };

const ready = {
  kind: 'ready',
  token: 'ExponentPushToken[phone]',
  platform: 'android',
} as const;

describe('pushTokenFailure', () => {
  it('reads a missing Firebase or APNs setup as the missing push key', () => {
    expect(
      pushTokenFailure(
        'Default FirebaseApp is not initialized in this process com.porcelain',
      ),
    ).toEqual({ kind: 'unconfigured' });
    expect(
      pushTokenFailure('no valid "aps-environment" entitlement string found'),
    ).toEqual({ kind: 'unconfigured' });
  });

  it('reads anything else as the service being unreachable for now', () => {
    expect(
      pushTokenFailure('The Internet connection appears to be offline.'),
    ).toEqual({
      kind: 'unavailable',
    });
  });
});

it('clears old event registrations even when a saved switch is on', () => {
  expect(pushRegistrationPlan(both, ready)).toEqual({ kind: 'clear' });
});
