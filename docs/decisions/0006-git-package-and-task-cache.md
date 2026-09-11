# Git package and direct checks

`packages/git` remains a private Node package with explicit public subpaths. Checkout-bound Git
adapters are independent of HTTP and persistence; the server assigns Porcelain identity and owns
operation coordination and durable receipts. A separate package keeps this boundary explicit
without introducing database or domain packages.

The initial rebuild introduced Turborepo, runtime fingerprinting, scoped coverage tasks and a
coverage merger. We removed that machinery while focusing on a usable server and web app:
maintaining trustworthy cache invalidation cost more complexity than this stage justified.
pnpm runs package typechecks directly and Vitest produces one coverage report. Existing global
coverage thresholds remain in the executable configuration. Revisit caching only with measured
check times that justify it.
