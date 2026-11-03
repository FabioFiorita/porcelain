import type {
  PushKind,
  SetPushRegistrationRequest,
} from '@porcelain/contracts/access';

export type NotificationPreferences = {
  readonly reviewReady: boolean;
  readonly agentReply: boolean;
};

export type PushTokenState =
  | { readonly kind: 'unknown' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'unconfigured' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'ready';
      readonly token: string;
      readonly platform: SetPushRegistrationRequest['platform'];
    };

export type PushRegistrationPlan =
  | { readonly kind: 'register'; readonly request: SetPushRegistrationRequest }
  | { readonly kind: 'clear' }
  | { readonly kind: 'wait' };

export const NOTIFICATIONS_EXPLANATION =
  'Porcelain tells you when an agent publishes a review for you or replies to your comment. Your phone asks for permission next.';
const PUSH_KEY_MISSING_MESSAGE =
  'Notifications need the app’s push key — they’ll start working once it’s configured.';
const PUSH_DENIED_MESSAGE =
  'Notifications are off for Porcelain in your phone’s settings.';
const PUSH_UNAVAILABLE_MESSAGE =
  'Porcelain could not reach the notification service. It tries again the next time the app opens.';

const credentialFailure =
  /firebase|google-services|fcm|aps-environment|apns|push key|credential|projectid/i;

export function notificationKinds(
  preferences: NotificationPreferences,
): readonly PushKind[] {
  return [
    ...(preferences.reviewReady ? (['review-ready'] as const) : []),
    ...(preferences.agentReply ? (['agent-reply'] as const) : []),
  ];
}

export function pushRegistrationPlan(
  preferences: NotificationPreferences,
  token: PushTokenState,
): PushRegistrationPlan {
  const kinds = notificationKinds(preferences);
  if (kinds.length === 0) return { kind: 'clear' };
  if (token.kind !== 'ready') return { kind: 'wait' };
  return {
    kind: 'register',
    request: { token: token.token, platform: token.platform, kinds },
  };
}

export function pushTokenFailure(message: string): PushTokenState {
  return credentialFailure.test(message)
    ? { kind: 'unconfigured' }
    : { kind: 'unavailable' };
}

export function notificationsMessage(
  preferences: NotificationPreferences,
  token: PushTokenState,
): string | undefined {
  if (notificationKinds(preferences).length === 0) return undefined;
  if (token.kind === 'denied') return PUSH_DENIED_MESSAGE;
  if (token.kind === 'unconfigured') return PUSH_KEY_MISSING_MESSAGE;
  if (token.kind === 'unavailable') return PUSH_UNAVAILABLE_MESSAGE;
  return undefined;
}

export function notificationsSummary(
  preferences: NotificationPreferences,
): string {
  if (preferences.reviewReady && preferences.agentReply)
    return 'Reviews ready and agent replies';
  if (preferences.reviewReady) return 'Reviews ready';
  if (preferences.agentReply) return 'Agent replies';
  return 'Off';
}
