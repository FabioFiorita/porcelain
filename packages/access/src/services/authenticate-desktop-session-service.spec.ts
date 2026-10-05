import { DesktopSession } from '@porcelain/access/ports';
import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '@porcelain/kernel/rules';
import { AuthenticateDesktopSessionService } from './authenticate-desktop-session-service.ts';

describe('AuthenticateDesktopSessionService', () => {
  const session = {
    deviceId: 'desktop-session',
    secretHash: sha256Hex('private-startup-secret'),
  };
  it('authenticates its private startup credential on loopback', () => {
    const service = Effect.runSync(
      AuthenticateDesktopSessionService.pipe(
        Effect.provide(AuthenticateDesktopSessionService.layer),
        Effect.provideService(DesktopSession, session),
      ),
    );
    expect(
      Effect.runSync(
        service.execute({
          credential: 'private-startup-secret',
          route: 'loopback',
        }),
      ),
    ).toEqual({ kind: 'authenticated', deviceId: 'desktop-session' });
  });
  it.each(['lan', 'tailnet', 'tunnel'] as const)(
    'refuses the desktop credential on the %s route',
    (route) => {
      const service = Effect.runSync(
        AuthenticateDesktopSessionService.pipe(
          Effect.provide(AuthenticateDesktopSessionService.layer),
          Effect.provideService(DesktopSession, session),
        ),
      );
      expect(
        Effect.runSync(
          service.execute({ credential: 'private-startup-secret', route }),
        ),
      ).toEqual({ kind: 'refused' });
    },
  );
  it.each(['', 'another-startup-secret', 'private-startup-secret\n'])(
    'refuses a different credential: %s',
    (credential) => {
      const service = Effect.runSync(
        AuthenticateDesktopSessionService.pipe(
          Effect.provide(AuthenticateDesktopSessionService.layer),
          Effect.provideService(DesktopSession, session),
        ),
      );
      expect(
        Effect.runSync(service.execute({ credential, route: 'loopback' })),
      ).toEqual({
        kind: 'refused',
      });
    },
  );
  it('leaves ordinary servers without a desktop session', () => {
    const service = Effect.runSync(
      AuthenticateDesktopSessionService.pipe(
        Effect.provide(AuthenticateDesktopSessionService.layer),
        Effect.provideService(DesktopSession, undefined),
      ),
    );
    expect(
      Effect.runSync(
        service.execute({
          credential: 'private-startup-secret',
          route: 'loopback',
        }),
      ),
    ).toEqual({ kind: 'refused' });
  });
  it('refuses a previous launch credential after the session changes', () => {
    const service = Effect.runSync(
      AuthenticateDesktopSessionService.pipe(
        Effect.provide(AuthenticateDesktopSessionService.layer),
        Effect.provideService(DesktopSession, {
          ...session,
          secretHash: sha256Hex('new-startup-secret'),
        }),
      ),
    );
    expect(
      Effect.runSync(
        service.execute({
          credential: 'private-startup-secret',
          route: 'loopback',
        }),
      ),
    ).toEqual({ kind: 'refused' });
  });
});
