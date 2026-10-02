import { osName } from 'expo-device';
import type { AccessPlatform } from '@porcelain/client/access';
import { sendRequest } from '../../../shared/api/transport';
export const accessPlatform: AccessPlatform = {
  name: () => osName ?? 'Mobile',
  send: sendRequest,
};
