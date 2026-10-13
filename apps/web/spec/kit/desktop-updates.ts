import type {
  DesktopBridge,
  DesktopAppUpdateState,
} from '@porcelain/contracts/desktop';
import type { Page } from '@playwright/test';

export type UpdateFixture = {
  publish: (state: DesktopAppUpdateState) => void;
  answer: () => void;
  finish: (state: DesktopAppUpdateState) => void;
  refuseNext: () => void;
  checks: number;
};

declare const window: {
  porcelainDesktop: DesktopBridge;
  updateFixture: UpdateFixture;
};

export async function updateFeed(page: Page, enabled: boolean) {
  await page.addInitScript((enabled) => {
    let state: DesktopAppUpdateState = enabled
      ? { status: 'idle' }
      : { status: 'unavailable' };
    const listeners = new Set<(state: DesktopAppUpdateState) => void>();
    const publish = (next: DesktopAppUpdateState) => {
      state = next;
      for (const listener of listeners) listener(next);
    };
    let checked: (() => void) | undefined;
    let refused = false;
    window.updateFixture = {
      checks: 0,
      publish,
      answer: () => {
        checked?.();
        checked = undefined;
      },
      finish: (next) => {
        publish(next);
        window.updateFixture.answer();
      },
      refuseNext: () => {
        refused = true;
      },
    };
    window.porcelainDesktop = {
      mcpConfiguration: async () => ({
        command:
          "claude mcp add porcelain -- '/tmp/Porcelain Dev' '--porcelain-mcp' '--data-directory' '/tmp/profile/server'",
        dataDirectory: '/tmp/profile/server',
      }),
      appUpdate: {
        enabled: () => enabled,
        current: () => '0.65.4',
        check: () => {
          window.updateFixture.checks += 1;
          if (refused) {
            refused = false;
            return Promise.reject(new Error('The main process is gone'));
          }
          if (
            state.status === 'downloading' ||
            state.status === 'ready' ||
            state.status === 'installing'
          )
            return Promise.resolve();
          publish({ status: 'checking' });
          if (window.updateFixture.checks === 1) {
            publish(enabled ? { status: 'idle' } : { status: 'unavailable' });
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            checked = resolve;
          });
        },
        install: async () => {
          if (state.status === 'available')
            publish({ status: 'downloading', version: state.version });
        },
        onState: (receive) => {
          listeners.add(receive);
          receive(state);
          return () => {
            listeners.delete(receive);
          };
        },
      },
      pickProjectFolder: async () => null,
      credentials: {
        read: async () => ({ status: 'empty' }),
        write: async () => undefined,
        clear: async () => undefined,
      },
      liveAddress: () => '',
      isFullscreen: () => false,
      onFullscreen: () => () => undefined,
      onAction: () => () => undefined,
      setAppearance: () => undefined,
    };
  }, enabled);
}
