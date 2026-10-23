import { afterEach, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createRoot, type Root } from 'react-dom/client';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RemoteUnavailable } from '@/features/access/views/remote-unavailable';
import { NotPaired } from '@/features/access/views/not-paired';
import type { RemoteStatus } from '@porcelain/client/access/rules';
import '@/app.css';

let root: Root | undefined;
let container: HTMLDivElement | undefined;

afterEach(() => {
  root?.unmount();
  container?.remove();
});

function mount(children: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  root.render(<TooltipProvider>{children}</TooltipProvider>);
}

const computerStates: {
  status: RemoteStatus;
  title?: string;
  description?: string;
  settings: boolean;
}[] = [
  { status: { kind: 'checking' }, title: 'Studio: Checking', settings: false },
  {
    status: { kind: 'reconnecting' },
    title: 'Studio: Reconnecting',
    settings: false,
  },
  {
    status: { kind: 'offline' },
    title: 'Studio is offline',
    description:
      'It did not answer. Check that it runs and that this device reaches its address.',
    settings: true,
  },
  {
    status: { kind: 'needs-pairing' },
    title: 'Studio: Needs pairing',
    description:
      'It no longer accepts this app. Run porcelain pair on it and add the new link.',
    settings: true,
  },
  {
    status: { kind: 'other-server' },
    title: 'Studio: Another server',
    description:
      'Another Porcelain answers at this address now, so this app stays away from it.',
    settings: true,
  },
  {
    status: { kind: 'incompatible' },
    title: 'Studio: Update needed',
    description:
      'It runs a Porcelain this app cannot talk to. Update both to the same version.',
    settings: true,
  },
  { status: { kind: 'online', name: 'Studio' }, settings: false },
];

for (const { status, title, description, settings } of computerStates) {
  test(`computer ${status.kind} explains recovery without offering settings during reconnection`, async () => {
    const open = vi.fn();
    mount(
      <RemoteUnavailable name="Studio" status={status} onOpenRemotes={open} />,
    );
    const button = page.getByRole('button', {
      name: 'Computer settings',
      exact: true,
    });
    if (title)
      await expect
        .element(page.getByRole('heading', { name: title, exact: true }))
        .toBeVisible();
    else
      await expect.element(page.getByRole('heading')).not.toBeInTheDocument();
    if (description)
      await expect
        .element(page.getByText(description, { exact: true }))
        .toBeVisible();
    if (settings) {
      await button.click();
      expect(open).toHaveBeenCalledOnce();
    } else await expect.element(button).not.toBeInTheDocument();
  });
}

for (const state of [
  {
    name: 'not paired',
    pending: false,
    reason: undefined,
    current: 'Step 1, current',
    title: 'On your computer, run this',
  },
  {
    name: 'checking link',
    pending: true,
    reason: undefined,
    current: 'Step 2, current',
    title: 'Checking the link',
  },
  ...[
    'That link carried no pairing code.',
    'This pairing link is not usable. Ask for a new one.',
    'This link was made for a different Porcelain installation.',
    'Could not connect to the environment. Try again.',
  ].map((reason) => ({
    name: reason,
    pending: false,
    reason,
    current: 'Step 1, current',
    title: 'On your computer, run it again',
  })),
]) {
  test(`pairing ${state.name} keeps the route and the way forward`, async () => {
    mount(<NotPaired pending={state.pending} reason={state.reason} />);
    await expect
      .element(
        page.getByRole('heading', {
          name: 'This browser is not paired',
          exact: true,
        }),
      )
      .toBeVisible();
    await expect
      .element(
        page.getByRole('list', { name: 'How pairing works', exact: true }),
      )
      .toBeVisible();
    await expect
      .element(page.getByRole('heading', { name: state.title, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByLabelText(state.current, { exact: true }))
      .toHaveAttribute('aria-current', 'step');
    if (!state.pending) {
      await expect
        .element(
          page.getByText(/It prints a link that works once, for 15 minutes\./),
        )
        .toBeVisible();
      await expect
        .element(
          page.getByRole('button', { name: 'Copy the command', exact: true }),
        )
        .toBeVisible();
    }
    if (state.reason)
      await expect
        .element(page.getByRole('alert'))
        .toHaveTextContent(state.reason);
  });
}
