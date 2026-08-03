# @porcelain/daemon

Headless Porcelain runtime. Product heart for Linux hosts and for the Mac shell's
local child process. See `.agents/reference/architecture.md`.

**Build status:** source lives here; the electron-vite build in `apps/desktop`
still emits `out/main/daemon/server.js` until the independent daemon build lands.
Do not put Electron imports here (Biome-fenced).
