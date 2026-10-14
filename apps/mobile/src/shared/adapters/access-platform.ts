import { osName } from 'expo-device';
import type { AccessPlatformValue } from '@porcelain/client/access';
import { sendRequest } from '../api/transport';
import { statusActivity } from './status-activity';
export const accessPlatform: AccessPlatformValue = {
  name: () => osName ?? 'Mobile',
  send: sendRequest,
  statusActivity,
};
