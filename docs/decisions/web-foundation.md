# Web foundation

The browser application uses React and Vite. The persistent Node server can host its built assets on the same origin as `/api`, while development uses Vite's proxy. The renderer imports no Node or Electron APIs, leaving a future Electron host free to choose its own navigation integration.

UI components are vendored in the web app and composed with semantic tokens. Narrow lint exceptions accommodate upstream implementation details; application code does not belong in the vendor directory. Review upstream diffs before updates so local strict-TypeScript and formatting adaptations are preserved.

TanStack Query owns cached server state, Router owns URL state, and component-local state stays in React. Hotkeys owns in-window shortcuts. Development-only tools stay out of the production bundle. Additional libraries and shared packages are added when implemented behavior needs them; this record does not reserve dependencies for future features.
