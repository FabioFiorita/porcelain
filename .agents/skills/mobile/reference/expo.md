# Expo, as this app uses it

Vendored `expo-*` / `eas-*` skills used to sit beside this file. They were 39k words of generic
guidance that contradicted Porcelain in five places and drifted between SDK releases. This file keeps
the contradictions and the traps; **API detail comes from the live docs, not from memory or a fork**:

```
mcp__expo__read_documentation   # any docs.expo.dev page as markdown
mcp__expo__learn                # guided topics
mcp__expo__workflow_validate    # validate a workflow before running it — it catches real errors
```

Reach for those for component props, CLI flags and config fields. The SDK moves; this file does not.

## Where the vendor answer is wrong here

| The general Expo answer | Porcelain |
|---|---|
| `eas build --submit` — build and ship in one command | **Never.** A build that auto-submits spends a build credit and a TestFlight slot with no decision behind it. Delivery is a dispatched workflow |
| `on: push` as a workflow's default trigger | Banned; `scripts/lint-eas-triggers.mjs` fails the gate |
| Distribute the dev client through TestFlight | The dev client is a simulator or ad-hoc artifact. TestFlight carries the `preview` identity only, and a dev build cannot reach it — different bundle id |
| Import `Host` from the `@expo/ui` root | SDK 57 exports `Host` from `/swift-ui`. The root is lint-banned |
| Prefer universal components for portability | iOS-only, so portability costs 32 components and buys nothing |

## Routing

Expo Router, file-based. `src/app/` is the route table and nothing else. iPhone uses `NativeTabs`;
the iPad root presentation is a `SplitView`, which **throws when rendered inside another navigator**
— so it can only ever be the root layout, never nested in a tab.

## SwiftUI components

`@expo/ui/swift-ui` for components, `@expo/ui/swift-ui/modifiers` for styling. Five traps that cost
real time, none of which `tsc` can see:

- A `Button` tints its **entire label**, so a `Button`-wrapped row renders as blue link text. Every
  tappable row needs `buttonStyle('plain')`.
- `Spacer` fills the available space in a stack. A fixed gap is `frame({ height })`, not a size prop.
- `TextField`'s prop is **`text`**, not `value`; multiline is `axis="vertical"`.
- `Picker` selects with `tag()` + `pickerStyle()`, not an `appearance` prop.
- `Text`'s `markdownEnabled` is **inline-only** — it does not unlock a markdown viewer.

## Native modules

One: `porcelain-row-canvas`, a generic row engine (diff now, terminal later). It is on the classic
`Module` + `definition() -> ModuleDefinition` DSL, not the 2.0 macro API, and no migration is
planned. Its Swift surface stays generic — rows, theme and tokens as data, feature logic in JS — so
feature iteration never needs a native rebuild.

A config plugin strips the push entitlement that prebuild auto-applies for autolinked
`expo-notifications`. Mods run LIFO, so the entitlement writers come after the stripper.

## SDK upgrades

SDK 57. An upgrade moves the fingerprint by definition, so it costs a dev-client build and a preview
build — plan it as a delivery, not a chore. `npx expo install --check` reconciles versions.
