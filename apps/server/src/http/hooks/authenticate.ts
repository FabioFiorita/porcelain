import { Effect } from 'effect';
import type { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import type { AuthenticateDeviceUseCasePort } from '../../ports/authenticate-device-use-case-port.ts';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { deviceCookie, setDeviceCookie } from './device-cookie.ts';

export type AuthenticateOptions = {
  access: { authenticateDevice: AuthenticateDeviceUseCasePort };
  deviceConnections: Pick<DeviceConnectionStore, 'insert'>;
};
export function bearerCredential(
  context: RequestContext['Service'],
): string | undefined {
  const header = context.request.headers.authorization;
  return header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : undefined;
}

export function authenticate(
  options: AuthenticateOptions,
  cookie: { cookieMaxAgeSeconds: number },
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const credential = bearerCredential(context) ?? deviceCookie(context);
    if (!credential)
      return yield* Effect.die(
        new RequestError({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    const device = yield* options.access.authenticateDevice.execute({
      credential,
      route: context.client.route,
      address: context.client.address,
    });
    if (!device)
      return yield* Effect.die(
        new RequestError({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    context.principal = { kind: 'device', deviceId: device.deviceId };
    if (context.request.headers.upgrade !== 'websocket') {
      const release = options.deviceConnections.insert({
        deviceId: device.deviceId,
        connection: { close: () => context.response.destroy() },
      });
      context.response.once('close', release);
    }
    if (context.response.destroyed)
      return yield* Effect.die(
        new RequestError({
          statusCode: 401,
          message: 'Authentication required',
        }),
      );
    if (deviceCookie(context) === credential)
      setDeviceCookie(
        context,
        credential,
        context.client.secure,
        cookie.cookieMaxAgeSeconds,
      );
  });
}
