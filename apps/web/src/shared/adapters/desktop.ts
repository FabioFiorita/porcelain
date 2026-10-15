import { Atom } from 'effect/reactivity';
import { Context, Effect, Layer, Option, Queue, Stream } from 'effect';
import { ConnectionError } from '@porcelain/client/transport';
import type {
  DesktopMcpConfiguration,
  DesktopAction,
  DesktopAppearance,
  DesktopBridge,
  DesktopAppUpdateState,
} from '@porcelain/contracts/desktop';
import { desktopShell } from '@/shared/shell';

declare global {
  interface Window {
    porcelainDesktop?: DesktopBridge;
  }
}

export function desktopLiveAddress(): string | undefined {
  return desktopShell ? window.porcelainDesktop?.liveAddress() : undefined;
}

function onDesktopAction(receive: (action: DesktopAction) => void): () => void {
  return desktopShell
    ? (window.porcelainDesktop?.onAction(receive) ?? (() => undefined))
    : () => undefined;
}

export function setDesktopAppearance(appearance: DesktopAppearance): void {
  if (desktopShell) window.porcelainDesktop?.setAppearance(appearance);
}

export function connectDesktopChrome(): () => void {
  if (!desktopShell) return () => undefined;
  document.documentElement.classList.add('desktop-shell');
  const fullscreen = (value: boolean) =>
    document.documentElement.classList.toggle('desktop-fullscreen', value);
  fullscreen(window.porcelainDesktop?.isFullscreen() ?? false);
  const unsubscribe = window.porcelainDesktop?.onFullscreen(fullscreen);
  return () => {
    unsubscribe?.();
    document.documentElement.classList.remove(
      'desktop-shell',
      'desktop-fullscreen',
    );
  };
}

export class DesktopHost extends Context.Service<
  DesktopHost,
  {
    readonly isDesktopShell: boolean;
    readonly hasAppUpdateFeed: boolean;
    readonly canPickProject: (address: string | undefined) => boolean;
    readonly pickProject: (
      address: string,
    ) => Effect.Effect<string | null, ConnectionError>;
    readonly mcpConfiguration: Effect.Effect<
      DesktopMcpConfiguration,
      ConnectionError
    >;
    readonly checkUpdate: Effect.Effect<
      Option.Option<{ readonly current: string }>,
      ConnectionError
    >;
    readonly installUpdate: Effect.Effect<void, ConnectionError>;
    readonly updateStates: Stream.Stream<DesktopAppUpdateState>;
  }
>()('@porcelain/web/DesktopHost') {
  static readonly layer = Layer.sync(DesktopHost, () => {
    const bridge = desktopShell ? window.porcelainDesktop : undefined;
    const canPickProject = (address: string | undefined) => {
      if (!bridge || address === undefined) return false;
      const target = new URL(address);
      return (
        target.protocol === window.location.protocol &&
        target.host === window.location.host
      );
    };
    return {
      isDesktopShell: bridge !== undefined,
      hasAppUpdateFeed: bridge?.appUpdate.enabled() ?? false,
      canPickProject,
      pickProject: Effect.fn('Desktop.pickProject')(function* (
        address: string,
      ) {
        if (!bridge || !canPickProject(address))
          return yield* Effect.fail(
            new ConnectionError({
              message:
                'The native project picker is unavailable for this computer.',
            }),
          );
        return yield* Effect.tryPromise({
          try: () => bridge.pickProjectFolder(),
          catch: (cause) =>
            new ConnectionError({
              message: 'Could not select the project folder.',
              cause,
            }),
        });
      }),
      mcpConfiguration: Effect.suspend(() =>
        bridge
          ? Effect.tryPromise({
              try: () => bridge.mcpConfiguration(),
              catch: (cause) =>
                new ConnectionError({
                  message: 'Could not read the local app MCP configuration.',
                  cause,
                }),
            })
          : Effect.fail(
              new ConnectionError({
                message: 'The desktop bridge is unavailable.',
              }),
            ),
      ),
      checkUpdate: Effect.gen(function* () {
        if (!bridge) return Option.none();
        yield* Effect.tryPromise({
          try: () => bridge.appUpdate.check(),
          catch: (cause) =>
            new ConnectionError({
              message: 'Could not check for an app update.',
              cause,
            }),
        });
        return Option.some({
          current: bridge.appUpdate.current(),
        });
      }),
      installUpdate: Effect.suspend(() =>
        bridge
          ? Effect.tryPromise({
              try: () => bridge.appUpdate.install(),
              catch: (cause) =>
                new ConnectionError({
                  message: 'Could not install the app update.',
                  cause,
                }),
            })
          : Effect.fail(
              new ConnectionError({
                message: 'The native app updater is unavailable.',
              }),
            ),
      ),
      updateStates: bridge
        ? Stream.concat(
            Stream.succeed<DesktopAppUpdateState>({ status: 'idle' }),
            Stream.callback<DesktopAppUpdateState>((queue) =>
              Effect.acquireRelease(
                Effect.sync(() =>
                  bridge.appUpdate.onState((state) =>
                    Queue.offerUnsafe(queue, state),
                  ),
                ),
                (unsubscribe) => Effect.sync(unsubscribe),
              ),
            ),
          )
        : Stream.succeed<DesktopAppUpdateState>({ status: 'idle' }),
    };
  });
}

export function desktopAppAddress(): string | undefined {
  return desktopShell && window.porcelainDesktop
    ? `${window.location.protocol}//${window.location.host}`
    : undefined;
}

export function desktopCredentials() {
  return desktopShell ? window.porcelainDesktop?.credentials : undefined;
}

export const desktopActions = Atom.family(
  (receive: (action: DesktopAction) => void) =>
    Atom.make((get) => {
      get.addFinalizer(onDesktopAction(receive));
    }),
);
