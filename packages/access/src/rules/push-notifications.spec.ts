import { describe, expect, it } from 'vitest';
import type { StoredDevice } from '../models/device.ts';
import type { PushRegistration } from '../models/push-notifications.ts';
import {
  pushContent,
  pushDelivery,
  pushKinds,
  otherDevicesWithToken,
  pushMessages,
  unregisteredDevices,
} from './push-notifications.ts';

const device = (id: string, revokedAt?: string): StoredDevice => ({
  id,
  label: id,
  platform: 'iOS',
  createdAt: '2026-11-01T10:00:00.000Z',
  lastSeenAt: '2026-11-02T10:00:00.000Z',
  route: 'lan',
  secretHash: 'hash',
  ...(revokedAt === undefined ? {} : { revokedAt }),
});
const registration = (
  deviceId: string,
  kinds: PushRegistration['kinds'],
): PushRegistration => ({
  deviceId,
  token: `ExponentPushToken[${deviceId}]`,
  platform: 'ios',
  kinds,
});
const LINK =
  'https://porcelain.fabiofiorita.com/open/reviews/7b1c?environment=e&host=10.0.0.2%3A4100&protocol=http';

describe('pushMessages', () => {
  it('reaches only the devices that asked for the event and are still paired', () => {
    const messages = pushMessages(
      {
        kind: 'review-ready',
        project: 'Dispatch',
        title: 'Add search',
        link: LINK,
      },
      [
        registration('phone', ['review-ready', 'agent-reply']),
        registration('tablet', ['agent-reply']),
        registration('revoked', ['review-ready']),
        registration('forgotten', ['review-ready']),
      ],
      [
        device('phone'),
        device('tablet'),
        device('revoked', '2026-11-02T11:00:00.000Z'),
      ],
    );
    expect(messages).toEqual([
      {
        deviceId: 'phone',
        to: 'ExponentPushToken[phone]',
        title: 'Dispatch',
        body: 'Review ready: Add search',
        data: { kind: 'review-ready', url: LINK },
      },
    ]);
  });

  it('sends an agent reply only to devices that asked for replies', () => {
    const messages = pushMessages(
      {
        kind: 'agent-reply',
        project: 'Dispatch',
        reply: 'Fixed it.',
        link: undefined,
      },
      [
        registration('phone', ['review-ready']),
        registration('tablet', ['agent-reply']),
      ],
      [device('phone'), device('tablet')],
    );
    expect(messages.map((message) => message.deviceId)).toEqual(['tablet']);
  });
});

describe('pushContent', () => {
  it('shows the project and a short reply without code, backticks or line breaks', () => {
    expect(
      pushContent({
        kind: 'agent-reply',
        project: 'Dispatch',
        reply:
          'I moved `token` out of the log.\n\n```ts\nconst secret = "abc";\n```\nRe-run the tests.',
        link: LINK,
      }),
    ).toEqual({
      title: 'Dispatch',
      body: 'Agent replied: I moved … out of the log. Re-run the tests.',
      data: { kind: 'agent-reply', url: LINK },
    });
  });

  it('cuts a long review title to a short body ending in an ellipsis', () => {
    const content = pushContent({
      kind: 'review-ready',
      project: 'Dispatch',
      title: 'word '.repeat(60),
      link: undefined,
    });
    expect(content.body.length).toBeLessThanOrEqual(140);
    expect(content.body.length).toBeGreaterThan(130);
    expect(content.body.endsWith('word…')).toBe(true);
    expect(content.data).toEqual({ kind: 'review-ready' });
  });

  it('drops an unclosed code block entirely', () => {
    expect(
      pushContent({
        kind: 'agent-reply',
        project: 'Dispatch',
        reply: 'Done.\n```\nexport API_KEY=abc',
        link: undefined,
      }).body,
    ).toBe('Agent replied: Done.');
  });
});

describe('pushKinds', () => {
  it('keeps each known kind once in a fixed order', () => {
    expect(pushKinds(['agent-reply', 'review-ready', 'agent-reply'])).toEqual([
      'review-ready',
      'agent-reply',
    ]);
  });
});

describe('pushDelivery', () => {
  it('counts each outcome and names the tokens Expo no longer knows', () => {
    const messages = pushMessages(
      {
        kind: 'review-ready',
        project: 'Dispatch',
        title: 'Add search',
        link: LINK,
      },
      [
        registration('a', ['review-ready']),
        registration('b', ['review-ready']),
        registration('c', ['review-ready']),
        registration('d', ['review-ready']),
      ],
      [device('a'), device('b'), device('c'), device('d')],
    );
    expect(
      pushDelivery(messages, ['accepted', 'unregistered', 'rejected']),
    ).toEqual({
      accepted: 1,
      rejected: 1,
      unsent: 1,
      unregistered: [{ deviceId: 'b', token: 'ExponentPushToken[b]' }],
    });
  });
});

describe('unregisteredDevices', () => {
  it('names a device only while it still holds the token Expo rejected', () => {
    expect(
      unregisteredDevices(
        [
          registration('phone', ['review-ready']),
          {
            ...registration('tablet', ['review-ready']),
            token: 'ExponentPushToken[renewed]',
          },
        ],
        [
          { deviceId: 'phone', token: 'ExponentPushToken[phone]' },
          { deviceId: 'tablet', token: 'ExponentPushToken[tablet]' },
        ],
      ),
    ).toEqual(['phone']);
  });
});

describe('otherDevicesWithToken', () => {
  it('names earlier devices that registered the same phone token', () => {
    expect(
      otherDevicesWithToken(
        [
          registration('old-pairing', ['review-ready']),
          { ...registration('tablet', ['review-ready']) },
          {
            ...registration('phone', ['agent-reply']),
            token: 'ExponentPushToken[old-pairing]',
          },
        ],
        {
          ...registration('phone', ['review-ready']),
          token: 'ExponentPushToken[old-pairing]',
        },
      ),
    ).toEqual(['old-pairing']);
  });
});
