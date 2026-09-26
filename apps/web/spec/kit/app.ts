import { pairingLink } from '@porcelain/contracts/access';
import { page } from 'vitest/browser';
import { hostCommands } from './commands';

export type BrowserFailure = {
  kind: 'console error' | 'uncaught error' | 'unhandled rejection';
  message: string;
};

const observed: BrowserFailure[] = [];
let opened = false;

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

async function open(address: string) {
  if (opened)
    throw new Error(
      'A journey file opens the app once; a journey that needs a fresh app is its own file.',
    );
  opened = true;
  history.replaceState({}, '', address);
  const root = document.createElement('div');
  root.id = 'root';
  document.body.append(root);
  await import('../../src/main.tsx');
  return page;
}

async function link(installation: 'this' | 'another') {
  const issued = await hostCommands.porcelainPairingLink('Journey browser');
  return pairingLink({
    addresses: [''],
    code: issued.code,
    environmentId:
      installation === 'this' ? issued.environmentId : crypto.randomUUID(),
  });
}

export const app = {
  open,
  link,
  address: () => ({ path: location.pathname, fragment: location.hash }),
};
