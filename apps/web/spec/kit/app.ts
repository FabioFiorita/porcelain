import { pairingLink } from '@porcelain/contracts/access';
import { page } from 'vitest/browser';
import { hostCommands } from './commands';
import type { ServerName } from './protocol';

export type BrowserFailure = {
  kind: 'console error' | 'uncaught error' | 'unhandled rejection';
  message: string;
};

const observed: BrowserFailure[] = [];
const frameName = 'porcelain-app';
let opened = false;
let framed: HTMLIFrameElement | undefined;

function describe(value: unknown): string {
  if (value instanceof Error) return value.message;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export function watchBrowser() {
  const report = console.error.bind(console);
  console.error = (...values: unknown[]) => {
    observed.push({
      kind: 'console error',
      message: values.map(describe).join(' '),
    });
    report(...values);
  };
  window.addEventListener('error', (event) =>
    observed.push({ kind: 'uncaught error', message: describe(event.error) }),
  );
  window.addEventListener('unhandledrejection', (event) =>
    observed.push({
      kind: 'unhandled rejection',
      message: describe(event.reason),
    }),
  );
}

export function takeBrowserFailures(): BrowserFailure[] {
  return observed.splice(0);
}

function claimOpening() {
  if (opened)
    throw new Error(
      'A journey file opens the app once; a journey that needs a fresh app is its own file.',
    );
  opened = true;
}

async function open(address: string) {
  claimOpening();
  history.replaceState({}, '', address);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  await import('../../src/main.tsx');
  return page;
}

function prepareFrame(name: string) {
  const host = window.frameElement;
  if (window.name !== name || host === null) return;
  Object.assign(window, {
    __vitest_browser_runner__: {
      wrapDynamicImport: (load: () => unknown) => load(),
    },
  });
  const describe = (value: unknown): string => {
    if (value instanceof Error) return value.message;
    return typeof value === 'string' ? value : JSON.stringify(value);
  };
  const report = (kind: string, message: string) =>
    host.dispatchEvent(new CustomEvent(name, { detail: { kind, message } }));
  const original = console.error.bind(console);
  console.error = (...values: unknown[]) => {
    report('console error', values.map(describe).join(' '));
    original(...values);
  };
  window.addEventListener('error', (event) =>
    report('uncaught error', describe(event.error)),
  );
  window.addEventListener('unhandledrejection', (event) =>
    report('unhandled rejection', describe(event.reason)),
  );
}

function isFailure(value: unknown): value is BrowserFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    'message' in value &&
    (value.kind === 'console error' ||
      value.kind === 'uncaught error' ||
      value.kind === 'unhandled rejection') &&
    typeof value.message === 'string'
  );
}

function loaded(frame: HTMLIFrameElement, navigate: () => void) {
  return new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
    navigate();
  });
}

async function openReloadable(address: string) {
  claimOpening();
  await hostCommands.porcelainInitScript(
    `(${prepareFrame.toString()})(${JSON.stringify(frameName)})`,
  );
  const frame = document.createElement('iframe');
  frame.name = frameName;
  frame.title = 'Porcelain';
  frame.style.cssText =
    'position: fixed; inset: 0; width: 100%; height: 100%; border: 0';
  frame.addEventListener(frameName, (event) => {
    if ('detail' in event && isFailure(event.detail))
      observed.push(event.detail);
  });
  framed = frame;
  await loaded(frame, () => {
    frame.src = address;
    document.body.append(frame);
  });
  return page.frameLocator(page.elementLocator(frame));
}

async function reload() {
  const frame = framed;
  const current = frame?.contentWindow;
  if (frame === undefined || current == null)
    throw new Error(
      'app.reload() reloads the app that app.openReloadable opened in its frame.',
    );
  await loaded(frame, () => current.location.reload());
}

const outageKey = 'porcelain-kit-session-outage';

function failRestoreInFrame(name: string, key: string) {
  if (window.name !== name) return;
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const path =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const failing =
      window.sessionStorage.getItem(key) !== null &&
      new URL(path, window.location.href).pathname === '/api/inventory';
    return failing
      ? Promise.resolve(new Response(null, { status: 503 }))
      : original(input, init);
  };
}

async function failSessionRestore() {
  const current = framed?.contentWindow;
  if (current == null)
    throw new Error(
      'app.failSessionRestore() fails the session restore of the app that app.openReloadable opened in its frame.',
    );
  await hostCommands.porcelainInitScript(
    `(${failRestoreInFrame.toString()})(${JSON.stringify(frameName)}, ${JSON.stringify(outageKey)})`,
  );
  current.sessionStorage.setItem(outageKey, 'down');
  return {
    end() {
      const frame = framed?.contentWindow;
      frame?.sessionStorage.removeItem(outageKey);
      frame?.dispatchEvent(new Event('online'));
    },
  };
}

function visited() {
  const current = framed?.contentWindow;
  if (current == null)
    throw new Error(
      'app.visited() reads the history of the app that app.openReloadable opened in its frame.',
    );
  return current.navigation
    .entries()
    .map((entry) => new URL(entry.url ?? '', current.location.href).pathname);
}

function address() {
  const current = framed?.contentWindow?.location ?? location;
  return {
    path: current.pathname,
    query: current.search,
    fragment: current.hash,
  };
}

function follow(address: string) {
  (framed?.contentWindow?.location ?? location).assign(address);
}

function title() {
  return (framed?.contentDocument ?? document).title;
}

async function link(installation: 'this' | 'another') {
  const issued = await hostCommands.porcelainPairingLink(
    'Journey browser',
    'this',
  );
  return pairingLink({
    addresses: [''],
    code: issued.code,
    environmentId:
      installation === 'this' ? issued.environmentId : crypto.randomUUID(),
  });
}

async function remoteLink(server: ServerName = 'remote') {
  const issued = await hostCommands.porcelainPairingLink(
    'Remote computer',
    server,
  );
  return pairingLink({
    addresses: [issued.address],
    code: issued.code,
    environmentId: issued.environmentId,
  });
}

export const app = {
  open,
  openReloadable,
  reload,
  visited,
  failSessionRestore,
  link,
  remoteLink,
  address,
  title,
  follow,
};
