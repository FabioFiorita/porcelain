import type {
  AuthenticateDeviceInput,
  AuthenticateDeviceResult,
} from '../models/authenticate-device.ts';
import type { DesktopSession } from '../models/desktop-session.ts';
import { secretMatches } from '../rules/credential.ts';

export class AuthenticateDesktopSessionService {
  private readonly session: DesktopSession | undefined;

  constructor(session: DesktopSession | undefined) {
    this.session = session;
  }

  execute(input: AuthenticateDeviceInput): AuthenticateDeviceResult {
    if (
      this.session === undefined ||
      input.route !== 'loopback' ||
      !secretMatches(this.session.secretHash, input.credential)
    )
      return { kind: 'refused' };
    return { kind: 'authenticated', deviceId: this.session.deviceId };
  }
}
