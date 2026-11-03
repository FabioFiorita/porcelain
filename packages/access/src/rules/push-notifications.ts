import type {
  PushContent,
  PushDelivery,
  PushEvent,
  PushKind,
  PushMessage,
  PushOutcome,
  PushRegistration,
  PushTokenKey,
} from '../models/push-notifications.ts';
import type { StoredDevice } from '../models/device.ts';
import { deviceRevoked } from './device-activity.ts';

const TITLE_LENGTH = 60;
const BODY_LENGTH = 140;

function shortened(text: string, length: number): string {
  const plain = text
    .replace(/```[\s\S]*?(?:```|$)/g, ' ')
    .replace(/`[^`\n]*`/g, '…')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const characters = Array.from(plain);
  return characters.length <= length
    ? plain
    : `${characters
        .slice(0, length - 1)
        .join('')
        .trimEnd()}…`;
}

export function pushKinds(kinds: readonly PushKind[]): readonly PushKind[] {
  return (['review-ready', 'agent-reply'] as const).filter((kind) =>
    kinds.includes(kind),
  );
}

export function pushContent(event: PushEvent): PushContent {
  const title = shortened(event.project, TITLE_LENGTH) || 'Porcelain';
  const body =
    event.kind === 'review-ready'
      ? shortened(`Review ready: ${event.title}`, BODY_LENGTH)
      : shortened(`Agent replied: ${event.reply}`, BODY_LENGTH);
  return {
    title,
    body,
    data: {
      kind: event.kind,
      ...(event.link === undefined ? {} : { url: event.link }),
    },
  };
}

export function pushMessages(
  event: PushEvent,
  registrations: readonly PushRegistration[],
  devices: readonly StoredDevice[],
): readonly PushMessage[] {
  const content = pushContent(event);
  return registrations
    .filter((registration) => registration.kinds.includes(event.kind))
    .filter((registration) => {
      const device = devices.find(
        (entry) => entry.id === registration.deviceId,
      );
      return device !== undefined && !deviceRevoked(device);
    })
    .map((registration) => ({
      ...content,
      deviceId: registration.deviceId,
      to: registration.token,
    }));
}

export function pushDelivery(
  messages: readonly PushMessage[],
  outcomes: readonly PushOutcome[],
): PushDelivery {
  const outcome = (index: number): PushOutcome => outcomes[index] ?? 'unsent';
  const count = (wanted: PushOutcome) =>
    messages.filter((_, index) => outcome(index) === wanted).length;
  return {
    accepted: count('accepted'),
    rejected: count('rejected'),
    unsent: count('unsent'),
    unregistered: messages
      .filter((_, index) => outcome(index) === 'unregistered')
      .map((message) => ({ deviceId: message.deviceId, token: message.to })),
  };
}

export function unregisteredDevices(
  registrations: readonly PushRegistration[],
  unregistered: readonly PushTokenKey[],
): readonly string[] {
  return registrations
    .filter((registration) =>
      unregistered.some(
        (key) =>
          key.deviceId === registration.deviceId &&
          key.token === registration.token,
      ),
    )
    .map((registration) => registration.deviceId);
}

export function otherDevicesWithToken(
  registrations: readonly PushRegistration[],
  registration: PushRegistration,
): readonly string[] {
  return registrations
    .filter(
      (entry) =>
        entry.token === registration.token &&
        entry.deviceId !== registration.deviceId,
    )
    .map((entry) => entry.deviceId);
}
