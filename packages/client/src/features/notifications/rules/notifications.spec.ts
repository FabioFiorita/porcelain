import { describe, expect, it } from 'vitest';
import {
  NOTIFICATIONS_EXPLANATION,
  notificationKinds,
  notificationsMessage,
  notificationsSummary,
  pushRegistrationPlan,
  pushTokenFailure,
} from './notifications.ts';

const both = { reviewReady: true, agentReply: true };
const off = { reviewReady: false, agentReply: false };
const ready = {
  kind: 'ready',
  token: 'ExponentPushToken[phone]',
  platform: 'android',
} as const;

describe('pushRegistrationPlan', () => {
  it('registers the token with exactly the kinds that are switched on', () => {
    expect(
      pushRegistrationPlan({ reviewReady: false, agentReply: true }, ready),
    ).toEqual({
      kind: 'register',
      request: {
        token: 'ExponentPushToken[phone]',
        platform: 'android',
        kinds: ['agent-reply'],
      },
    });
    expect(pushRegistrationPlan(both, ready)).toEqual({
      kind: 'register',
      request: {
        token: 'ExponentPushToken[phone]',
        platform: 'android',
        kinds: ['review-ready', 'agent-reply'],
      },
    });
  });

  it('clears the registration once both switches are off, token or not', () => {
    expect(pushRegistrationPlan(off, ready)).toEqual({ kind: 'clear' });
    expect(pushRegistrationPlan(off, { kind: 'unconfigured' })).toEqual({
      kind: 'clear',
    });
  });

  it.each([
    { kind: 'unknown' },
    { kind: 'denied' },
    { kind: 'unconfigured' },
    { kind: 'unavailable' },
  ] as const)(
    'keeps the preference and waits while the token is $kind',
    (token) => {
      expect(pushRegistrationPlan(both, token)).toEqual({ kind: 'wait' });
    },
  );
});

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

describe('notificationsMessage', () => {
  it('explains the missing push key only while a switch is on', () => {
    expect(notificationsMessage(both, { kind: 'unconfigured' })).toBe(
      'Notifications need the app’s push key — they’ll start working once it’s configured.',
    );
    expect(notificationsMessage(off, { kind: 'unconfigured' })).toBeUndefined();
    expect(notificationsMessage(both, ready)).toBeUndefined();
  });

  it('sends a denied permission to the phone settings', () => {
    expect(notificationsMessage(both, { kind: 'denied' })).toBe(
      'Notifications are off for Porcelain in your phone’s settings.',
    );
  });
});

describe('notificationsSummary', () => {
  it('names what the phone hears about', () => {
    expect(notificationsSummary(both)).toBe('Reviews ready and agent replies');
    expect(notificationsSummary({ reviewReady: true, agentReply: false })).toBe(
      'Reviews ready',
    );
    expect(notificationsSummary(off)).toBe('Off');
  });
});

describe('notificationKinds', () => {
  it('lists the switched-on kinds in the server order', () => {
    expect(notificationKinds({ reviewReady: true, agentReply: true })).toEqual([
      'review-ready',
      'agent-reply',
    ]);
    expect(notificationKinds(off)).toEqual([]);
  });
});

describe('NOTIFICATIONS_EXPLANATION', () => {
  it('tells the developer both events before the permission prompt', () => {
    expect(NOTIFICATIONS_EXPLANATION).toBe(
      'Porcelain tells you when an agent publishes a review for you or replies to your comment. Your phone asks for permission next.',
    );
  });
});
