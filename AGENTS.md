Before changing code that uses a library, check its current official documentation (including llms.txt when available) for a built-in pattern, and prefer that over custom helpers or dependencies.

For server changes, read `architecture/server.md` and use the `server-engineering` skill. The architecture check, TypeScript, Oxlint, and Oxfmt are the hard gates; skill guidance explains the workflow around them. Use `server-spec` for meaningful behavior specs and `server-verify` for mapped HTTP evidence.
