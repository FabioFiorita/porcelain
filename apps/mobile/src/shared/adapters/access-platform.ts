import { osName } from 'expo-device';
import type { AccessPlatformValue } from '@porcelain/client/access';
import { sendRequest } from '../api/transport';
export const accessPlatform: AccessPlatformValue = {
  name: () => osName ?? 'Mobile',
  send: sendRequest,
};
