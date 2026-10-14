import { Effect } from 'effect';
import { sendRequest } from '../../shared/api/transport';

export const developmentPairingUrl = __DEV__
  ? process.env.EXPO_PUBLIC_PORCELAIN_DEV_PAIR_URL
  : undefined;

export function requestDevelopmentPairingLink() {
  return Effect.tryPromise({
    try: async (signal) => {
      if (!developmentPairingUrl)
        throw new Error('The development pairing helper is unavailable.');
      const response = await sendRequest(new URL(developmentPairingUrl), {
        method: 'POST',
        signal,
      });
      const link = await response.text();
      if (!response.ok)
        throw new Error(
          link.trim() || 'The development server did not answer.',
        );
      return link;
    },
    catch: (cause) =>
      cause instanceof Error
        ? cause.message
        : 'Could not create a pairing link.',
  });
}
