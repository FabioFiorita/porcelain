# Porcelain mobile

The native Porcelain client is an Expo SDK 57 app. Its starter shell uses Expo
Router native tabs and universal `@expo/ui` components.

From the repository root:

```bash
pnpm install
pnpm mobile:start
```

Or start Expo directly:

```bash
cd apps/mobile
npx expo start
```

To expose Expo's local development MCP server while Metro is running:

```bash
pnpm mobile:start:mcp
```

The starter has five stable native tabs: Files, Changes, Review, Board, and
Terminal. Each tab owns a navigation stack so deeper screens can be added
without turning every destination into a tab.
