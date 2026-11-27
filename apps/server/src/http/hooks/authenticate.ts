import { Clock, Effect } from 'effect';
import type { DeviceConnectionStore } from '../../ports/device-connection-store.ts';
import type { AuthenticateDeviceUseCasePort } from '../../ports/authenticate-device-use-case-port.ts';
import {
  PREVIEW_FILE_ROUTE,
  readPreviewFileQuerySchema,
} from '@porcelain/contracts/files';
import { HttpRouter } from 'effect/http';
import { Schema } from 'effect';
import type { PreviewFileTickets } from './preview-file-ticket.ts';
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
  if (header === 'Bearer') return '';
  return header?.startsWith('Bearer ')
    ? header.slice('Bearer '.length)
    : undefined;
}

export function requestCredential(context: RequestContext['Service']) {
  return bearerCredential(context) ?? deviceCookie(context) ?? undefined;
}

const previewQuery = Schema.decodeUnknownOption(readPreviewFileQuerySchema);
const previewCredential = Effect.fn('Authenticate.previewCredential')(
  function* (context: RequestContext['Service'], tickets: PreviewFileTickets) {
    const { params, route } = yield* HttpRouter.RouteContext;
    if (route.path !== PREVIEW_FILE_ROUTE) return undefined;
    const query = new URL(context.request.url, 'http://porcelain.invalid')
      .searchParams;
    if (!query.has('ticket')) return undefined;
    if (
      query.getAll('ticket').length !== 1 ||
      query.getAll('path').length !== 1
    )
      return '';
    const decoded = previewQuery(Object.fromEntries(query));
    if (decoded._tag === 'None' || !decoded.value.ticket || !params.worktreeId)
      return '';
    return (
      tickets.redeem(
        { worktreeId: params.worktreeId, path: decoded.value.path },
        decoded.value.ticket,
        yield* Clock.currentTimeMillis,
      ) ?? ''
    );
  },
);

export function authenticate(
  options: AuthenticateOptions,
  cookie: { cookieMaxAgeSeconds: number },
  tickets?: PreviewFileTickets,
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const delegated = tickets && (yield* previewCredential(context, tickets));
    const credential = delegated ?? requestCredential(context);
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
