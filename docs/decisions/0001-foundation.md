# An understandable TypeScript foundation

Porcelain uses plain TypeScript across the server and clients. Dependencies stay explicit, and platform applications remain separate while contracts and portable client behavior can be shared. Package configuration and executable checks, rather than this record, own exact versions and rules.

Application source is checked with strict optional-property and indexed-access settings. `skipLibCheck` is enabled because current Vitest and Vite declarations are incomplete under those settings; it does not relax checking of Porcelain source. The dependency analysis tool uses a scoped older TypeScript compiler through pnpm because its parser does not yet support the application compiler. Guard specs exercise real imports so an unavailable parser cannot silently pass the boundary check.
