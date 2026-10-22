# Playwright CLI fallback

The installed project version provides `pnpm exec playwright cli`; inspect its help before use.

```sh
pnpm exec playwright cli -s=web-<instance> open about:blank
pnpm exec playwright cli -s=web-<instance> run-code 'async page => { await page.setViewportSize({ width: 414, height: 896 }); }'
pnpm exec playwright cli -s=web-<instance> goto '<fresh pairing link>'
pnpm exec playwright cli -s=web-<instance> snapshot
pnpm exec playwright cli -s=web-<instance> run-code 'async page => { await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click(); }'
```

Close the session before stopping the instance:

```sh
pnpm exec playwright cli -s=web-<instance> close
```
