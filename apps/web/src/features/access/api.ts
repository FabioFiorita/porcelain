import {
  createBrowserAccessApi,
  createRemoteApi,
} from '@porcelain/client/access/api';
export { shareApi } from '@porcelain/client/access/api';
import {
  REQUEST_TIMEOUT_MS,
  WEB_PLATFORM_NAME_MAX_LENGTH,
} from '@/config/limits';
import { browserTransport } from '@/shared/api/transport';
import type { PairingPlatform } from '@porcelain/client/access';

function platformName() {
  const agent =
    typeof navigator === 'undefined'
      ? ''
      : navigator.userAgent.slice(0, WEB_PLATFORM_NAME_MAX_LENGTH);
  return agent === '' ? 'Browser' : agent;
}
const platform: PairingPlatform = { name: platformName };
export const accessApi = createBrowserAccessApi({
  pairingTransport: browserTransport(fetch),
  restoringTransport: browserTransport(fetch, { reportUnauthorized: false }),
  connectedTransport: browserTransport(fetch),
  platform,
  disconnectSignal: () => AbortSignal.timeout(REQUEST_TIMEOUT_MS),
});
export const remoteApi = createRemoteApi(platform);
