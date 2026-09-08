# Web foundation

The browser and future Electron renderer share a React application built with Vite.
Vite provides development refresh and produces static assets without coupling presentation
to the Node server or Electron APIs. Integrating authenticated server connections, server
asset hosting and Electron packaging remains separate work requiring its own runtime proof.

The web app lives in the existing pnpm workspace. Its shadcn configuration was generated
with preset `b27Gcu70`, Base UI and pointer cursors: Rhea, neutral tokens, Geist and Lucide.
UI source stays in the web application until another actual consumer needs it; a new shared
UI package would add an unnecessary boundary now.

The complete official component set is intentionally vendored during initial development.
Compose these components, use semantic tokens and consult the installed shadcn skill.
After launch, remove unused components and the corresponding Knip exceptions.
Knip currently excludes vendor files, the generated mobile hook and dependencies used only
by dormant components. Application source remains checked for unused code.

Upstream UI primitives retain their composition, effect dependencies, positional keys, cookie
handling and generated chart CSS. Narrow Biome overrides in the vendor directory accommodate
those implementations and their complexity; they are not permission to place application code
there. Types, explicit-any checks, imports and formatting still apply. The declaration-style
gate likewise permits upstream local mutation only in the vendor UI files.
Local adaptations are formatting/import cleanup and allowing an explicitly undefined optional
calendar locale under the repository's strict TypeScript configuration. Review upstream diffs
before updates rather than overwriting these adaptations.

The initial shell has an honest disconnected empty state and a session-local theme toggle.
Playwright checks the built assets, keyboard theme switching and layout at desktop and narrow
Chromium sizes. These smoke tests run separately from Vitest coverage and establish neither
Electron nor native mobile behavior. Full component runtime coverage is not claimed.
