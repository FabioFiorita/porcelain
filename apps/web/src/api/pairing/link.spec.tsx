import { expect, test } from 'vitest';
import { takePairingCode } from './link';

function openWith(hash: string) {
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', `${path}${hash}`);
}

// The module runs this on import, which is what makes it the earliest
// bootstrap code. That the import itself erases the fragment, and that back
// and forward cannot restore it, is proved in the smoke suite against a real
// navigation; a unit test that navigated would leave the test page.
test('takes the code and leaves nothing in the address bar', () => {
  openWith('#c=pcp_fixture&e=fixture-environment');
  expect(takePairingCode()).toEqual({
    code: 'pcp_fixture',
    environmentId: 'fixture-environment',
  });
  expect(window.location.hash).toBe('');
  expect(window.location.href).not.toContain('pcp_fixture');
});

test('clears the fragment even when the link is unusable', () => {
  openWith('#c=pcp_only-half');
  expect(takePairingCode()).toBeNull();
  expect(window.location.hash).toBe('');
  openWith('#not-a-query');
  expect(takePairingCode()).toBeNull();
  expect(window.location.hash).toBe('');
});

test('leaves an ordinary visit alone', () => {
  openWith('');
  expect(takePairingCode()).toBeNull();
  expect(window.location.hash).toBe('');
});
