# Vitest Browser Mode

The middle layer in [test environments](../../../../docs/decisions/test-environments.md):
a view or query harness in real Chromium. Playwright e2e in `apps/web/e2e` is
the layer above (built app and a disposable API). Node units are the layer
below and have no DOM.

## Layout

Root `vitest.config.ts` defines `test.projects`:

- `node`: scripts, packages, server, and `apps/web/src/**/*.spec.ts`
- `browser`: `./apps/web/vitest.config.ts` (`src/**/*.spec.tsx` and
  browser-API domain specs, Playwright Chromium, `src/test/setup.ts`)

Do not set `browser.enabled: true` on the root config. Do not re-include
`*.spec.tsx` in the Node project.

CI `specs` installs Chromium (`playwright install --with-deps chromium`)
before `pnpm test:coverage`. Locally: `pnpm --filter @porcelain/web exec playwright install chromium`.
Coverage uses istanbul so Browser Mode instrumentation maps back to source.

`renderWorkspace` (`apps/web/src/test/render.tsx`) uses
`vitest-browser-react` and returns locators plus `{ store, queryClient }`.

## Write a view spec

```tsx
import { render } from 'vitest-browser-react';
import { expect, it } from 'vitest';
import { Component } from './component';

it('marks the file reviewed', async () => {
  const screen = await render(<Component />);
  await screen.getByRole('button', { name: 'Mark reviewed' }).click();
  await expect
    .element(screen.getByRole('status'))
    .toHaveTextContent('Reviewed');
});
```

`page` from `vitest/browser` queries the whole document. Prefer the `render()`
result unless the assertion is outside the component.

`userEvent` from `vitest/browser` is a singleton. Vitest resets unreleased
keys between tests. Pointer position is not reset.

## API map

| Old Testing Library | Browser Mode |
| --- | --- |
| `render` from `@testing-library/react` | `render` from `vitest-browser-react` |
| `screen.getByRole` / `findByRole` | `screen.getByRole` (locator) |
| `userEvent.setup().click(el)` | `locator.click()` |
| `user.type(el, 'text')` | `locator.fill('text')`; `userEvent.type` from `vitest/browser` when each key must fire |
| `user.click(el, { button: 2 })` | `locator.click({ button: 'right' })` |
| `waitFor(() => expect(el).toBeVisible())` | `await expect.element(locator).toBeVisible()` |
| `cleanup()` in `afterEach` | owned by `render()` |
| `within(dialog).getByRole(...)` | `screen.getByRole('dialog').getByRole(...)` |
| `renderHook` from Testing Library | `renderHook` from `vitest-browser-react` |
