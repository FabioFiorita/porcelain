import { Context } from 'effect';
import type { AuthenticateDeviceOptions as AuthenticateDeviceOptionsShape } from '../models/authenticate-device.ts';
export const AuthenticateDeviceOptions = Context.Service<
  '@porcelain/access/AuthenticateDeviceOptions',
  AuthenticateDeviceOptionsShape
>('@porcelain/access/AuthenticateDeviceOptions');
