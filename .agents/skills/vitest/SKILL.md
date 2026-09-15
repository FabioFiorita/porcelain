---
name: vitest
description: >
  Write Porcelain specs in three layers: Node units, Vitest Browser Mode for
  views, Playwright for the built app. Never jsdom, happy-dom, fireEvent, or
  Testing Library. Use when adding or changing *.spec.ts or *.spec.tsx files,
  fireEvent, userEvent, waitFor, Promise.resolve, Testing Library, jsdom,
  happy-dom, browser mode, locators, or component tests. Use when the user
  runs /vitest.
---

# Vitest specs

Porcelain uses Vitest 5. Simulated browsers (jsdom, happy-dom) are not used.
See [test environments](../../../docs/decisions/test-environments.md).

## Pick the runner

| Layer | Proof | Runner |
| --- | --- | --- |
| Unit | Domain, contracts, git, server, scripts; no view | Vitest in Node |
| View | A view or query harness against domain + fixtures | Vitest Browser Mode |
| End-to-end | Built app and a disposable real API | Playwright in `apps/web/e2e` |

Browser Mode uses `vitest-browser-react` and `vitest/browser` in Chromium.
Do not import `@testing-library/*`. Do not use `fireEvent`. Do not set
`// @vitest-environment jsdom`. If production code needs `DOMParser` or other
browser APIs, the spec runs in Browser Mode.

API map: [Browser Mode](references/browser-mode.md).

## Interactions

```ts
const screen = await render(<Component />);
await screen.getByRole('button', { name: 'Pull' }).click();
await screen.getByLabelText('Access token').fill('fixture-token');
await screen.getByRole('button', { name: 'Open' }).click({ button: 'right' });
```

Import `userEvent` from `vitest/browser` only for keyboard chords or clipboard
helpers. Window focus for Query refetch is `window.dispatchEvent(new Event('focus'))`
or `focusManager.setFocused`. Import `../app.css` from the browser setup file so
overlays stack correctly. When a Base UI overlay intercepts a locator click,
assert visibility then `(await locator.element()).click()`.

## Queries

1. Role, then label, then placeholder
2. Visible text when the role is generic
3. Test id only when the control has no accessible name
4. Never `querySelector` for assertions unless the node is not in the
   accessibility tree (SVG sprite ids)

Locators retry and are strict: `getByText('Item')` does not match `Item 1`.
Do not wrap them in `waitFor`. Scope with locator chaining
(`screen.getByRole('alertdialog').getByRole('button', { name: 'Cancel' })`).

## Waiting

Do not flush work with `await Promise.resolve()`, `await act(() => {})`, or a
fixed `setTimeout`.

| Goal | API |
| --- | --- |
| Element appears | `await expect.element(locator).toBeVisible()` |
| Exact text | `await expect.element(locator).toHaveTextContent('Reviewed')` |
| Substring / regex | `await expect.element(locator).toMatchTextContent(/error/i)` |
| Absence | `await expect.element(locator).not.toBeInTheDocument()` |
| Non-DOM condition | `await vi.waitFor(() => expect(...))` |
| Late response must not win | Resolve the fixture, wait until that read is `idle`, then assert the snapshot that must remain |

`Promise.resolve` is fine as a mock return (`mockResolvedValue`). Node stream
specs may `await Promise.resolve()` once to yield the event loop.

## Assertions

Assert user-visible results. Do not make mock call counts or CSS class lists
the only proof. Do not snapshot markup.

`render()` and `renderWorkspace()` are async and return locators. `unmount` and
`rerender` are async. `renderHook` comes from `vitest-browser-react`.

## Vitest TypeScript

- Import `describe`, `it`, `expect`, `vi` from `vitest`.
- `it` / `it.each` in application specs. Do not mix `test` and `it` in one file.
- `vi.hoisted` + `vi.mock`. If a mock hides sibling exports, spread
  `importOriginal`.
- Workspace shell: `const screen = await renderWorkspace(store)`.
- Isolated fixtures. Never `~/.porcelain`, real credentials, or work projects.
