# Web foundation

The browser and future Electron renderer share a React application built with Vite.
Vite provides development refresh and produces static assets without coupling presentation
to the Node server or Electron APIs. Integrating authenticated server connections, server
asset hosting and Electron packaging remains separate work requiring its own runtime proof.

The web app lives in the existing pnpm workspace. Its shadcn configuration was generated
with preset `b27Gcu70`, Base UI and pointer cursors: Rhea, neutral tokens, Geist and Lucide.
UI source stays in the web application until another actual consumer needs it; a new shared
UI package would add an unnecessary boundary now.

The official component set, except tables and charts, is intentionally vendored during initial development.
Tables and charts are outside the agreed product scope; their components, chart tokens and Recharts
dependency are removed. The chart-only raw HTML lint exception is also removed;
Biome explicitly rejects raw HTML injection throughout source, including vendor components.
Compose these components, use semantic tokens and consult the installed shadcn skill.
After launch, remove unused components and the corresponding Knip exceptions.
Knip currently excludes vendor files, the generated mobile hook and dependencies used only
by dormant components. Application source remains checked for unused code.

Upstream UI primitives retain their composition, effect dependencies, positional keys, cookie
handling. Narrow Biome overrides in the vendor directory accommodate
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


## Client libraries and React checks

TanStack Query owns the browser query cache; a single client is created at application
bootstrap. TanStack Router owns navigation with an explicit code-defined route tree.
The initial root route renders the existing disconnected workspace. Browser history assumes
HTTP hosting with SPA fallback. An Electron host may supply a different history strategy
if its asset scheme requires it; the renderer imports no Electron or Node APIs.

TanStack Hotkeys owns in-window shortcuts. Alt+Shift+D toggles the current theme.
OS-wide shortcuts remain Electron's responsibility and require platform testing.
The unified TanStack DevTools includes Query, Router and Hotkeys panels and is imported
only in development. It is not a production route or an application capability.

Form, Markdown, Store, Virtual and Highlight are installed for upcoming client features.
Their explicit Knip dependency exceptions last until their first consumers; do not add
placeholder product screens to exercise unused dependencies. Markdown is imported from
`@tanstack/markdown` (including its React subpath), not a separate react-markdown package.
Markdown and unified DevTools are currently alpha; exact versions are locked.
Rendered Markdown will need content-policy and malicious-input tests when introduced.

Husky now runs the pinned React Doctor against the Git index, blocking warnings and errors.
CI also scans the full web project so local hook bypass does not bypass the repository check.
The vendored UI and generated mobile hook use the existing vendor exclusion policy.
React Doctor complements type checking, browser smoke and Biome; a score is not a shipping
guarantee. The hook regression test uses an isolated Git index and an actual conditional-hook
violation to prove rejection without modifying the developer's staged work.


## Presentation state and content libraries

TanStack Store replaces the planned Zustand choice for shared presentation state.
Component-local state stays in React, URL state stays in Router, and server data stays in
Query. Installing Store does not justify moving the shell's local theme toggle into a
global store.

Virtual is selected for large file trees and histories when those views are introduced.
Highlight is selected for syntax highlighting, with selective language imports. Its first
viewer integration must validate incomplete code, multiline tokens, safe rendering,
unsupported-language fallback and large-file responsiveness alongside review annotations.
Installing either library does not establish those runtime behaviors.

The agreed client foundation excludes DB, Start, AI, Table and Charts.
Pacer and Intent are deferred until a concrete need; Config and CLI are not installed.
Exact dependency versions remain locked, including the accepted alpha libraries.
